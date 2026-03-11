// ─── Break Content Shelf Manager ────────────────────────────
// Maintains a living editorial shelf of 5–8 curated items per
// room world. Promotes top-scored candidates, expires stale
// content, enforces diversity, learns from engagement, and
// respects pinned items.

import { createClient } from "@/lib/supabase/admin";
import { WORLD_SEARCH_PROFILES } from "./searchProfiles";

// ─── Constants ──────────────────────────────────────────────

const SHELF_MIN = 5;
const SHELF_MAX = 8;
const SHELF_TTL_DAYS = 7;
const MIN_TASTE_SCORE = 70;
const MAX_PER_CREATOR = 2;

// ─── Types ──────────────────────────────────────────────────

interface ShelfRefreshResult {
  worldKey: string;
  expired: number;
  promoted: number;
  removed: number;
  shelfSize: number;
}

// ─── Engagement-based score adjustments ─────────────────────

/**
 * Adjust taste_score on active shelf items based on user engagement.
 * - completion_rate > 70% → +10 boost
 * - abandon_rate > 60% → -15 penalty
 */
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
    if (started === 0) continue; // No engagement data

    const completionRate = (completedCount ?? 0) / started;
    const abandonRate = (abandonedCount ?? 0) / started;

    let adjustment = 0;
    if (completionRate > 0.7) adjustment = 10;
    else if (abandonRate > 0.6) adjustment = -15;

    if (adjustment !== 0) {
      const newScore = Math.min(
        100,
        Math.max(0, (item.taste_score ?? 0) + adjustment)
      );
      await supabase
        .from("fp_break_content_items")
        .update({ taste_score: newScore })
        .eq("id", item.id);

      console.log(
        `[breaks/shelf] ${worldKey}: adjusted item ${item.id} by ${adjustment > 0 ? "+" : ""}${adjustment} (completion=${(completionRate * 100).toFixed(0)}%, abandon=${(abandonRate * 100).toFixed(0)}%)`
      );
    }
  }
}

// ─── Core: refresh a single world's shelf ───────────────────

export async function refreshShelf(
  worldKey: string
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

  // 2. Count remaining active items
  const { data: currentShelf } = await supabase
    .from("fp_break_content_items")
    .select("id, taste_score, pinned, source_name")
    .eq("room_world_key", worldKey)
    .eq("status", "active")
    .order("taste_score", { ascending: false, nullsFirst: false });

  let shelfSize = currentShelf?.length ?? 0;

  // 3. Promote candidates if below minimum
  let promoted = 0;
  if (shelfSize < SHELF_MIN) {
    const needed = SHELF_MAX - shelfSize;

    // Build creator count map from current shelf (for diversity)
    const creatorCounts = new Map<string, number>();
    for (const item of currentShelf ?? []) {
      const name = (item.source_name ?? "").toLowerCase();
      if (name) {
        creatorCounts.set(name, (creatorCounts.get(name) ?? 0) + 1);
      }
    }

    // Get top-scored evaluated candidates not yet promoted
    const { data: topCandidates } = await supabase
      .from("fp_break_content_scores")
      .select("*, candidate:fp_break_content_candidates(*)")
      .eq("world_key", worldKey)
      .order("taste_score", { ascending: false })
      .limit(needed * 3); // Fetch extra to account for filtering

    if (topCandidates) {
      // Filter: evaluated status + minimum score + creator diversity
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const eligible = topCandidates.filter((s: any) => {
        if (s.candidate?.status !== "evaluated") return false;
        if (s.taste_score < MIN_TASTE_SCORE) return false;

        // Creator diversity: max 2 per creator
        const creatorName = (s.candidate?.creator ?? "").toLowerCase();
        if (creatorName) {
          const count = creatorCounts.get(creatorName) ?? 0;
          if (count >= MAX_PER_CREATOR) return false;
          creatorCounts.set(creatorName, count + 1);
        }

        return true;
      });

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + SHELF_TTL_DAYS);

      for (const scored of eligible.slice(0, needed)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c = scored.candidate as any;
        if (!c) continue;

        // Fetch editorial note from score record
        const editorialNote = scored.editorial_note ?? null;

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
            editorial_note: editorialNote,
          });

        if (insertErr) {
          console.error("[breaks/shelf] promote insert error:", insertErr);
          continue;
        }

        // Mark candidate as promoted
        await supabase
          .from("fp_break_content_candidates")
          .update({ status: "promoted" })
          .eq("id", c.id);

        promoted++;
      }
    }

    shelfSize += promoted;
    console.log(
      `[breaks/shelf] ${worldKey}: promoted ${promoted} candidates`
    );
  }

  // 4. Trim shelf if over max (remove lowest-scored non-pinned)
  let removed = 0;
  if (shelfSize > SHELF_MAX) {
    const { data: allActive } = await supabase
      .from("fp_break_content_items")
      .select("id, taste_score, pinned")
      .eq("room_world_key", worldKey)
      .eq("status", "active")
      .order("taste_score", { ascending: true, nullsFirst: true });

    if (allActive) {
      const removable = allActive.filter((i) => !i.pinned);
      const toRemove = removable.slice(0, shelfSize - SHELF_MAX);

      if (toRemove.length > 0) {
        const ids = toRemove.map((i) => i.id);
        await supabase
          .from("fp_break_content_items")
          .update({ status: "expired" })
          .in("id", ids);
        removed = ids.length;
        shelfSize -= removed;
        console.log(
          `[breaks/shelf] ${worldKey}: removed ${removed} low-scored items`
        );
      }
    }
  }

  // 5. Update sort_order based on taste_score ranking
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
