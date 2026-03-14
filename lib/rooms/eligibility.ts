// ─── Room Auto-Generation Eligibility ─────────────────────────
// Gatekeeper that determines whether a topic qualifies for
// auto room generation. Includes overlap and duplicate detection.

import { createClient } from "@/lib/supabase/admin";
import type { TopicCluster } from "@/lib/topics/heatEngine";

// ─── Types ──────────────────────────────────────────────────

export interface EligibilityConfig {
  heatThreshold: number;
  minScoredCandidates: number;
  minScaffoldedCandidates: number;
  minUniqueCreators: number;
  minTasteScore: number;
  cooldownHours: number;
  contentOverlapThreshold: number;
}

export interface EligibilityResult {
  eligible: boolean;
  topicSlug: string;
  topicName: string;
  clusterId: string;
  heatScore: number;
  reason: string;
  scoredCandidateCount: number;
  scaffoldedCount: number;
  uniqueCreatorCount: number;
}

const DEFAULT_CONFIG: EligibilityConfig = {
  heatThreshold: 0.8,
  minScoredCandidates: 3,
  minScaffoldedCandidates: 2,
  minUniqueCreators: 2,
  minTasteScore: 55,
  cooldownHours: 48,
  contentOverlapThreshold: 0.5,
};

// ─── Core ───────────────────────────────────────────────────

/**
 * Check whether a topic cluster is eligible for auto room generation.
 * Runs checks in order, short-circuiting on first failure.
 */
