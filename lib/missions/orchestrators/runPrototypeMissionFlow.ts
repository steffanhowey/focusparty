import { randomUUID } from "crypto";
import { buildCacheFingerprint } from "@/lib/missions/keys/cacheFingerprint";
import { buildEditorialKey } from "@/lib/missions/keys/editorialKey";
import { buildStableKey } from "@/lib/missions/keys/stableKey";
import {
  createMissionBrief,
  getNextMissionBriefVersion,
  supersedeActiveMissionBriefsByStableKey,
} from "@/lib/missions/repositories/missionBriefRepo";
import {
  createMissionGenerationRun,
  updateMissionGenerationRun,
} from "@/lib/missions/repositories/missionGenerationRunRepo";
import { updateSourcePacket } from "@/lib/missions/repositories/sourcePacketRepo";
import { judgeBenchmarkMission, type BenchmarkJudgment } from "@/lib/missions/prototype/benchmarkJudge";
import type { MissionBenchmarkCase } from "@/lib/missions/prototype/benchmarkSet";
import { decideMissionEditorial } from "@/lib/missions/services/editorialDecisionService";
import { buildMarketerTranslation } from "@/lib/missions/services/marketerTranslationService";
import { generateMissionBrief } from "@/lib/missions/services/missionBriefGenerator";
import { selectMissionFamily } from "@/lib/missions/services/missionFamilySelector";
import { evaluateMissionBriefQuality } from "@/lib/missions/services/missionQualityGate";
import { preflightPrototypeTopicCandidate } from "@/lib/missions/services/prototypeTopicPreflight";
import { assembleSourcePacket } from "@/lib/missions/services/sourcePacketAssembler";
import { evaluateSourcePacketReadiness } from "@/lib/missions/services/sourcePacketReadinessService";
import type { MissionEditorialDecision } from "@/lib/missions/types/editorialDecision";
import type { MissionGenerationRun } from "@/lib/missions/types/generationRun";
import type { MarketerTranslation } from "@/lib/missions/types/marketerTranslation";
import type { MissionBriefV2 } from "@/lib/missions/types/missionBriefV2";
import type { MissionPlan } from "@/lib/missions/types/missionPlan";
import type {
  FluencyLevel,
  MissionEvaluationMode,
  MissionFamily,
  ProfessionalFunction,
} from "@/lib/missions/types/common";
import type { SourcePacket, TopicCandidate } from "@/lib/missions/types/sourcePacket";

export interface PrototypeMissionFlowInput {
  prototypeKey: string;
  evaluationMode: Extract<MissionEvaluationMode, "benchmark" | "prototype">;
  topicCandidate: TopicCandidate;
  professionalFunction: ProfessionalFunction;
  fluencyLevel: FluencyLevel;
  familyScope: MissionFamily[];
  benchmarkVersion: string;
  familyTemplateVersion?: string;
  benchmarkCase?: MissionBenchmarkCase | null;
  prototypeCalibrationTopicSlugs?: string[];
}

export interface PrototypeMissionFlowResult {
  run: MissionGenerationRun;
  sourcePacket: SourcePacket | null;
  editorialDecision: MissionEditorialDecision | null;
  translation: MarketerTranslation | null;
  missionPlan: MissionPlan | null;
  missionBrief: MissionBriefV2 | null;
  benchmarkJudgment: BenchmarkJudgment | null;
}

