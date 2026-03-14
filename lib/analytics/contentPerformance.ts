// ─── Content Performance Aggregator ──────────────────────────
// Rolls up daily engagement metrics from fp_break_engagement
// into fp_content_performance for analytics and calibration.

import { createClient } from "@/lib/supabase/admin";
import type { ContentPerformance } from "@/lib/types";

// ─── Aggregation ────────────────────────────────────────────

/**
 * Aggregate content engagement metrics for a specific date.
 * Groups engagement events by content item → video, computes
 * completion rate and engagement score, upserts into fp_content_performance.
 */
export async function aggregateContentPerformance(
  date?: Date
): Promise<{ processed: number; inserted: number }> {
  const supabase = createClient();
  const targetDate = date ?? new Date(Date.now() - 86400000); // default: yesterday
  const dateStr = targetDate.toISOString().split("T")[0];
  const dayStart = `${dateStr}T00:00:00.000Z`;
  const dayEnd = `${dateStr}T23:59:59.999Z`;

  // Get all engagement events for the target date
  const { data: events, error } = await supabase
    .from("fp_break_engagement")
    .select("content_item_id, event_type, elapsed_seconds")
    .gte("created_at", dayStart)
    .lte("created_at", dayEnd);

  if (error) {
    console.error("[analytics/contentPerformance] query error:", error);
    return { processed: 0, inserted: 0 };
  }

  if (!events || events.length === 0) {
    return { processed: 0, inserted: 0 };
  }

  // Group events by content_item_id
  const grouped = new Map<
    string,
    { starts: number; completions: number; abandonments: number; extensions: number; totalSeconds: number }
  >();

  for (const e of events) {
    const id = e.content_item_id;
    if (!id) continue;
    const bucket = grouped.get(id) ?? {
      starts: 0, completions: 0, abandonments: 0, extensions: 0, totalSeconds: 0,
    };
    if (e.event_type === "started") bucket.starts++;
    else if (e.event_type === "completed") bucket.completions++;
    else if (e.event_type === "abandoned") bucket.abandonments++;
    else if (e.event_type === "extended") bucket.extensions++;
    if (e.elapsed_seconds) bucket.totalSeconds += e.elapsed_seconds;
    grouped.set(id, bucket);
  }

  // Resolve content_item_id → video_url + world_key via shelf items
  const itemIds = [...grouped.keys()];
  const { data: shelfItems } = await supabase
    .from("fp_break_content_items")
    .select("id, video_url, room_world_key, candidate_id")
    .in("id", itemIds);

  if (!shelfItems || shelfItems.length === 0) {
    return { processed: grouped.size, inserted: 0 };
  }

  // Build a map from content_item_id to video identifier + world_key
  const itemMeta = new Map<string, { videoId: string; worldKey: string }>();
  for (const item of shelfItems) {
    // Extract YouTube video ID from URL, or use candidate_id as fallback
    const videoId = extractVideoId(item.video_url) ?? item.candidate_id ?? item.id;
    itemMeta.set(item.id, { videoId, worldKey: item.room_world_key });
  }

  // Aggregate by video_id + world_key (a video can appear in multiple shelf slots)
  const videoAgg = new Map<
    string,
    { videoId: string; worldKey: string; starts: number; completions: number; abandonments: number; extensions: number; totalSeconds: number }
  >();

  for (const [itemId, metrics] of grouped) {
    const meta = itemMeta.get(itemId);
    if (!meta) continue;
    const key = `${meta.videoId}:${meta.worldKey}`;
    const existing = videoAgg.get(key) ?? {
      videoId: meta.videoId, worldKey: meta.worldKey,
      starts: 0, completions: 0, abandonments: 0, extensions: 0, totalSeconds: 0,
    };
    existing.starts += metrics.starts;
    existing.completions += metrics.completions;
    existing.abandonments += metrics.abandonments;
    existing.extensions += metrics.extensions;
    existing.totalSeconds += metrics.totalSeconds;
    videoAgg.set(key, existing);
  }

  // Upsert performance rows
  let inserted = 0;
  for (const agg of videoAgg.values()) {
    const completionRate = agg.starts > 0 ? agg.completions / agg.starts : 0;
    const extensionRate = agg.starts > 0 ? agg.extensions / agg.starts : 0;
    const abandonmentRate = agg.starts > 0 ? agg.abandonments / agg.starts : 0;
    // Engagement score: 0.4 * completion + 0.3 * extension + 0.3 * (1 - abandonment)
    const engagementScore = Math.min(
      1,
      Math.max(0, 0.4 * completionRate + 0.3 * extensionRate + 0.3 * (1 - abandonmentRate))
    );
    const avgWatchSeconds =
      agg.starts > 0 ? agg.totalSeconds / agg.starts : 0;

    const { error: upsertError } = await supabase
      .from("fp_content_performance")
      .upsert(
        {
          video_id: agg.videoId,
          world_key: agg.worldKey,
          period_date: dateStr,
          starts: agg.starts,
          completions: agg.completions,
          abandonments: agg.abandonments,
          extensions: agg.extensions,
          avg_watch_seconds: Math.round(avgWatchSeconds * 100) / 100,
          completion_rate: Math.round(completionRate * 10000) / 10000,
          engagement_score: Math.round(engagementScore * 10000) / 10000,
        },
        { onConflict: "video_id,world_key,period_date" }
      );

    if (upsertError) {
      console.error("[analytics/contentPerformance] upsert error:", upsertError);
    } else {
      inserted++;
    }
  }

  return { processed: grouped.size, inserted };
}