export async function checkEligibility(
  clusterId: string,
  config?: Partial<EligibilityConfig>
): Promise<EligibilityResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const supabase = createClient();

  // 1. Fetch cluster + topic
  const { data: cluster, error: clusterError } = await supabase
    .from("fp_topic_clusters")
    .select(`
      id, topic_id, heat_score, status,
      topic:fp_topic_taxonomy(id, slug, name, category)
    `)
    .eq("id", clusterId)
    .single();

  if (clusterError || !cluster) {
    return fail(clusterId, "", "", 0, `Cluster not found: ${clusterId}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const topic = cluster.topic as any;
  const topicSlug: string = topic?.slug ?? "";
  const topicName: string = topic?.name ?? "";
  const heatScore: number = cluster.heat_score ?? 0;

  if (!topicSlug) {
    return fail(clusterId, topicSlug, topicName, heatScore, "No topic linked to cluster");
  }

  // 2. Heat score check
  if (heatScore < cfg.heatThreshold) {
    return fail(
      clusterId, topicSlug, topicName, heatScore,
      `Heat score ${heatScore.toFixed(3)} below threshold ${cfg.heatThreshold}`
    );
  }

  // 3. Count scored candidates with matching topic
  const { data: scoredRows } = await supabase
    .from("fp_break_content_scores")
    .select(`
      id,
      candidate_id,
      taste_score,
      scaffolding_status,
      candidate:fp_break_content_candidates!inner(channel_id, external_id)
    `)
    .gte("taste_score", cfg.minTasteScore)
    .contains("topics", [topicSlug]);

  const scored = scoredRows ?? [];
  const scoredCandidateCount = scored.length;

  if (scoredCandidateCount < cfg.minScoredCandidates) {
    return fail(
      clusterId, topicSlug, topicName, heatScore,
      `Only ${scoredCandidateCount} scored candidates (need ${cfg.minScoredCandidates})`,
      scoredCandidateCount
    );
  }

  // 4. Count scaffolded
  const scaffoldedCount = scored.filter(
    (s) => s.scaffolding_status === "complete"
  ).length;

  if (scaffoldedCount < cfg.minScaffoldedCandidates) {
    return fail(
      clusterId, topicSlug, topicName, heatScore,
      `Only ${scaffoldedCount} scaffolded candidates (need ${cfg.minScaffoldedCandidates})`,
      scoredCandidateCount, scaffoldedCount
    );
  }

  // 5. Count unique creators
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelIds = new Set(scored.map((s) => (s.candidate as any)?.channel_id).filter(Boolean));
  const uniqueCreatorCount = channelIds.size;

  if (uniqueCreatorCount < cfg.minUniqueCreators) {
    return fail(
      clusterId, topicSlug, topicName, heatScore,
      `Only ${uniqueCreatorCount} unique creators (need ${cfg.minUniqueCreators})`,
      scoredCandidateCount, scaffoldedCount, uniqueCreatorCount
    );
  }

  // 6. No existing active/waiting room with same topic_slug
  const { count: existingRoomCount } = await supabase
    .from("fp_parties")
    .select("id", { count: "exact", head: true })
    .eq("topic_slug", topicSlug)
    .in("status", ["waiting", "active"])
    .eq("persistent", true);

  if ((existingRoomCount ?? 0) > 0) {
    return fail(
      clusterId, topicSlug, topicName, heatScore,
      `Active/waiting room already exists for topic "${topicSlug}"`,
      scoredCandidateCount, scaffoldedCount, uniqueCreatorCount
    );
  }

  // 7. Content overlap check with provisioned blueprints
  const { data: provisionedBlueprints } = await supabase
    .from("fp_room_blueprints")
    .select("id, content_selection")
    .eq("status", "provisioned")
    .eq("generation_source", "auto")
    .not("content_selection", "is", null);

  if (provisionedBlueprints && provisionedBlueprints.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentVideoIds = new Set(scored.map((s) => (s.candidate as any)?.external_id).filter(Boolean));

    for (const bp of provisionedBlueprints) {
      const bpSelection = bp.content_selection as { videoIds?: string[] } | null;
      const bpVideoIds = bpSelection?.videoIds ?? [];
      if (bpVideoIds.length === 0) continue;

      const overlap = computeJaccard(currentVideoIds, new Set(bpVideoIds));
      if (overlap > cfg.contentOverlapThreshold) {
        return fail(
          clusterId, topicSlug, topicName, heatScore,
          `Content overlap ${(overlap * 100).toFixed(0)}% with blueprint ${bp.id} exceeds ${(cfg.contentOverlapThreshold * 100).toFixed(0)}% threshold`,
          scoredCandidateCount, scaffoldedCount, uniqueCreatorCount
        );
      }
    }
  }

  // 8. Cooldown check — no rejected/expired auto blueprint in last N hours
  const cooldownCutoff = new Date(
    Date.now() - cfg.cooldownHours * 60 * 60 * 1000
  ).toISOString();

  const { count: recentFailedCount } = await supabase
    .from("fp_room_blueprints")
    .select("id", { count: "exact", head: true })
    .eq("generation_source", "auto")
    .eq("topic_slug", topicSlug)
    .in("review_status", ["rejected", "expired"])
    .gte("created_at", cooldownCutoff);

  if ((recentFailedCount ?? 0) > 0) {
    return fail(
      clusterId, topicSlug, topicName, heatScore,
      `Recent rejected/expired auto-gen for "${topicSlug}" (${cfg.cooldownHours}h cooldown)`,
      scoredCandidateCount, scaffoldedCount, uniqueCreatorCount
    );
  }

  // All checks passed
  return {
    eligible: true,
    topicSlug,
    topicName,
    clusterId,
    heatScore,
    reason: "All eligibility checks passed",
    scoredCandidateCount,
    scaffoldedCount,
    uniqueCreatorCount,
  };
}

/**
 * Check eligibility for multiple clusters.
 */
export async function checkBatchEligibility(
  clusterIds: string[],
  config?: Partial<EligibilityConfig>
): Promise<EligibilityResult[]> {
  const results: EligibilityResult[] = [];
  for (const id of clusterIds) {
    try {
      const result = await checkEligibility(id, config);
      results.push(result);
    } catch (err) {
      console.error(`[rooms/eligibility] Error checking cluster ${id}:`, err);
      results.push(fail(id, "", "", 0, `Error: ${err instanceof Error ? err.message : "unknown"}`));
    }
  }
  return results;
}

// ─── Helpers ────────────────────────────────────────────────

/** Compute Jaccard similarity between two sets. */
function computeJaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Build a failed EligibilityResult. */
function fail(
  clusterId: string,
  topicSlug: string,
  topicName: string,
  heatScore: number,
  reason: string,
  scoredCandidateCount = 0,
  scaffoldedCount = 0,
  uniqueCreatorCount = 0
): EligibilityResult {
  return {
    eligible: false,
    topicSlug,
    topicName,
    clusterId,
    heatScore,
    reason,
    scoredCandidateCount,
    scaffoldedCount,
    uniqueCreatorCount,
  };
}
