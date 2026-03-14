// ─── User Taste Profile Engine ──────────────────────────────
// Learns user preferences from break engagement signals.
// Updates per-topic weights that personalize content ordering.
//
// Signal weights:
//   completed / extended  → +0.15 per topic
//   abandoned (< 30%)     → -0.10 per topic
//   started (no follow-up)→  neutral (no update)
//
// Weights are clamped to [-1.0, 1.0] and decay toward 0
// over time so stale preferences don't dominate.

import { createClient } from "@/lib/supabase/admin";

// ─── Constants ──────────────────────────────────────────────

const POSITIVE_DELTA = 0.15;
const NEGATIVE_DELTA = -0.10;
const WEIGHT_MIN = -1.0;
const WEIGHT_MAX = 1.0;
const DECAY_FACTOR = 0.95; // applied per refresh cycle to all weights

// ─── Types ──────────────────────────────────────────────────

export interface TasteWeight {
  topic: string;
  weight: number;
  interactions: number;
}

// ─── Read a user's taste profile ────────────────────────────

export async function getUserTasteProfile(
  userId: string,
  worldKey: string
): Promise<Map<string, TasteWeight>> {
  const supabase = createClient();

  const { data } = await supabase
    .from("fp_user_taste_profiles")
    .select("topic, weight, interactions")
    .eq("user_id", userId)
    .eq("world_key", worldKey);

  const profile = new Map<string, TasteWeight>();
  for (const row of data ?? []) {
    profile.set(row.topic, {
      topic: row.topic,
      weight: row.weight,
      interactions: row.interactions,
    });
  }
  return profile;
}

// ─── Update taste profile from recent engagement ────────────

/**
 * Process unprocessed engagement events for a user and update
 * their taste profile weights. Call this after a break ends
 * or during shelf refresh.
 */
export async function updateTasteProfile(
  userId: string,
  worldKey: string
): Promise<{ updated: number }> {
  const supabase = createClient();

  // Get the user's last profile update timestamp
  const { data: latestProfile } = await supabase
    .from("fp_user_taste_profiles")
    .select("updated_at")
    .eq("user_id", userId)
    .eq("world_key", worldKey)
    .order("updated_at", { ascending: false })
    .limit(1);

  const since = latestProfile?.[0]?.updated_at ?? "2000-01-01T00:00:00Z";

  // Fetch engagement events since last update, joined with content items for topics
  const { data: events } = await supabase
    .from("fp_break_engagement")
    .select("event_type, elapsed_seconds, content_item_id, created_at")
    .eq("user_id", userId)
    .gt("created_at", since)
    .in("event_type", ["completed", "extended", "abandoned"])
    .order("created_at", { ascending: true });

  if (!events || events.length === 0) return { updated: 0 };

  // Fetch topics for each engaged content item
  const itemIds = [...new Set(events.map((e) => e.content_item_id))];
  const { data: items } = await supabase
    .from("fp_break_content_items")
    .select("id, topics, duration_seconds, room_world_key")
    .in("id", itemIds);

  const itemMap = new Map(
    (items ?? []).map((i) => [i.id, i])
  );

  // Compute topic deltas
  const deltas = new Map<string, { delta: number; count: number }>();

  for (const event of events) {
    const item = itemMap.get(event.content_item_id);
    if (!item || !item.topics || item.room_world_key !== worldKey) continue;

    let delta = 0;

    if (event.event_type === "completed" || event.event_type === "extended") {
      delta = POSITIVE_DELTA;
      if (event.event_type === "extended") delta *= 1.5; // extra signal
    } else if (event.event_type === "abandoned") {
      // Only penalize if they watched less than 30% of the segment
      const durationSec = item.duration_seconds ?? 300;
      const elapsed = event.elapsed_seconds ?? 0;
      if (elapsed / durationSec < 0.3) {
        delta = NEGATIVE_DELTA;
      }
      // Else: they watched a decent chunk, treat as neutral
    }

    if (delta === 0) continue;

    for (const topic of item.topics) {
      const existing = deltas.get(topic) ?? { delta: 0, count: 0 };
      existing.delta += delta;
      existing.count += 1;
      deltas.set(topic, existing);
    }
  }

  // ── Scaffolding engagement bonus deltas ──────────────────
  // Query scaffolding events for items the user engaged with
  try {
    const { data: scaffoldingEvents } = await supabase
      .from("fp_scaffolding_events")
      .select("event_type, content_item_id")
      .eq("user_id", userId)
      .gt("created_at", since)
      .in("event_type", [
        "exercise_completed",
        "pre_watch_attempted",
        "comprehension_rewatch",
        "discussion_shared",
        "exercise_skipped",
        "post_watch_auto_dismissed",
      ]);

    if (scaffoldingEvents && scaffoldingEvents.length > 0) {
      const SCAFFOLDING_DELTAS: Record<string, number> = {
        exercise_completed: 0.10,
        pre_watch_attempted: 0.05,
        comprehension_rewatch: 0.05,
        discussion_shared: 0.05,
        exercise_skipped: -0.05,
        post_watch_auto_dismissed: -0.05,
      };

      // Fetch topics for any scaffolding items not already in itemMap
      const scaffoldingItemIds = [
        ...new Set(
          scaffoldingEvents
            .map((e) => e.content_item_id)
            .filter((id) => !itemMap.has(id))
        ),
      ];
      if (scaffoldingItemIds.length > 0) {
        const { data: extraItems } = await supabase
          .from("fp_break_content_items")
          .select("id, topics, duration_seconds, room_world_key")
          .in("id", scaffoldingItemIds);
        for (const i of extraItems ?? []) {
          itemMap.set(i.id, i);
        }
      }

      for (const event of scaffoldingEvents) {
        const item = itemMap.get(event.content_item_id);
        if (!item || !item.topics || item.room_world_key !== worldKey) continue;

        const delta = SCAFFOLDING_DELTAS[event.event_type] ?? 0;
        if (delta === 0) continue;

        for (const topic of item.topics) {
          const existing = deltas.get(topic) ?? { delta: 0, count: 0 };
          existing.delta += delta;
          existing.count += 1;
          deltas.set(topic, existing);
        }
      }
    }
  } catch (err) {
    console.error("[tasteProfile] Scaffolding events query failed:", err);
    // Continue with base taste update — scaffolding is additive
  }

  if (deltas.size === 0) return { updated: 0 };

  // Load current profile
  const profile = await getUserTasteProfile(userId, worldKey);

  // Apply deltas + upsert
  const now = new Date().toISOString();
  let updated = 0;

  for (const [topic, { delta, count }] of deltas) {
    const existing = profile.get(topic);
    const currentWeight = existing?.weight ?? 0;
    const currentInteractions = existing?.interactions ?? 0;

    const newWeight = Math.min(
      WEIGHT_MAX,
      Math.max(WEIGHT_MIN, currentWeight + delta)
    );

    const { error } = await supabase
      .from("fp_user_taste_profiles")
      .upsert(
        {
          user_id: userId,
          world_key: worldKey,
          topic,
          weight: Math.round(newWeight * 1000) / 1000,
          interactions: currentInteractions + count,
          updated_at: now,
        },
        { onConflict: "user_id,world_key,topic" }
      );

    if (!error) updated++;
  }

  return { updated };
}

