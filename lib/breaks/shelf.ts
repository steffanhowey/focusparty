// ─── Break Content Shelf Manager ────────────────────────────
// Maintains a living editorial shelf of 5–8 curated items per
// (world, duration) bucket. Promotes candidates into ALL valid
// duration buckets (not just best_duration), expires stale
// content, enforces diversity, and learns from engagement.

import { createClient } from "@/lib/supabase/admin";
import { WORLD_SEARCH_PROFILES } from "./searchProfiles";

// ─── Constants ──────────────────────────────────────────────

const SHELF_PER_DURATION_MIN = 5;
const SHELF_PER_DURATION_MAX = 8;
const SHELF_TTL_DAYS = 7;
const MIN_TASTE_SCORE = 70;
const MIN_TASTE_SCORE_RELAXED = 55; // used when bucket is still below min
const MAX_PER_CREATOR = 2;
const DURATIONS = [3, 5, 10] as const;

// ─── Types ──────────────────────────────────────────────────

interface ShelfRefreshResult {
  worldKey: string;
  expired: number;
  promoted: number;
  removed: number;
  shelfSize: number;
}

// ─── Engagement-based score adjustments ─────────────────────

async function applyEngagementAdjustments(worldKey: string): Promise<void> {
  const supabase = createClient();

  const { data: shelfItems } = await supabase
    .from("fp_break_content_items")
    .select("id, taste_score")
    .eq("room_world_key", worldKey)
    .eq("status", "active");

  if (!shelfItems || shelfItems.length === 0) return;

  for (const item of shelfItems) {
    const { count: startedCount } = await supabase
      .from("fp_break_engagement")
      .select("*", { count: "exact", head: true })
      .eq("content_item_id", item.id)
      .eq("event_type", "started");

    const { count: completedCount } = await supabase
      .from("fp_break_engagement")
      .select("*", { count: "exact", head: true })
      .eq("content_item_id", item.id)
      .eq("event_type", "completed");

    const { count: abandonedCount } = await supabase
      .from("fp_break_engagement")
      .select("*", { count: "exact", head: true })
      .eq("content_item_id", item.id)
      .eq("event_type", "abandoned");

    const started = startedCount ?? 0;
    if (started === 0) continue;

    const completionRate = (completedCount ?? 0) / started;
    const abandonRate = (abandonedCount ?? 0) / started;

    let adjustment = 0;
    if (completionRate > 0.7) adjustment = 10;
    else if (abandonRate > 0.6) adjustment = -15;

    if (adjustment !== 0) {
      const newScore = Math.min(
        100,
        Math.max(0, (item.taste_score ?? 0) + adjustment),
      );
      await supabase
        .from("fp_break_content_items")
        .update({ taste_score: newScore })
        .eq("id", item.id);

      console.log(
        `[breaks/shelf] ${worldKey}: adjusted item ${item.id} by ${adjustment > 0 ? "+" : ""}${adjustment} (completion=${(completionRate * 100).toFixed(0)}%, abandon=${(abandonRate * 100).toFixed(0)}%)`,
      );
    }
  }
}

// ─── Core: refresh a single world's shelf ───────────────────

