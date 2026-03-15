// ─── Break Content Shelf Manager ────────────────────────────
// Maintains a living editorial shelf of 5–8 curated items per
// (world, duration) bucket. Promotes candidates into ALL valid
// duration buckets (not just best_duration), expires stale
// content, enforces diversity, and learns from engagement.

import { createClient } from "@/lib/supabase/admin";
import { WORLD_BREAK_PROFILES, ALL_CATEGORIES, getSponsorLock } from "./worldBreakProfiles";
import { screenContent } from "./contentSafety";

// ─── Constants ──────────────────────────────────────────────

const SHELF_PER_DURATION_MIN = 5;
const SHELF_PER_DURATION_MAX = 8;
const SHELF_TTL_DAYS = 7;
/** Extended TTL for thin buckets — don't expire what you can't replace. */
const SHELF_TTL_EXTENDED_DAYS = 21;
const MIN_TASTE_SCORE = 55;
const MAX_PER_CREATOR = 2;
const DURATIONS = [3, 5, 10] as const;

// ─── Types ──────────────────────────────────────────────────

export interface ShelfRefreshResult {
  worldKey: string;
  category: string;
  expired: number;
  promoted: number;
  removed: number;
  shelfSize: number;
  /** "ok" = all buckets ≥ 3 items, "thin" = some < 3, "empty" = some at 0 */
  health: "ok" | "thin" | "empty";
  /** Per-duration bucket sizes for diagnostics */
  buckets: Record<number, number>;
}

// ─── Engagement-based score adjustments ─────────────────────