// ─── Decay stale weights ────────────────────────────────────

/**
 * Apply time decay to all weights for a user+world.
 * Call during periodic maintenance (e.g., shelf refresh).
 * Weights below ±0.02 after decay are zeroed out.
 */
export async function decayTasteWeights(
  userId: string,
  worldKey: string
): Promise<void> {
  const supabase = createClient();

  const { data: rows } = await supabase
    .from("fp_user_taste_profiles")
    .select("id, weight")
    .eq("user_id", userId)
    .eq("world_key", worldKey);

  if (!rows || rows.length === 0) return;

  for (const row of rows) {
    const decayed = row.weight * DECAY_FACTOR;
    const finalWeight = Math.abs(decayed) < 0.02 ? 0 : decayed;

    if (finalWeight !== row.weight) {
      await supabase
        .from("fp_user_taste_profiles")
        .update({
          weight: Math.round(finalWeight * 1000) / 1000,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
    }
  }
}

// ─── Score content items for a user ─────────────────────────

/**
 * Compute personalized scores for a set of content items.
 * Returns items sorted by personal_score (taste_score + topic bonus).
 */
export function personalizeContentOrder<
  T extends { taste_score: number | null; topics: string[] | null }
>(items: T[], profile: Map<string, TasteWeight>): T[] {
  if (profile.size === 0) return items; // no profile = default order

  const scored = items.map((item) => {
    const tasteScore = item.taste_score ?? 0;
    let topicBonus = 0;

    if (item.topics) {
      for (const topic of item.topics) {
        const tw = profile.get(topic);
        if (tw) topicBonus += tw.weight * 10; // scale weight to score space
      }
    }

    return { item, personalScore: tasteScore + topicBonus };
  });

  scored.sort((a, b) => b.personalScore - a.personalScore);
  return scored.map((s) => s.item);
}