export async function refreshShelf(
  worldKey: string,
): Promise<ShelfRefreshResult> {
  const supabase = createClient();
  const now = new Date().toISOString();

  // 0. Apply engagement-based score adjustments
  await applyEngagementAdjustments(worldKey);

  // 1. Remove expired non-pinned items
  const { data: expiredItems } = await supabase
    .from("fp_break_content_items")
    .select("id")
    .eq("room_world_key", worldKey)
    .eq("status", "active")
    .or("pinned.is.null,pinned.eq.false")
    .not("expires_at", "is", null)
    .lt("expires_at", now);

  let expired = 0;
  if (expiredItems && expiredItems.length > 0) {
    const ids = expiredItems.map((i) => i.id);
    await supabase
      .from("fp_break_content_items")
      .update({ status: "expired" })
      .in("id", ids);
    expired = ids.length;
    console.log(`[breaks/shelf] ${worldKey}: expired ${expired} items`);
  }

  // 2. Promote + trim per duration bucket
  let promoted = 0;
  let removed = 0;
  let shelfSize = 0;

  // Collect all candidate_ids already on the active shelf (any duration)
  // to prevent duplicate items from the same candidate in the same bucket.
  const { data: existingShelfItems } = await supabase
    .from("fp_break_content_items")
    .select("candidate_id, best_duration")
    .eq("room_world_key", worldKey)
    .eq("status", "active")
    .not("candidate_id", "is", null);

  // Set of "candidateId:duration" keys already on shelf
  const onShelf = new Set(
    (existingShelfItems ?? []).map(
      (i) => `${i.candidate_id}:${i.best_duration}`,
    ),
  );

  for (const duration of DURATIONS) {
    // Count active items in this bucket
    const { data: bucketItems } = await supabase
      .from("fp_break_content_items")
      .select("id, taste_score, pinned, source_name")
      .eq("room_world_key", worldKey)
      .eq("status", "active")
      .eq("best_duration", duration)
      .order("taste_score", { ascending: false, nullsFirst: false });

    let bucketSize = bucketItems?.length ?? 0;

    // Promote if below minimum
    if (bucketSize < SHELF_PER_DURATION_MIN) {
      const needed = SHELF_PER_DURATION_MAX - bucketSize;
      const minVideoSeconds = duration * 60;

      // Build creator count map for diversity enforcement
      const creatorCounts = new Map<string, number>();
      for (const item of bucketItems ?? []) {
        const name = (item.source_name ?? "").toLowerCase();
        if (name) {
          creatorCounts.set(name, (creatorCounts.get(name) ?? 0) + 1);
        }
      }

      // Get ALL top-scored candidates for this world (any best_duration)
      // where the video is long enough to support this duration.
      // This is the key change: we promote into ALL valid buckets,
      // not just the candidate's best_duration.
      const { data: topCandidates } = await supabase
        .from("fp_break_content_scores")
        .select("*, candidate:fp_break_content_candidates(*)")
        .eq("world_key", worldKey)
        .gte("taste_score", MIN_TASTE_SCORE)
        .order("taste_score", { ascending: false })
        .limit(needed * 4);

      if (topCandidates) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const eligible = topCandidates.filter((s: any) => {
          const c = s.candidate;
          if (!c || c.status === "rejected") return false;
          // Video must be long enough for this duration
          if ((c.duration_seconds ?? 0) < minVideoSeconds) return false;
          // Don't duplicate same candidate+duration on shelf
          if (onShelf.has(`${c.id}:${duration}`)) return false;

          const creatorName = (c.creator ?? "").toLowerCase();
          if (creatorName) {
            const count = creatorCounts.get(creatorName) ?? 0;
            if (count >= MAX_PER_CREATOR) return false;
          }
          return true;
        });

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + SHELF_TTL_DAYS);

        for (const scored of eligible.slice(0, needed)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const c = scored.candidate as any;
          if (!c) continue;

          // Pick the segment matching this duration (if available)
          const segments = scored.segments ?? null;

          const { error: insertErr } = await supabase
            .from("fp_break_content_items")
            .insert({
              room_world_key: worldKey,
              category: "learning",
              title: c.title,
              description: c.description,
              thumbnail_url: c.thumbnail_url,
              video_url: c.video_url,
              source_name: c.creator,
              duration_seconds: c.duration_seconds,
              sort_order: 0,
              status: "active",
              candidate_id: c.id,
              taste_score: scored.taste_score,
              pinned: false,
              expires_at: expiresAt.toISOString(),
              editorial_note: scored.editorial_note ?? null,
              segments,
              best_duration: duration,
              topics: scored.topics ?? null,
            });

          if (insertErr) {
            console.error("[breaks/shelf] promote error:", insertErr);
            continue;
          }

          // Track what we've placed on shelf
          onShelf.add(`${c.id}:${duration}`);
          const creatorName = (c.creator ?? "").toLowerCase();
          if (creatorName) {
            creatorCounts.set(
              creatorName,
              (creatorCounts.get(creatorName) ?? 0) + 1,
            );
          }

          // Mark candidate as promoted (if not already)
          if (c.status !== "promoted") {
            await supabase
              .from("fp_break_content_candidates")
              .update({ status: "promoted" })
              .eq("id", c.id);
          }

          promoted++;
          bucketSize++;
        }
      }

      // Relaxed pass: if still below min, lower the taste threshold
      if (bucketSize < SHELF_PER_DURATION_MIN) {
        const relaxedNeeded = SHELF_PER_DURATION_MIN - bucketSize;
        const minVideoSeconds = duration * 60;

        const { data: relaxedCandidates } = await supabase
          .from("fp_break_content_scores")
          .select("*, candidate:fp_break_content_candidates(*)")
          .eq("world_key", worldKey)
          .gte("taste_score", MIN_TASTE_SCORE_RELAXED)
          .lt("taste_score", MIN_TASTE_SCORE)
          .order("taste_score", { ascending: false })
          .limit(relaxedNeeded * 4);

        if (relaxedCandidates) {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + SHELF_TTL_DAYS);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const scored of relaxedCandidates as any[]) {
            if (bucketSize >= SHELF_PER_DURATION_MIN) break;
            const c = scored.candidate;
            if (!c || c.status === "rejected") continue;
            if ((c.duration_seconds ?? 0) < minVideoSeconds) continue;
            if (onShelf.has(`${c.id}:${duration}`)) continue;

            const creatorName = (c.creator ?? "").toLowerCase();
            if (creatorName) {
              const count = creatorCounts.get(creatorName) ?? 0;
              if (count >= MAX_PER_CREATOR) continue;
              creatorCounts.set(creatorName, count + 1);
            }

            const { error: insertErr } = await supabase
              .from("fp_break_content_items")
              .insert({
                room_world_key: worldKey,
                category: "learning",
                title: c.title,
                description: c.description,
                thumbnail_url: c.thumbnail_url,
                video_url: c.video_url,
                source_name: c.creator,
                duration_seconds: c.duration_seconds,
                sort_order: 0,
                status: "active",
                candidate_id: c.id,
                taste_score: scored.taste_score,
                pinned: false,
                expires_at: expiresAt.toISOString(),
                editorial_note: scored.editorial_note ?? null,
                segments: scored.segments ?? null,
                best_duration: duration,
                topics: scored.topics ?? null,
              });

            if (insertErr) continue;
            onShelf.add(`${c.id}:${duration}`);
            if (c.status !== "promoted") {
              await supabase
                .from("fp_break_content_candidates")
                .update({ status: "promoted" })
                .eq("id", c.id);
            }
            promoted++;
            bucketSize++;
          }

          if (bucketSize >= SHELF_PER_DURATION_MIN) {
            console.log(
              `[breaks/shelf] ${worldKey}/${duration}min: relaxed threshold filled bucket to ${bucketSize}`,
            );
          }
        }
      }

      if (bucketSize < SHELF_PER_DURATION_MIN) {
        console.warn(
          `[breaks/shelf] WARNING: ${worldKey}/${duration}min has only ${bucketSize} items (min: ${SHELF_PER_DURATION_MIN}). Need more candidates.`,
        );
      }
    }

    console.log(
      `[breaks/shelf] ${worldKey}/${duration}min: ${bucketSize} items${promoted > 0 ? ` (promoted ${promoted})` : ""}`,
    );

    // Trim bucket if over max
    if (bucketSize > SHELF_PER_DURATION_MAX) {
      const { data: allInBucket } = await supabase
        .from("fp_break_content_items")
        .select("id, taste_score, pinned")
        .eq("room_world_key", worldKey)
        .eq("status", "active")
        .eq("best_duration", duration)
        .order("taste_score", { ascending: true, nullsFirst: true });

      if (allInBucket) {
        const removable = allInBucket.filter((i) => !i.pinned);
        const toRemove = removable.slice(
          0,
          bucketSize - SHELF_PER_DURATION_MAX,
        );

        if (toRemove.length > 0) {
          const ids = toRemove.map((i) => i.id);
          await supabase
            .from("fp_break_content_items")
            .update({ status: "expired" })
            .in("id", ids);
          removed += ids.length;
          bucketSize -= ids.length;
          console.log(
            `[breaks/shelf] ${worldKey}/${duration}min: removed ${ids.length} low-scored items`,
          );
        }
      }
    }

    shelfSize += bucketSize;
  }

  // 3. Update sort_order based on taste_score ranking
  const { data: finalShelf } = await supabase
    .from("fp_break_content_items")
    .select("id, taste_score")
    .eq("room_world_key", worldKey)
    .eq("status", "active")
    .order("taste_score", { ascending: false, nullsFirst: false });

  if (finalShelf) {
    for (let i = 0; i < finalShelf.length; i++) {
      await supabase
        .from("fp_break_content_items")
        .update({ sort_order: i + 1 })
        .eq("id", finalShelf[i].id);
    }
  }

  return { worldKey, expired, promoted, removed, shelfSize };
}

// ─── Refresh all worlds ─────────────────────────────────────

export async function refreshAllShelves(): Promise<ShelfRefreshResult[]> {
  const worldKeys = Object.keys(WORLD_SEARCH_PROFILES);
  const results: ShelfRefreshResult[] = [];

  for (const worldKey of worldKeys) {
    try {
      const result = await refreshShelf(worldKey);
      results.push(result);
    } catch (err) {
      console.error(`[breaks/shelf] error refreshing ${worldKey}:`, err);
      results.push({
        worldKey,
        expired: 0,
        promoted: 0,
        removed: 0,
        shelfSize: -1,
      });
    }
  }

  return results;
}
