import type { SourcePacket } from "@/lib/missions/types/sourcePacket";

/** Evaluate whether a source packet is tracking-only, watchlist-only, or mission-ready. */
export function evaluateSourcePacketReadiness(packet: SourcePacket): SourcePacket {
  const updated = structuredClone(packet);
  const rejectReasons = new Set(updated.quality.rejectReasons);
  const reviewerNotes = new Set(updated.quality.reviewerNotes);
  const blockers: SourcePacket["readiness"]["blockers"] = [];
  const diagnostics = updated.quality.diagnostics;

  const sourceCount = updated.sourceItems.length;
  const claimCount = updated.keyClaims.length;
  const missionableHintCount = updated.marketerRelevanceHints.filter((hint) => hint.missionable).length;
  const hasWhyNow = updated.whyNow.summary.trim().length > 0;
  const hasMaterialContradiction = updated.contradictions.some(
    (item) => item.severity === "material" && item.resolutionStatus === "unresolved",
  );
  const expired = new Date(updated.expiresAt).getTime() <= Date.now();

  if (sourceCount < 2) {
    blockers.push({
      code: "thin_evidence",
      detail: "Fewer than two usable sources were assembled for this topic.",
    });
    rejectReasons.add("insufficient_source_count");
  }

  if (!hasWhyNow) {
    rejectReasons.add("missing_why_now");
  }

  if (updated.credibility.highCredibilitySourceCount === 0) {
    blockers.push({
      code: "missing_high_credibility_source",
      detail: "The packet does not yet contain a source that clears the high-credibility bar.",
    });
    rejectReasons.add("low_credibility_source_base");
  }

  if ((diagnostics?.authoritativeSourceCount ?? 0) === 0) {
    blockers.push({
      code: "missing_authoritative_source",
      detail: "No official-domain or exact official-creator source is present in the packet.",
    });
  }

  if (missionableHintCount === 0) {
    blockers.push({
      code: "weak_marketer_use_case",
      detail: "No concrete marketer-native use case could be derived yet.",
    });
    rejectReasons.add("no_missionable_angle");
  }

  if (hasMaterialContradiction) {
    blockers.push({
      code: "contradictory_signals",
      detail: "The packet contains unresolved material contradictions.",
    });
    rejectReasons.add("unresolved_material_contradiction");
  }

  if (expired && updated.sourceWindow.timelinessClass !== "evergreen-foundation") {
    rejectReasons.add("stale_without_evergreen_rationale");
  }

  if ((diagnostics?.coherenceScore ?? 1) < 0.6) {
    blockers.push({
      code: "topic_too_broad_for_packet",
      detail: "The selected source set does not cohere around a single capability or workflow surface yet.",
    });
  }

  if (
    (diagnostics?.genericTutorialCount ?? 0) > 2 ||
    (sourceCount >= 4 && (diagnostics?.uniqueCreatorCount ?? 3) < 3)
  ) {
    blockers.push({
      code: "source_mix_too_homogeneous",
      detail: "The packet is still too dominated by repetitive tutorial-style sources.",
    });
  }

  if (
    updated.sourceWindow.timelinessClass !== "evergreen-foundation" &&
    updated.topic.signalCount7d === 0
  ) {
    blockers.push({
      code: "missing_signal_support_for_timely_topic",
      detail: "The topic looks timely, but the packet lacks supporting cluster or signal evidence.",
    });
  }

  if (
    diagnostics?.analysisMode === "fallback" &&
    updated.whyNow.whatChanged.length < 2
  ) {
    blockers.push({
      code: "weak_why_now_evidence",
      detail: "The why-now framing is still relying on fallback analysis instead of specific source-backed change evidence.",
    });
  }

  if (sourceCount >= 2 && claimCount < 2) {
    reviewerNotes.add("Packet assembled, but claim density is still low.");
  }

  let readinessState: SourcePacket["readiness"]["state"] = "tracking_only";
  if (
    sourceCount >= 3 &&
    claimCount >= 2 &&
    missionableHintCount >= 1 &&
    updated.credibility.highCredibilitySourceCount >= 1 &&
    !hasMaterialContradiction &&
    hasWhyNow &&
    !(expired && updated.sourceWindow.timelinessClass !== "evergreen-foundation")
  ) {
    readinessState = "mission_ready";
  } else if (sourceCount >= 2 && hasWhyNow && !hasMaterialContradiction) {
    readinessState = "watchlist_only";
  }

  updated.readiness = {
    state: readinessState,
    rationale:
      readinessState === "mission_ready"
        ? "Packet has enough source depth, practical marketer relevance, and freshness to generate a mission."
        : readinessState === "watchlist_only"
          ? "Packet is worth monitoring, but it is not yet strong enough for a high-confidence mission."
          : "Packet is worth tracking, but the evidence base is too thin or too unclear for mission generation.",
    blockers,
    nextReviewAt:
      readinessState === "mission_ready"
        ? null
        : new Date(
            Date.now() +
              (readinessState === "watchlist_only" ? 72 : 24) * 60 * 60 * 1000,
          ).toISOString(),
  };

  updated.status =
    rejectReasons.has("off_domain_topic") ||
    (rejectReasons.has("insufficient_source_count") && !hasWhyNow)
      ? "rejected"
      : "validated";

  updated.quality = {
    ...updated.quality,
    usableForGeneration: readinessState === "mission_ready",
    rejectReasons: Array.from(rejectReasons),
    reviewerNotes: Array.from(reviewerNotes),
  };

  return updated;
}
