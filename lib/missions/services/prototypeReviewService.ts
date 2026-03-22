import { randomUUID } from "crypto";
import { listMissionBriefsByIds } from "@/lib/missions/repositories/missionBriefRepo";
import { listMissionGenerationRunsByPrototypeKey } from "@/lib/missions/repositories/missionGenerationRunRepo";
import type { MissionGenerationRun } from "@/lib/missions/types/generationRun";
import type { PrototypeReviewReport } from "@/lib/missions/types/prototypeReviewReport";
import type {
  FluencyLevel,
  MissionFamily,
  ProfessionalFunction,
} from "@/lib/missions/types/common";

export interface PrototypeReviewBuilderInput {
  prototypeKey: string;
  audienceFunction: ProfessionalFunction;
  fluencyLevel: FluencyLevel;
  topicSlugs: string[];
  familyScope: MissionFamily[];
  benchmarkVersion: string;
}

/** Build the deterministic prototype review artifact from persisted runs and briefs. */
export async function buildPrototypeReview(
  input: PrototypeReviewBuilderInput,
): Promise<PrototypeReviewReport> {
  const prototypeRuns = await listMissionGenerationRunsByPrototypeKey(
    input.prototypeKey,
    "prototype",
  );
  const benchmarkRuns = await listMissionGenerationRunsByPrototypeKey(
    input.prototypeKey,
    "benchmark",
  );

  const reviewBriefIds = [
    ...new Set(
      prototypeRuns
        .map((run) => run.missionBriefId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const briefs = await listMissionBriefsByIds(reviewBriefIds);
  const passedBriefs = briefs.filter((brief) => brief.quality.gateDecision === "pass");
  const failedBriefs = briefs.filter((brief) => brief.quality.gateDecision === "fail");
  const unstableFamilyDecisions = collectUnstableFamilyDecisions(prototypeRuns);
  const rejectReasonFrequency = collectRejectReasonFrequency(prototypeRuns, briefs);
  const genericBriefFindings = failedBriefs
    .filter((brief) =>
      brief.quality.rejectReasons.some((reason) =>
        ["artifact_too_generic", "low_novel_user_value"].includes(reason),
      ),
    )
    .map((brief) => ({
      missionBriefId: brief.missionId,
      note: brief.quality.notes.join(" ") || "Brief still feels generic or low-leverage.",
    }));

  const report: PrototypeReviewReport = {
    id: randomUUID(),
    prototypeKey: input.prototypeKey,
    audienceFunction: input.audienceFunction,
    fluencyLevel: input.fluencyLevel,
    topicSlugs: input.topicSlugs,
    familyScope: input.familyScope,
    benchmarkVersion: input.benchmarkVersion,
    reviewedBriefIds: reviewBriefIds,
    sourcePacketCount: countUnique(prototypeRuns.map((run) => run.sourcePacketId).filter(Boolean)),
    missionReadyPacketCount: countMissionReadyPackets(prototypeRuns),
    editorialGenerateNowCount: prototypeRuns.filter(
      (run) => ((run.stageResults.editorial_decision as Record<string, unknown> | undefined)?.decision as string | undefined) === "generate_now",
    ).length,
    briefGeneratedCount: prototypeRuns.filter((run) => Boolean(run.missionBriefId)).length,
    briefPassCount: passedBriefs.length,
    briefFailCount: failedBriefs.length,
    essentialFields: determineEssentialFields(passedBriefs),
    deadWeightFields: determineDeadWeightFields(briefs),
    promoteToTier1Fields: determinePromoteFields(passedBriefs),
    unstableFamilyDecisions,
    rejectReasonFrequency,
    genericBriefFindings,
    requiredChangesBeforeGeneralizedBuildout: determineRequiredChanges(
      rejectReasonFrequency,
      unstableFamilyDecisions,
      genericBriefFindings,
    ),
    report: {
      benchmark_summary: buildBenchmarkSummary(benchmarkRuns),
      prototype_run_ids: prototypeRuns.map((run) => run.id),
      benchmark_run_ids: benchmarkRuns.map((run) => run.id),
    },
    createdAt: new Date().toISOString(),
  };

  return report;
}

function countUnique(values: Array<string | null | undefined>): number {
  return new Set(values.filter((value): value is string => Boolean(value))).size;
}

function countMissionReadyPackets(runs: MissionGenerationRun[]): number {
  const missionReadyIds = new Set<string>();
  for (const run of runs) {
    const packetState = (run.stageResults.source_packet_readiness as Record<string, unknown> | undefined)?.state;
    if (packetState === "mission_ready" && run.sourcePacketId) {
      missionReadyIds.add(run.sourcePacketId);
    }
  }
  return missionReadyIds.size;
}

function determineEssentialFields(
  passedBriefs: Awaited<ReturnType<typeof listMissionBriefsByIds>>,
): string[] {
  if (passedBriefs.length === 0) return [];

  return [
    "identity.title",
    "identity.summary",
    "topic.topicSlug",
    "framing.whyThisMattersNow",
    "framing.whyThisMattersForMarketing",
    "framing.marketerUseCase",
    "artifact.artifactType",
    "artifact.outputDescription",
    "execution.timeboxMinutes",
    "execution.steps",
    "successCriteria",
    "bestRoom",
    "sourceReferences",
    "quality",
  ];
}

function determineDeadWeightFields(
  briefs: Awaited<ReturnType<typeof listMissionBriefsByIds>>,
): string[] {
  if (briefs.length === 0) return [];

  const deadWeight: string[] = [];
  const hasTools = briefs.some((brief) => Boolean(brief.tools?.primary));
  const hasEvidence = briefs.some((brief) => Boolean(brief.evidence?.requiredItems.length));
  const hasRubric = briefs.some((brief) => Boolean(brief.rubricDimensions?.length));
  const hasRoomFitPlus = briefs.some((brief) => Boolean(brief.roomFitPlus?.handoffMoments.length));

  if (!hasTools) deadWeight.push("tools");
  if (!hasEvidence) deadWeight.push("evidence");
  if (!hasRubric) deadWeight.push("rubricDimensions");
  if (!hasRoomFitPlus) deadWeight.push("roomFitPlus");

  return deadWeight;
}

function determinePromoteFields(
  passedBriefs: Awaited<ReturnType<typeof listMissionBriefsByIds>>,
): string[] {
  if (passedBriefs.length === 0) return [];

  const promote: string[] = [];
  const percentWith = (predicate: (brief: Awaited<ReturnType<typeof listMissionBriefsByIds>>[number]) => boolean): number =>
    passedBriefs.filter(predicate).length / passedBriefs.length;

  if (percentWith((brief) => Boolean(brief.framingPlus?.opinionatedTake)) >= 0.8) {
    promote.push("framingPlus.opinionatedTake");
  }

  if (percentWith((brief) => (brief.inputs?.requiredInputs.length ?? 0) > 0) >= 0.8) {
    promote.push("inputs.requiredInputs");
  }

  if (percentWith((brief) => (brief.scaffolding?.checkpoints.length ?? 0) > 0) >= 0.8) {
    promote.push("scaffolding.checkpoints");
  }

  return promote;
}

function collectUnstableFamilyDecisions(
  runs: MissionGenerationRun[],
): PrototypeReviewReport["unstableFamilyDecisions"] {
  return runs.flatMap((run) => {
    const candidateScores = (run.stageResults.family_selection as Record<string, unknown> | undefined)
      ?.candidate_scores as Array<Record<string, unknown>> | undefined;
    if (!candidateScores || candidateScores.length < 2) return [];

    const sorted = [...candidateScores].sort(
      (left, right) => Number(right.score ?? 0) - Number(left.score ?? 0),
    );
    const top = sorted[0];
    const second = sorted[1];
    if (!top || !second) return [];

    const delta = Number(top.score ?? 0) - Number(second.score ?? 0);
    if (delta >= 0.05) return [];

    return [
      {
        topicSlug: run.topicSlug,
        competingFamilies: [
          String(top.family) as MissionFamily,
          String(second.family) as MissionFamily,
        ],
        note: "Top two family candidates were too close to each other.",
      },
    ];
  });
}

function collectRejectReasonFrequency(
  runs: MissionGenerationRun[],
  briefs: Awaited<ReturnType<typeof listMissionBriefsByIds>>,
): PrototypeReviewReport["rejectReasonFrequency"] {
  const counts = new Map<string, number>();
  for (const run of runs) {
    for (const reason of run.rejectReasons) {
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
  }
  for (const brief of briefs) {
    for (const reason of brief.quality.rejectReasons) {
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((left, right) => right.count - left.count);
}

function determineRequiredChanges(
  rejectReasonFrequency: PrototypeReviewReport["rejectReasonFrequency"],
  unstableFamilyDecisions: PrototypeReviewReport["unstableFamilyDecisions"],
  genericBriefFindings: PrototypeReviewReport["genericBriefFindings"],
): string[] {
  const changes: string[] = [];
  const topRejects = rejectReasonFrequency.slice(0, 3).map((item) => item.reason);

  if (topRejects.includes("low_novel_user_value")) {
    changes.push("Tighten the leverage bar so weak research-compression missions are rejected earlier.");
  }
  if (topRejects.includes("artifact_too_generic")) {
    changes.push("Strengthen artifact specificity rules in brief generation and deterministic validation.");
  }
  if (topRejects.includes("family_selection_low_confidence") || unstableFamilyDecisions.length > 0) {
    changes.push("Refine mission family selection thresholds and domain-to-family mapping.");
  }
  if (genericBriefFindings.length > 0) {
    changes.push("Increase the anti-genericity pressure in the mission brief prompt and gate.");
  }

  return changes;
}

function buildBenchmarkSummary(
  benchmarkRuns: MissionGenerationRun[],
): Record<string, unknown> {
  const total = benchmarkRuns.length;
  const passed = benchmarkRuns.filter(
    (run) => ((run.outputSummary.benchmark_judgment as Record<string, unknown> | undefined)?.passed as boolean | undefined) === true,
  ).length;

  return {
    total_runs: total,
    passed_runs: passed,
    failed_runs: total - passed,
  };
}