async function applyEngagementAdjustments(worldKey: string, category: string): Promise<void> {
  const supabase = createClient();

  const { data: shelfItems } = await supabase
    .from("fp_break_content_items")
    .select("id, taste_score")
    .eq("room_world_key", worldKey)
    .eq("category", category)
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
  category: string = "learning",
): Promise<ShelfRefreshResult> {
  const supabase = createClient();
  const now = new Date().toISOString();

  // 0. Apply engagement-based score adjustments
  await applyEngagementAdjustments(worldKey, category);

  // 1. Smart expiration: only expire items when the bucket can sustain it.
  //    Thin buckets use an extended TTL (21 days) instead of the standard 7 days.
  //    This prevents the shelf from draining faster than the pipeline can fill it.
  let expired = 0;

  const standardCutoff = new Date(Date.now() - SHELF_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const extendedCutoff = new Date(Date.now() - SHELF_TTL_EXTENDED_DAYS * 24 * 60 * 60 * 1000).toISOString();

  for (const dur of DURATIONS) {
    // Get all active items in this bucket
    const { data: bucketActive } = await supabase
      .from("fp_break_content_items")
      .select("id, pinned, expires_at")
      .eq("room_world_key", worldKey)
      .eq("category", category)
      .eq("status", "active")
      .eq("best_duration", dur);

    const activeCount = bucketActive?.length ?? 0;
    if (activeCount === 0) continue;

    // Determine which TTL cutoff to use based on bucket health
    const isThin = activeCount <= SHELF_PER_DURATION_MIN;
    const cutoff = isThin ? extendedCutoff : standardCutoff;

    // Find expired items using the appropriate cutoff
    const expirable = (bucketActive ?? []).filter((i) => {
      if (i.pinned) return false;
      if (!i.expires_at) return false;
      return i.expires_at < cutoff;
    });

    if (expirable.length === 0) continue;

    // Don't expire if it would drop the bucket below minimum
    const afterExpiry = activeCount - expirable.length;
    let toExpire = expirable;
    if (afterExpiry < SHELF_PER_DURATION_MIN) {
      // Only expire enough to stay at minimum
      const canExpire = Math.max(0, activeCount - SHELF_PER_DURATION_MIN);
      if (canExpire === 0) {
        console.warn(
          `[breaks/shelf] Skipping expiration for ${worldKey}/${category}/${dur}min — bucket at ${activeCount} items (min: ${SHELF_PER_DURATION_MIN})`
        );
        continue;
      }
      toExpire = expirable.slice(0, canExpire);
    }

    const ids = toExpire.map((i) => i.id);
    await supabase
      .from("fp_break_content_items")
      .update({ status: "expired" })
      .in("id", ids);
    expired += ids.length;
  }

  if (expired > 0) {
    console.log(`[breaks/shelf] ${worldKey}/${category}: expired ${expired} items (smart TTL)`);
  }

  // 2. Promote + trim per duration bucket
  let promoted = 0;
  let removed = 0;
  let shelfSize = 0;
  const buckets: Record<number, number> = {};

  // Collect all video_urls already on the active shelf (any duration).
  // Each video should only appear in ONE duration bucket to maximize variety.
  const { data: existingShelfItems } = await supabase
    .from("fp_break_content_items")
    .select("video_url")
    .eq("room_world_key", worldKey)
    .eq("category", category)
    .eq("status", "active")
    .not("video_url", "is", null);

  // Set of video_urls already on shelf — one video = one duration bucket only
  const onShelf = new Set(
    (existingShelfItems ?? []).map((i) => i.video_url as string),
  );

  for (const duration of DURATIONS) {
    // Count active items in this bucket
    const { data: bucketItems } = await supabase
      .from("fp_break_content_items")
      .select("id, taste_score, pinned, source_name")
      .eq("room_world_key", worldKey)
      .eq("category", category)
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

      // Get top-scored candidates discovered FOR THIS WORLD only.
      // Each world has its own editorial persona and discovery queries —
      // promoting cross-world content makes rooms feel identical.
      // The cross-world fallback in the content API handles empty shelves.
      const { data: topCandidates } = await supabase
        .from("fp_break_content_scores")
        .select("*, candidate:fp_break_content_candidates!inner(*)")
        .eq("candidate.world_key", worldKey)
        .eq("candidate.category", category)
        .gte("taste_score", MIN_TASTE_SCORE)
        .gte("relevance_score", 40)
        .order("taste_score", { ascending: false })
        .limit(needed * 4);

      if (topCandidates) {
        const sponsor = getSponsorLock(category);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const eligible = topCandidates.filter((s: any) => {
          const c = s.candidate;
          if (!c || c.status === "rejected") return false;
          // Only promote candidates from the same category
          if ((c.category ?? "learning") !== category) return false;
          // Sponsor lock: only promote content from the sponsor
          if (sponsor && (c.creator ?? "").toLowerCase() !== sponsor.sourceName.toLowerCase()) return false;
          // Video must be long enough for this duration
          if ((c.duration_seconds ?? 0) < minVideoSeconds) return false;
          // Don't duplicate same video URL across ANY duration bucket
          if (c.video_url && onShelf.has(c.video_url)) return false;
          // Safety re-screen — catch candidates that predate the blocklist
          const safety = screenContent(c.title ?? "", c.description);
          if (!safety.safe) return false;

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
              category,
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
              scaffolding: scored.scaffolding ?? null,
              scaffolding_status: scored.scaffolding ? "complete" : "none",
            });

          if (insertErr) {
            console.error("[breaks/shelf] promote error:", insertErr);
            continue;
          }

          // Track what we've placed on shelf (by video_url only — one video per shelf)
          if (c.video_url) onShelf.add(c.video_url);
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
        .eq("category", category)
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

    buckets[duration] = bucketSize;
    shelfSize += bucketSize;
  }

  // 3. Update sort_order based on taste_score ranking
  const { data: finalShelf } = await supabase
    .from("fp_break_content_items")
    .select("id, taste_score")
    .eq("room_world_key", worldKey)
    .eq("category", category)
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

  // Compute health status
  const bucketSizes = Object.values(buckets);
  const health = bucketSizes.some((s) => s === 0)
    ? "empty" as const
    : bucketSizes.some((s) => s < 3)
      ? "thin" as const
      : "ok" as const;

  if (health !== "ok") {
    console.warn(
      `[breaks/shelf] ⚠️ ${worldKey} health=${health} — buckets: 3min=${buckets[3] ?? 0}, 5min=${buckets[5] ?? 0}, 10min=${buckets[10] ?? 0}`,
    );
  }

  return { worldKey, category, expired, promoted, removed, shelfSize, health, buckets };
}

// ─── Refresh all worlds ─────────────────────────────────────

export async function refreshAllShelves(): Promise<ShelfRefreshResult[]> {
  const worldKeys = Object.keys(WORLD_BREAK_PROFILES);
  const results: ShelfRefreshResult[] = [];

  for (const worldKey of worldKeys) {
    for (const category of ALL_CATEGORIES) {
      try {
        const result = await refreshShelf(worldKey, category);
        results.push(result);
      } catch (err) {
        console.error(`[breaks/shelf] error refreshing ${worldKey}/${category}:`, err);
        results.push({
          worldKey,
          category,
          expired: 0,
          promoted: 0,
          removed: 0,
          shelfSize: -1,
          health: "empty",
          buckets: { 3: 0, 5: 0, 10: 0 },
        });
      }
    }
  }

  return results;
}
