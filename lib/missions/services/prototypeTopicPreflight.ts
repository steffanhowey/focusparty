import {
  previewTopicCandidatePool,
  type CandidatePoolPreview,
} from "@/lib/missions/services/sourcePacketAssembler";
import type { TopicCandidate } from "@/lib/missions/types/sourcePacket";

export interface PrototypeTopicPreflightResult {
  passed: boolean;
  failureReasons: string[];
  candidateCount: number;
  authoritativeCandidateCount: number;
  coherentSecondaryCount: number;
  coherenceScore: number;
  workflowSurfaceCount: number;
  genericTutorialCount: number;
}

/** Evaluate whether a topic has a credible, coherent enough source pool for prototype assembly. */
export async function preflightPrototypeTopicCandidate(
  candidate: TopicCandidate,
): Promise<PrototypeTopicPreflightResult> {
  const preview = await previewTopicCandidatePool(candidate);
  return buildPrototypeTopicPreflightResult(candidate, preview);
}

export function buildPrototypeTopicPreflightResult(
  candidate: TopicCandidate,
  preview: CandidatePoolPreview,
): PrototypeTopicPreflightResult {
  const topCandidates = preview.rankedCandidates.slice(0, 5);
  const candidateCount = preview.rankedCandidates.length;
  const authoritativeCandidateCount = topCandidates.filter(
    (candidateItem) => candidateItem.authority.authoritySourceType !== "community",
  ).length;
  const coherentCandidateCount = topCandidates.filter(
    (candidateItem) => candidateItem.coherenceScore > 0,
  ).length;
  const coherentSecondaryCount = topCandidates.filter(
    (candidateItem) =>
      candidateItem.coherenceScore > 0 &&
      candidateItem.authority.authoritySourceType === "community",
  ).length;
  const genericTutorialCount = topCandidates.filter(
    (candidateItem) => candidateItem.genericTutorial,
  ).length;
  const workflowSurfaceCount = new Set(
    topCandidates.map((candidateItem) => candidateItem.workflowSurface).filter(
      (surface) => surface !== "generic",
    ),
  ).size;
  const coherenceScore =
    topCandidates.length > 0 ? coherentCandidateCount / Math.min(topCandidates.length, 5) : 0;
  const broadSlugShape = candidate.topicSlug.split("-").length <= 1;
  const isUmbrellaTopic =
    (candidate.topicCategory === "tool" || candidate.topicCategory === "platform") &&
    (coherenceScore < 0.6 || broadSlugShape) &&
    workflowSurfaceCount > 1;
  const failureReasons: string[] = [];

  if (candidate.topicCategory === "role") {
    failureReasons.push("role_topic_not_allowed");
  }
  if (candidateCount < 3) {
    failureReasons.push("insufficient_candidate_count");
  }
  if (authoritativeCandidateCount < 1) {
    failureReasons.push("missing_authoritative_candidate");
  }
  if (coherentSecondaryCount < 2) {
    failureReasons.push("insufficient_coherent_secondary_sources");
  }
  if (coherenceScore < 0.6) {
    failureReasons.push("low_candidate_coherence");
  }
  if (isUmbrellaTopic) {
    failureReasons.push("umbrella_topic_shape");
  }

  return {
    passed: failureReasons.length === 0,
    failureReasons,
    candidateCount,
    authoritativeCandidateCount,
    coherentSecondaryCount,
    coherenceScore: Math.round(coherenceScore * 100) / 100,
    workflowSurfaceCount,
    genericTutorialCount,
  };
}
