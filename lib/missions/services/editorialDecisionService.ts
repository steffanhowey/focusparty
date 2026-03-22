import { randomUUID } from "crypto";
import { PROTOTYPE_MISSION_FAMILIES } from "@/lib/missions/config/missionFamilies";
import { buildEditorialKey } from "@/lib/missions/keys/editorialKey";
import { createMissionEditorialDecision } from "@/lib/missions/repositories/editorialDecisionRepo";
import { listActiveMissionBriefsByEditorialKey } from "@/lib/missions/repositories/missionBriefRepo";
import type { MissionEditorialDecision } from "@/lib/missions/types/editorialDecision";
import type {
  FluencyLevel,
  MissionEvaluationMode,
  MissionFamily,
  ProfessionalFunction,
} from "@/lib/missions/types/common";
import type { SourcePacket } from "@/lib/missions/types/sourcePacket";

export interface EditorialDecisionOptions {
  professionalFunction: ProfessionalFunction;
  fluencyLevel: FluencyLevel;
  evaluationMode: MissionEvaluationMode;
  familyScope?: MissionFamily[];
  prototypeCalibrationTopicSlugs?: string[];
}

/** Create and persist the explicit editorial decision for a packet. */
export async function decideMissionEditorial(
  packet: SourcePacket,
  options: EditorialDecisionOptions,
): Promise<MissionEditorialDecision> {
  const editorialKey = buildEditorialKey({
    topicSlug: packet.topic.topicSlug,
    professionalFunction: options.professionalFunction,
    fluencyLevel: options.fluencyLevel,
  });
  const activeBriefs =
    options.evaluationMode === "benchmark"
      ? []
      : await listActiveMissionBriefsByEditorialKey(editorialKey);
  const recommendedLaunchDomains = [
    ...new Set(
      packet.marketerRelevanceHints
        .filter((hint) => hint.missionable)
        .map((hint) => hint.launchDomain),
    ),
  ];
  const recommendedFamilyScope =
    options.familyScope && options.familyScope.length > 0
      ? options.familyScope
      : PROTOTYPE_MISSION_FAMILIES;
  const editorialPriority = computeEditorialPriority(packet);
  const prototypeCalibrationEligible =
    options.evaluationMode === "prototype" &&
    packet.readiness.state === "mission_ready" &&
    activeBriefs.length === 0 &&
    (options.prototypeCalibrationTopicSlugs ?? []).includes(packet.topic.topicSlug);

  let decision: MissionEditorialDecision["decision"];
  let rationale: string;
  let blockedByMissionBriefId: string | null = null;
  let supersedeMissionBriefId: string | null = null;

  if (packet.status === "rejected") {
    decision = "reject";
    rationale = "Packet was rejected during readiness evaluation.";
  } else if (packet.readiness.state !== "mission_ready") {
    decision = packet.readiness.state === "watchlist_only" ? "hold" : "not_priority_yet";
    rationale = packet.readiness.rationale;
  } else if (options.evaluationMode === "benchmark") {
    decision = "generate_now";
    rationale =
      "Benchmark mode override: mission-ready packet forced into generation for calibration.";
  } else if (
    activeBriefs.some((brief) => brief.topic.sourcePacketHash === packet.packetHash)
  ) {
    decision = "duplicate_active";
    blockedByMissionBriefId =
      activeBriefs.find((brief) => brief.topic.sourcePacketHash === packet.packetHash)?.missionId ??
      null;
    rationale = "An active brief already exists for this exact source packet and editorial scope.";
  } else if (activeBriefs.length > 0 && editorialPriority >= 60) {
    decision = "supersede_existing";
    supersedeMissionBriefId = activeBriefs[0]?.missionId ?? null;
    rationale =
      "A newer mission-ready packet deserves a superseding brief for this editorial scope.";
  } else if (recommendedLaunchDomains.length === 0) {
    decision = "reject";
    rationale = "No concrete launch-domain or marketer relevance signal is strong enough yet.";
  } else if (prototypeCalibrationEligible) {
    decision = "generate_now";
    rationale =
      "Prototype calibration override: mission-ready packet allowed to advance once for the active prototype topic set.";
  } else if (
    editorialPriority >= 65 ||
    (packet.sourceWindow.timelinessClass === "breaking-update" && editorialPriority >= 50)
  ) {
    decision = "generate_now";
    rationale =
      "Packet is mission-ready and clears the editorial priority bar for immediate generation.";
  } else {
    decision = "not_priority_yet";
    rationale = "Packet is mission-ready in principle but below the current editorial priority bar.";
  }

  return createMissionEditorialDecision({
    id: randomUUID(),
    sourcePacketId: packet.packetId,
    editorialKey,
    professionalFunction: options.professionalFunction,
    fluencyLevel: options.fluencyLevel,
    decision,
    editorialPriority,
    recommendedLaunchDomains,
    recommendedFamilyScope,
    blockedByMissionBriefId,
    supersedeMissionBriefId,
    rationale,
    decisionContext: {
      packet_readiness_state: packet.readiness.state,
      timeliness_class: packet.sourceWindow.timelinessClass,
      missionable_hint_count: packet.marketerRelevanceHints.filter((hint) => hint.missionable).length,
      active_brief_count: activeBriefs.length,
      benchmark_override: options.evaluationMode === "benchmark",
      prototype_calibration_override: prototypeCalibrationEligible,
    },
    decidedAt: new Date().toISOString(),
    expiresAt: packet.expiresAt,
  });
}

function computeEditorialPriority(packet: SourcePacket): number {
  const freshness = packet.freshness.recencyScore * 0.35;
  const velocity = packet.freshness.velocityScore * 0.15;
  const novelty = packet.freshness.noveltyScore * 0.1;
  const credibility = packet.credibility.overallScore * 0.2;
  const relevance = Math.min(
    100,
    packet.marketerRelevanceHints.filter((hint) => hint.missionable).length * 25,
  ) * 0.2;

  return Math.max(0, Math.min(100, Math.round(freshness + velocity + novelty + credibility + relevance)));
}
