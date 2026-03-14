// ─── Heat Score Engine ──────────────────────────────────────
// Calculates and manages heat scores for topic clusters.
// Pure computation — no LLM calls. Fast and deterministic.

import { createClient } from "@/lib/supabase/admin";
import type { Topic } from "./taxonomy";

// ─── Types ──────────────────────────────────────────────────

export interface TopicCluster {
  id: string;
  topicId: string;
  topic?: Topic;
  heatScore: number;
  signalCount: number;
  velocity: number;
  sourceDiversity: number;
  contentCount: number;
  status: "emerging" | "hot" | "cooling" | "cold";
  firstSeenAt: string;
  peakHeatAt: string | null;
  lastSignalAt: string;
}

// ─── Heat formula weights ───────────────────────────────────

const HEAT_WEIGHTS = {
  signalCount: 0.25,
  velocity: 0.30,
  sourceDiversity: 0.25,
  contentCount: 0.20,
} as const;

// Half-life in days: tools trend faster, techniques are slower
const HALF_LIFE: Record<string, number> = {
  tool: 7,
  technique: 14,
  concept: 14,
  role: 14,
  platform: 10,
};

const DEFAULT_HALF_LIFE = 14;

// ─── Core functions ─────────────────────────────────────────

/**
 * Normalize a value to [0, 1] range, clamped.
 */
function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/**
 * Compute the decay factor based on age and half-life.
 * Returns 1.0 for brand new topics, ~0.5 at half-life, approaching 0 over time.
 */
function computeDecayFactor(ageInDays: number, halfLife: number): number {
  return Math.exp(-0.693 * ageInDays / halfLife);
}

/**
 * Calculate heat score for a specific topic cluster.
 * Queries signals and content to compute all dimensions.
 */
export async function calculateHeatScore(
  clusterId: string,
  topicCategory?: string
): Promise<{
  heatScore: number;
  signalCount: number;
  velocity: number;
  sourceDiversity: number;
  contentCount: number;
}> {
  const supabase = createClient();
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Fetch all signals for this cluster
  const { data: signals } = await supabase
    .from("fp_signals")
    .select("source, engagement_score, created_at")
    .eq("topic_cluster_id", clusterId);

  const allSignals = signals ?? [];
  const signalCount = allSignals.length;

  // Velocity: signals per hour in last 24h
  const recentSignals = allSignals.filter(
    (s) => new Date(s.created_at) >= twentyFourHoursAgo
  );
  const velocity = recentSignals.length / 24;

  // Source diversity: count of unique source types
  const uniqueSources = new Set(allSignals.map((s) => s.source));
  const sourceDiversity = uniqueSources.size;

  // Content count: quality YouTube videos available for this topic
  // Look at fp_break_content_scores with matching topics that scored >= 55
  const { data: cluster } = await supabase
    .from("fp_topic_clusters")
    .select("topic_id, first_seen_at")
    .eq("id", clusterId)
    .single();

  let contentCount = 0;
  if (cluster) {
    // Get the topic slug for this cluster
    const { data: topic } = await supabase
      .from("fp_topic_taxonomy")
      .select("slug")
      .eq("id", cluster.topic_id)
      .single();

    if (topic) {
      const { count } = await supabase
        .from("fp_break_content_scores")
        .select("id", { count: "exact", head: true })
        .gte("taste_score", 55)
        .contains("topics", [topic.slug]);

      contentCount = count ?? 0;
    }
  }

  // Compute age for decay
  const firstSeenAt = cluster?.first_seen_at
    ? new Date(cluster.first_seen_at)
    : now;
  const ageInDays = Math.max(0, (now.getTime() - firstSeenAt.getTime()) / (1000 * 60 * 60 * 24));
  const halfLife = HALF_LIFE[topicCategory ?? ""] ?? DEFAULT_HALF_LIFE;
  const decayFactor = computeDecayFactor(ageInDays, halfLife);

  // Weighted heat score with decay
  const rawHeat =
    normalize(signalCount, 0, 50) * HEAT_WEIGHTS.signalCount +
    normalize(velocity, 0, 5) * HEAT_WEIGHTS.velocity +
    normalize(sourceDiversity, 0, 5) * HEAT_WEIGHTS.sourceDiversity +
    normalize(contentCount, 0, 10) * HEAT_WEIGHTS.contentCount;

  const heatScore = Math.round(rawHeat * decayFactor * 1000) / 1000;

  return { heatScore, signalCount, velocity, sourceDiversity, contentCount };
}

/**
 * Recalculate heat scores for all active (non-cold) clusters.
 * Called by the hourly cron job.
 */