/** Run one benchmark or prototype topic through the Phase 1 mission pipeline. */
export async function runPrototypeMissionFlow(
  input: PrototypeMissionFlowInput,
): Promise<PrototypeMissionFlowResult> {
  const editorialKey = buildEditorialKey({
    topicSlug: input.topicCandidate.topicSlug,
    professionalFunction: input.professionalFunction,
    fluencyLevel: input.fluencyLevel,
  });

  let run = await createMissionGenerationRun({
    id: randomUUID(),
    evaluationMode: input.evaluationMode,
    topicSlug: input.topicCandidate.topicSlug,
    sourcePacketId: null,
    editorialDecisionId: null,
    missionBriefId: null,
    editorialKey,
    stableKey: null,
    professionalFunction: input.professionalFunction,
    fluencyLevel: input.fluencyLevel,
    currentStage: "topic_candidate_resolved",
    status: "running",
    inputConfig: {
      prototype_key: input.prototypeKey,
      family_scope: input.familyScope,
      benchmark_version: input.benchmarkVersion,
      benchmark_case_id: input.benchmarkCase?.id ?? null,
      benchmark_case_label: input.benchmarkCase?.label ?? null,
    },
    stageResults: {
      topic_candidate: {
        topic_slug: input.topicCandidate.topicSlug,
        topic_name: input.topicCandidate.topicName,
        topic_category: input.topicCandidate.topicCategory,
        heat_score_snapshot: input.topicCandidate.heatScoreSnapshot,
      },
    },
    outputSummary: {},
    rejectReasons: [],
    error: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
  });

  let packet: SourcePacket | null = null;
  let editorialDecision: MissionEditorialDecision | null = null;
  let translation: MarketerTranslation | null = null;
  let missionPlan: MissionPlan | null = null;
  let missionBrief: MissionBriefV2 | null = null;
  let benchmarkJudgment: BenchmarkJudgment | null = null;

  const stageResults: Record<string, unknown> = structuredClone(run.stageResults);
  const outputSummary: Record<string, unknown> = structuredClone(run.outputSummary);
  let rejectReasons = [...run.rejectReasons];

  const persistRun = async (patch: Partial<MissionGenerationRun>): Promise<void> => {
    run = await updateMissionGenerationRun(run.id, {
      ...patch,
      stageResults,
      outputSummary,
      rejectReasons,
    });
  };

  try {
    const preflight = await preflightPrototypeTopicCandidate(input.topicCandidate);
    stageResults.topic_preflight = {
      passed: preflight.passed,
      failure_reasons: preflight.failureReasons,
      candidate_count: preflight.candidateCount,
      authoritative_candidate_count: preflight.authoritativeCandidateCount,
      coherent_secondary_count: preflight.coherentSecondaryCount,
      coherence_score: preflight.coherenceScore,
      workflow_surface_count: preflight.workflowSurfaceCount,
      generic_tutorial_count: preflight.genericTutorialCount,
    };
    await persistRun({ currentStage: "topic_preflight_completed" });

    if (!preflight.passed) {
      rejectReasons = mergeRejectReasons(rejectReasons, preflight.failureReasons);
      outputSummary.final_disposition = "topic_preflight_failed";
      await persistRun({
        currentStage: "topic_preflight_terminal",
        status: "skipped",
        completedAt: new Date().toISOString(),
      });

      return {
        run,
        sourcePacket: packet,
        editorialDecision,
        translation,
        missionPlan,
        missionBrief,
        benchmarkJudgment,
      };
    }

    packet = await assembleSourcePacket(input.topicCandidate, run.id);
    stageResults.source_packet = {
      packet_id: packet.packetId,
      packet_hash: packet.packetHash,
      status: packet.status,
      timeliness_class: packet.sourceWindow.timelinessClass,
      source_count: packet.sourceItems.length,
      claim_count: packet.keyClaims.length,
      diagnostics: packet.quality.diagnostics ?? null,
    };
    await persistRun({
      currentStage: "source_packet_assembled",
      sourcePacketId: packet.packetId,
    });

    packet = await updateSourcePacket(evaluateSourcePacketReadiness(packet));
    stageResults.source_packet_readiness = {
      state: packet.readiness.state,
      rationale: packet.readiness.rationale,
      blockers: packet.readiness.blockers,
      quality_reject_reasons: packet.quality.rejectReasons,
      status: packet.status,
    };
    await persistRun({
      currentStage: "source_packet_validated",
      sourcePacketId: packet.packetId,
    });

    editorialDecision = await decideMissionEditorial(packet, {
      professionalFunction: input.professionalFunction,
      fluencyLevel: input.fluencyLevel,
      evaluationMode: input.evaluationMode,
      familyScope: input.familyScope,
      prototypeCalibrationTopicSlugs: input.prototypeCalibrationTopicSlugs,
    });
    stageResults.editorial_decision = {
      id: editorialDecision.id,
      decision: editorialDecision.decision,
      editorial_priority: editorialDecision.editorialPriority,
      rationale: editorialDecision.rationale,
      recommended_launch_domains: editorialDecision.recommendedLaunchDomains,
      recommended_family_scope: editorialDecision.recommendedFamilyScope,
      blocked_by_mission_brief_id: editorialDecision.blockedByMissionBriefId,
      supersede_mission_brief_id: editorialDecision.supersedeMissionBriefId,
    };
    await persistRun({
      currentStage: "editorial_decision_made",
      editorialDecisionId: editorialDecision.id,
    });

    if (
      editorialDecision.decision !== "generate_now" &&
      editorialDecision.decision !== "supersede_existing"
    ) {
      rejectReasons = mergeRejectReasons(
        rejectReasons,
        deriveTerminalRejectReasons(packet, editorialDecision),
      );
      outputSummary.final_disposition = editorialDecision.decision;
      await persistRun({
        currentStage: "editorial_decision_terminal",
        status: editorialDecision.decision === "reject" ? "rejected" : "skipped",
        completedAt: new Date().toISOString(),
      });

      return {
        run,
        sourcePacket: packet,
        editorialDecision,
        translation,
        missionPlan,
        missionBrief,
        benchmarkJudgment,
      };
    }

    const translationResult = await buildMarketerTranslation(
      packet,
      input.professionalFunction,
      { allowedFamilies: input.familyScope },
    );
    translation = translationResult.translation;
    if (!translation) {
      rejectReasons = mergeRejectReasons(rejectReasons, ["no_marketer_relevance"]);
      outputSummary.final_disposition = "translation_failed";
      await persistRun({
        currentStage: "marketer_translation_failed",
        status: "rejected",
        completedAt: new Date().toISOString(),
      });

      return {
        run,
        sourcePacket: packet,
        editorialDecision,
        translation,
        missionPlan,
        missionBrief,
        benchmarkJudgment,
      };
    }

    stageResults.marketer_translation = {
      translation_id: translation.translationId,
      mode: translationResult.mode,
      fallback_reason: translationResult.fallbackReason,
      requested_family_scope: input.familyScope,
      why_this_matters_for_function: translation.whyThisMattersForFunction,
      marketer_use_case: translation.marketerUseCase,
      affected_launch_domains: translation.affectedLaunchDomains,
      mission_family_candidates: translation.missionFamilyCandidates,
      recommended_use_cases: translation.recommendedUseCases,
      non_use_cases: translation.nonUseCases,
    };
    await persistRun({ currentStage: "marketer_translation_completed" });

    const familySelection = selectMissionFamily(
      translation,
      input.professionalFunction,
      input.fluencyLevel,
      { allowedFamilies: input.familyScope },
    );
    missionPlan = familySelection.missionPlan;

    stageResults.family_selection = {
      selected_family: missionPlan?.missionFamily ?? null,
      artifact_type: missionPlan?.artifactType ?? null,
      launch_domain: missionPlan?.launchDomain ?? null,
      rationale: missionPlan?.rationale ?? null,
      failure_reason: familySelection.failureReason,
      candidate_scores:
        familySelection.candidateScores.length > 0
          ? familySelection.candidateScores
          : translation.missionFamilyCandidates.map((candidate) => ({
              family: candidate.family,
              score: candidate.score,
              rationale: candidate.rationale,
            })),
    };
    await persistRun({ currentStage: "mission_family_selected" });

    if (!missionPlan) {
      rejectReasons = mergeRejectReasons(rejectReasons, [
        familySelection.failureReason ?? "family_selection_low_confidence",
      ]);
      outputSummary.final_disposition = "family_selection_failed";
      await persistRun({
        currentStage: "mission_family_terminal",
        status: "rejected",
        completedAt: new Date().toISOString(),
      });

      return {
        run,
        sourcePacket: packet,
        editorialDecision,
        translation,
        missionPlan,
        missionBrief,
        benchmarkJudgment,
      };
    }

    const stableKey = buildStableKey({
      topicSlug: packet.topic.topicSlug,
      professionalFunction: input.professionalFunction,
      fluencyLevel: input.fluencyLevel,
      missionFamily: missionPlan.missionFamily,
    });
    const briefVersion = await getNextMissionBriefVersion(stableKey);
    missionBrief = await generateMissionBrief({
      packet,
      translation,
      missionPlan,
      briefVersion,
      benchmarkVersion: input.benchmarkVersion,
      familyTemplateVersion: input.familyTemplateVersion ?? "prototype_v1",
    });

    const cacheFingerprint = buildCacheFingerprint({
      stableKey,
      sourcePacketHash: packet.packetHash,
      familyTemplateVersion: input.familyTemplateVersion ?? "prototype_v1",
      benchmarkVersion: input.benchmarkVersion,
    });

    missionBrief = {
      ...missionBrief,
      lifecyclePlus: {
        ...missionBrief.lifecyclePlus,
        familyTemplateVersion:
          input.familyTemplateVersion ?? missionBrief.lifecyclePlus?.familyTemplateVersion ?? "prototype_v1",
        benchmarkVersion: input.benchmarkVersion,
        supersedesMissionId:
          editorialDecision.supersedeMissionBriefId ??
          missionBrief.lifecyclePlus?.supersedesMissionId ??
          null,
        cacheTags: [
          ...new Set([
            ...(missionBrief.lifecyclePlus?.cacheTags ?? []),
            `cache:${cacheFingerprint}`,
          ]),
        ],
        regenTriggers:
          missionBrief.lifecyclePlus?.regenTriggers ?? [
            "source_packet_changed",
            "benchmark_version_changed",
          ],
      },
    };

    stageResults.mission_brief_draft = {
      mission_id: missionBrief.missionId,
      stable_key: missionBrief.stableKey,
      title: missionBrief.identity.title,
      mission_family: missionBrief.identity.missionFamily,
      artifact_type: missionBrief.artifact.artifactType,
      timebox_minutes: missionBrief.execution.timeboxMinutes,
    };
    await persistRun({
      currentStage: "mission_brief_generated",
      stableKey,
    });

    missionBrief = await evaluateMissionBriefQuality(missionBrief, packet);
    if (input.evaluationMode === "benchmark" && missionBrief.status === "active") {
      missionBrief = {
        ...missionBrief,
        status: "draft",
      };
    }

    stageResults.quality_gate = {
      gate_decision: missionBrief.quality.gateDecision,
      quality_score: missionBrief.quality.score,
      reject_reasons: missionBrief.quality.rejectReasons,
      notes: missionBrief.quality.notes,
    };
    rejectReasons = mergeRejectReasons(rejectReasons, missionBrief.quality.rejectReasons);

    if (
      input.evaluationMode === "prototype" &&
      missionBrief.status === "active" &&
      editorialDecision.decision === "supersede_existing"
    ) {
      await supersedeActiveMissionBriefsByStableKey(stableKey);
    }

    missionBrief = await createMissionBrief(
      missionBrief,
      editorialDecision.id,
      cacheFingerprint,
    );

    if (input.benchmarkCase) {
      benchmarkJudgment = judgeBenchmarkMission({
        benchmarkCase: input.benchmarkCase,
        brief: missionBrief,
      });
      outputSummary.benchmark_judgment = benchmarkJudgment;
    }

    outputSummary.final_disposition = missionBrief.quality.gateDecision;
    outputSummary.final_status = missionBrief.status;
    outputSummary.cache_fingerprint = cacheFingerprint;
    await persistRun({
      currentStage: "mission_brief_persisted",
      missionBriefId: missionBrief.missionId,
      stableKey,
      status:
        input.evaluationMode === "benchmark"
          ? "completed"
          : missionBrief.quality.gateDecision === "pass"
            ? "completed"
            : "rejected",
      completedAt: new Date().toISOString(),
    });

    return {
      run,
      sourcePacket: packet,
      editorialDecision,
      translation,
      missionPlan,
      missionBrief,
      benchmarkJudgment,
    };
  } catch (error) {
    await persistRun({
      currentStage: "failed",
      status: "failed",
      error: serializeError(error),
      completedAt: new Date().toISOString(),
    });
    throw error;
  }
}

function deriveTerminalRejectReasons(
  packet: SourcePacket,
  editorialDecision: MissionEditorialDecision,
): string[] {
  if (editorialDecision.decision === "duplicate_active") {
    return ["duplicate_active_version"];
  }

  if (editorialDecision.decision === "reject") {
    return packet.quality.rejectReasons.length > 0
      ? packet.quality.rejectReasons
      : ["insufficient_source_packet"];
  }

  if (editorialDecision.decision === "hold" || editorialDecision.decision === "not_priority_yet") {
    return packet.quality.rejectReasons;
  }

  return [];
}

function mergeRejectReasons(existing: string[], incoming: string[]): string[] {
  return [...new Set([...existing, ...incoming])];
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
    };
  }

  return {
    message: String(error),
  };
}
