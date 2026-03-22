import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { getHotTopics } from "@/lib/topics/heatEngine";
import { getTopicBySlug } from "@/lib/topics/taxonomy";
import type { TopicCandidate } from "@/lib/missions/types/sourcePacket";

export interface TopicCandidateResolverInput {
  topicSlugs?: string[];
  limit?: number;
  minHeatScore?: number;
}

interface ClusterRow {
  id: string;
  topic_id: string;
  heat_score: number | null;
}

/** Resolve canonical topic candidates for the prototype or benchmark flows. */
export async function resolveTopicCandidates(
  input: TopicCandidateResolverInput = {},
): Promise<TopicCandidate[]> {
  if (input.topicSlugs?.length) {
    const manualCandidates = await Promise.all(
      input.topicSlugs.map(async (topicSlug) => resolveManualTopicCandidate(topicSlug)),
    );

    return manualCandidates.filter(
      (candidate): candidate is TopicCandidate => candidate !== null,
    );
  }

  const hotTopics = await getHotTopics(input.minHeatScore ?? 0.2, input.limit ?? 3);
  return hotTopics
    .filter((cluster) => cluster.topic)
    .map((cluster) => ({
      topicId: cluster.topicId,
      topicSlug: cluster.topic!.slug,
      topicName: cluster.topic!.name,
      topicCategory: cluster.topic!.category,
      clusterId: cluster.id,
      discoveryReason: "heat" as const,
      signalIds: [],
      heatScoreSnapshot: cluster.heatScore,
      signalCount7d: cluster.signalCount,
      sourceDiversity7d: cluster.sourceDiversity,
    }));
}

async function resolveManualTopicCandidate(
  topicSlug: string,
): Promise<TopicCandidate | null> {
  const topic = await getTopicBySlug(topicSlug);
  if (!topic) return null;

  const admin = createAdminClient();
  const { data: cluster } = await admin
    .from("fp_topic_clusters")
    .select("id, topic_id, heat_score, signal_count, source_diversity")
    .eq("topic_id", topic.id)
    .order("heat_score", { ascending: false })
    .limit(1)
    .maybeSingle<ClusterRow & { signal_count?: number; source_diversity?: number }>();

  return {
    topicId: topic.id,
    topicSlug: topic.slug,
    topicName: topic.name,
    topicCategory: topic.category,
    clusterId: cluster?.id ?? null,
    discoveryReason: "manual_seed",
    signalIds: [],
    heatScoreSnapshot: cluster?.heat_score ?? null,
    signalCount7d: cluster?.signal_count ?? 0,
    sourceDiversity7d: cluster?.source_diversity ?? 0,
  };
}