export async function recalculateAllHeatScores(): Promise<{ updated: number }> {
  const supabase = createClient();

  // Fetch all non-cold clusters with their topic category
  const { data: clusters } = await supabase
    .from("fp_topic_clusters")
    .select("id, topic_id")
    .neq("status", "cold");

  if (!clusters || clusters.length === 0) {
    return { updated: 0 };
  }

  // Fetch topic categories in bulk
  const topicIds = [...new Set(clusters.map((c) => c.topic_id))];
  const { data: topics } = await supabase
    .from("fp_topic_taxonomy")
    .select("id, category")
    .in("id", topicIds);

  const categoryMap = new Map<string, string>();
  for (const t of topics ?? []) {
    categoryMap.set(t.id, t.category);
  }

  let updated = 0;

  for (const cluster of clusters) {
    try {
      const category = categoryMap.get(cluster.topic_id);
      const result = await calculateHeatScore(cluster.id, category);

      const updateData: Record<string, unknown> = {
        heat_score: result.heatScore,
        signal_count: result.signalCount,
        velocity: result.velocity,
        source_diversity: result.sourceDiversity,
        content_count: result.contentCount,
        updated_at: new Date().toISOString(),
      };

      // Track peak heat
      const { data: current } = await supabase
        .from("fp_topic_clusters")
        .select("heat_score")
        .eq("id", cluster.id)
        .single();

      if (current && result.heatScore > (current.heat_score ?? 0)) {
        updateData.peak_heat_at = new Date().toISOString();
      }

      await supabase
        .from("fp_topic_clusters")
        .update(updateData)
        .eq("id", cluster.id);

      updated++;
    } catch (err) {
      console.error(`[topics/heatEngine] Error updating cluster ${cluster.id}:`, err);
    }
  }

  return { updated };
}

/**
 * Apply time-based decay by recalculating heat scores.
 * Decay is integrated into calculateHeatScore via the decay factor,
 * so this is equivalent to recalculateAllHeatScores.
 */
export async function applyDecay(): Promise<void> {
  await recalculateAllHeatScores();
}

/**
 * Get topics above a heat threshold, sorted by heat descending.
 */
export async function getHotTopics(
  threshold = 0.2,
  limit = 20
): Promise<TopicCluster[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("fp_topic_clusters")
    .select(`
      *,
      topic:fp_topic_taxonomy(*)
    `)
    .gte("heat_score", threshold)
    .neq("status", "cold")
    .order("heat_score", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[topics/heatEngine] getHotTopics error:", error);
    return [];
  }

  return (data ?? []).map(mapClusterRow);
}

/**
 * Update cluster statuses based on heat score thresholds.
 * >0.8 = hot, 0.5-0.8 = emerging, 0.2-0.5 = cooling, <0.2 = cold
 */
export async function updateClusterStatuses(): Promise<{ updated: number }> {
  const supabase = createClient();

  const { data: clusters } = await supabase
    .from("fp_topic_clusters")
    .select("id, heat_score, status, last_signal_at")
    .neq("status", "cold");

  if (!clusters || clusters.length === 0) return { updated: 0 };

  let updated = 0;

  for (const cluster of clusters) {
    const heat = cluster.heat_score ?? 0;
    let newStatus: string;

    if (heat >= 0.8) {
      newStatus = "hot";
    } else if (heat >= 0.5) {
      newStatus = "emerging";
    } else if (heat >= 0.2) {
      newStatus = "cooling";
    } else {
      newStatus = "cold";
    }

    if (newStatus !== cluster.status) {
      await supabase
        .from("fp_topic_clusters")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", cluster.id);
      updated++;
    }
  }

  return { updated };
}

// ─── Helpers ────────────────────────────────────────────────

function mapClusterRow(row: Record<string, unknown>): TopicCluster {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const topic = row.topic as any;
  return {
    id: row.id as string,
    topicId: row.topic_id as string,
    topic: topic
      ? {
          id: topic.id,
          slug: topic.slug,
          name: topic.name,
          parentId: topic.parent_id ?? null,
          category: topic.category,
          description: topic.description ?? null,
          aliases: topic.aliases ?? [],
          status: topic.status,
        }
      : undefined,
    heatScore: row.heat_score as number,
    signalCount: row.signal_count as number,
    velocity: row.velocity as number,
    sourceDiversity: row.source_diversity as number,
    contentCount: row.content_count as number,
    status: row.status as TopicCluster["status"],
    firstSeenAt: row.first_seen_at as string,
    peakHeatAt: (row.peak_heat_at as string) ?? null,
    lastSignalAt: row.last_signal_at as string,
  };
}