// ─── Query helpers ──────────────────────────────────────────

/**
 * Get aggregated performance summary for a specific video across all dates.
 */
export async function getContentPerformanceSummary(
  videoId: string
): Promise<{
  totalStarts: number;
  totalCompletions: number;
  avgCompletionRate: number;
  avgEngagementScore: number;
  dayCount: number;
}> {
  const supabase = createClient();
  const { data } = await supabase
    .from("fp_content_performance")
    .select("starts, completions, completion_rate, engagement_score")
    .eq("video_id", videoId);

  const rows = data ?? [];
  if (rows.length === 0) {
    return { totalStarts: 0, totalCompletions: 0, avgCompletionRate: 0, avgEngagementScore: 0, dayCount: 0 };
  }

  const totalStarts = rows.reduce((s, r) => s + (r.starts ?? 0), 0);
  const totalCompletions = rows.reduce((s, r) => s + (r.completions ?? 0), 0);
  const avgCompletionRate = rows.reduce((s, r) => s + (r.completion_rate ?? 0), 0) / rows.length;
  const avgEngagementScore = rows.reduce((s, r) => s + (r.engagement_score ?? 0), 0) / rows.length;

  return {
    totalStarts,
    totalCompletions,
    avgCompletionRate: Math.round(avgCompletionRate * 10000) / 10000,
    avgEngagementScore: Math.round(avgEngagementScore * 10000) / 10000,
    dayCount: rows.length,
  };
}

/**
 * Get top-performing content ranked by engagement score.
 */
export async function getTopPerformingContent(options?: {
  worldKey?: string;
  limit?: number;
  daysBack?: number;
}): Promise<ContentPerformance[]> {
  const supabase = createClient();
  const limit = options?.limit ?? 20;
  const daysBack = options?.daysBack ?? 30;
  const cutoff = new Date(Date.now() - daysBack * 86400000).toISOString().split("T")[0];

  let query = supabase
    .from("fp_content_performance")
    .select("*")
    .gte("period_date", cutoff)
    .gt("starts", 0)
    .order("engagement_score", { ascending: false })
    .limit(limit);

  if (options?.worldKey) {
    query = query.eq("world_key", options.worldKey);
  }

  const { data } = await query;
  return (data ?? []).map(mapPerformanceRow);
}

/**
 * Get underperforming content: low completion rate despite reasonable starts.
 */
export async function getUnderperformingContent(options?: {
  worldKey?: string;
  limit?: number;
  daysBack?: number;
  minStarts?: number;
}): Promise<ContentPerformance[]> {
  const supabase = createClient();
  const limit = options?.limit ?? 20;
  const daysBack = options?.daysBack ?? 30;
  const minStarts = options?.minStarts ?? 5;
  const cutoff = new Date(Date.now() - daysBack * 86400000).toISOString().split("T")[0];

  let query = supabase
    .from("fp_content_performance")
    .select("*")
    .gte("period_date", cutoff)
    .gte("starts", minStarts)
    .order("completion_rate", { ascending: true })
    .limit(limit);

  if (options?.worldKey) {
    query = query.eq("world_key", options.worldKey);
  }

  const { data } = await query;
  return (data ?? []).map(mapPerformanceRow);
}

// ─── Helpers ────────────────────────────────────────────────

/** Extract YouTube video ID from a URL */
function extractVideoId(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/(?:v=|\/embed\/|\.be\/|\/v\/)([a-zA-Z0-9_-]{11})/);
  return match?.[1] ?? null;
}

function mapPerformanceRow(row: Record<string, unknown>): ContentPerformance {
  return {
    id: row.id as string,
    videoId: row.video_id as string,
    worldKey: row.world_key as string,
    periodDate: row.period_date as string,
    impressions: (row.impressions as number) ?? 0,
    starts: (row.starts as number) ?? 0,
    completions: (row.completions as number) ?? 0,
    abandonments: (row.abandonments as number) ?? 0,
    extensions: (row.extensions as number) ?? 0,
    avgWatchSeconds: Number(row.avg_watch_seconds ?? 0),
    completionRate: Number(row.completion_rate ?? 0),
    engagementScore: Number(row.engagement_score ?? 0),
  };
}
