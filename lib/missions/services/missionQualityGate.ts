import OpenAI from "openai";
import { MISSION_QUALITY_THRESHOLDS, getNovelUserValueThreshold } from "@/lib/missions/config/qualityThresholds";
import {
  buildMissionQualityPrompt,
  MISSION_QUALITY_RESPONSE_SCHEMA,
} from "@/lib/missions/prompts/missionQualityPrompt";
import {
  getSuccessCriteriaRejectReasons,
  normalizeObservableMinimumSections,
  type SuccessCriteriaContext,
} from "@/lib/missions/services/successCriteria";
import type { MissionBriefV2 } from "@/lib/missions/types/missionBriefV2";
import type { MissionQualityStamp } from "@/lib/missions/types/quality";
import type { SourcePacket } from "@/lib/missions/types/sourcePacket";
import type { MissionRejectReason } from "@/lib/missions/types/common";

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI();
  }

  return openaiClient;
}

interface QualityModelResult {
  dimension_scores: MissionQualityStamp["dimensionScores"];
  reject_reasons: MissionQualityStamp["rejectReasons"];
  notes: string[];
}

/** Evaluate a mission brief against deterministic and model-based quality gates. */
export async function evaluateMissionBriefQuality(
  brief: MissionBriefV2,
  packet: SourcePacket,
): Promise<MissionBriefV2> {
  const deterministicRejectReasons = getDeterministicRejectReasons(brief, packet);
  const baseScores = computeHeuristicScores(brief, packet);

  let notes: string[] = [];
  let rejectReasons = [...deterministicRejectReasons];
  let dimensionScores = baseScores;

  if (deterministicRejectReasons.length === 0) {
    try {
      const prompt = buildMissionQualityPrompt({
        topic_slug: brief.topic.topicSlug,
        timeliness_class: brief.topic.timelinessClass,
        source_packet_readiness_state: brief.topic.sourcePacketReadinessState,
        why_this_matters_now: brief.framing.whyThisMattersNow,
        why_this_matters_for_marketing: brief.framing.whyThisMattersForMarketing,
        marketer_use_case: brief.framing.marketerUseCase,
        artifact: {
          artifact_type: brief.artifact.artifactType,
          artifact_name: brief.artifact.artifactName,
          output_description: brief.artifact.outputDescription,
          audience: brief.artifact.audience,
          format: brief.artifact.format,
        },
        execution: {
          timebox_minutes: brief.execution.timeboxMinutes,
          hard_cap_minutes: brief.execution.hardCapMinutes,
          steps: brief.execution.steps.map((step) => ({
            title: step.title,
            expected_output: step.expectedOutput,
          })),
        },
        success_criteria: brief.successCriteria.map((criterion) => ({
          label: criterion.label,
          definition: criterion.definition,
        })),
        source_references: brief.sourceReferences.map((reference) => ({
          claim_ids: reference.claimIds,
          supports_sections: reference.supportsSections,
        })),
        opinionated_take: brief.framingPlus?.opinionatedTake ?? null,
      });

      const response = await getOpenAIClient().chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.1,
        max_tokens: 1200,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: MISSION_QUALITY_RESPONSE_SCHEMA,
        },
      });

      const text = response.choices[0]?.message?.content;
      if (!text) throw new Error("Empty mission quality response");
      const modelResult = JSON.parse(text) as QualityModelResult;
      dimensionScores = {
        freshness: clampDimension(modelResult.dimension_scores.freshness),
        trustworthiness: clampDimension(modelResult.dimension_scores.trustworthiness),
        marketer_relevance: clampDimension(modelResult.dimension_scores.marketer_relevance),
        specificity: clampDimension(modelResult.dimension_scores.specificity),
        one_session_fit: clampDimension(modelResult.dimension_scores.one_session_fit),
        scaffolding: clampDimension(modelResult.dimension_scores.scaffolding),
        opinionatedness: clampDimension(modelResult.dimension_scores.opinionatedness),
        source_traceability: clampDimension(modelResult.dimension_scores.source_traceability),
        novel_user_value: clampDimension(modelResult.dimension_scores.novel_user_value),
      };
      rejectReasons = [...new Set([...rejectReasons, ...modelResult.reject_reasons])];
      notes = modelResult.notes;
    } catch (error) {
      console.warn("[missions/missionQualityGate] Using heuristic fallback:", error);
      notes = ["Quality gate fell back to deterministic heuristic scoring."];
    }
  } else {
    notes = ["Mission failed deterministic quality checks before model scoring."];
  }

  const score = Math.round(
    (Object.values(dimensionScores).reduce((sum, value) => sum + value, 0) / 45) * 100,
  );
  const criticalDimensions = [
    dimensionScores.marketer_relevance,
    dimensionScores.specificity,
    dimensionScores.one_session_fit,
    dimensionScores.opinionatedness,
    dimensionScores.source_traceability,
  ];
  const novelValueThreshold = getNovelUserValueThreshold(brief.topic.timelinessClass);
  const gateDecision =
    rejectReasons.length === 0 &&
    score >= MISSION_QUALITY_THRESHOLDS.overallPassScore &&
    criticalDimensions.every(
      (value) => value >= MISSION_QUALITY_THRESHOLDS.minCriticalDimension,
    ) &&
    dimensionScores.novel_user_value >= novelValueThreshold
      ? "pass"
      : "fail";

  const qualityStamp: MissionQualityStamp = {
    score,
    dimensionScores,
    gateDecision,
    rejectReasons:
      gateDecision === "pass"
        ? []
        : ([
            ...new Set<MissionRejectReason>([
              ...rejectReasons,
              ...(dimensionScores.novel_user_value < novelValueThreshold
                ? (["low_novel_user_value"] as MissionRejectReason[])
                : []),
            ]),
          ] as MissionRejectReason[]),
    reviewedAt: new Date().toISOString(),
    notes,
  };

  return {
    ...brief,
    status: gateDecision === "pass" ? "active" : "rejected",
    quality: qualityStamp,
  };
}

function getDeterministicRejectReasons(
  brief: MissionBriefV2,
  packet: SourcePacket,
): MissionQualityStamp["rejectReasons"] {
  const reasons: MissionQualityStamp["rejectReasons"] = [];

  if (packet.readiness.state !== "mission_ready") {
    reasons.push("insufficient_source_packet");
  }

  if (
    brief.execution.timeboxMinutes < MISSION_QUALITY_THRESHOLDS.minTimeboxMinutes ||
    brief.execution.timeboxMinutes > MISSION_QUALITY_THRESHOLDS.maxTimeboxMinutes ||
    brief.execution.hardCapMinutes > MISSION_QUALITY_THRESHOLDS.maxHardCapMinutes
  ) {
    reasons.push("timebox_not_one_session");
  }

  if (
    brief.execution.steps.length < MISSION_QUALITY_THRESHOLDS.minSteps ||
    brief.execution.steps.length > MISSION_QUALITY_THRESHOLDS.maxSteps ||
    brief.execution.steps.some((step) => step.expectedOutput.trim().length === 0)
  ) {
    reasons.push("steps_ambiguous");
  }

  if (brief.successCriteria.length < MISSION_QUALITY_THRESHOLDS.minSuccessCriteria) {
    reasons.push("too_few_success_criteria");
  } else {
    reasons.push(...getSuccessCriteriaRejectReasons(brief.successCriteria, buildSuccessCriteriaContext(brief)));
  }

  if (brief.sourceReferences.length < MISSION_QUALITY_THRESHOLDS.minSourceReferences) {
    reasons.push("missing_source_traceability");
  }

  if (!brief.framing.marketerUseCase.trim() || !brief.framing.whyThisMattersForMarketing.trim()) {
    reasons.push("no_marketer_relevance");
  }

  if (
    !brief.artifact.audience.trim() ||
    !brief.artifact.outputDescription.trim() ||
    !brief.artifact.completionDefinition.trim()
  ) {
    reasons.push("artifact_too_generic");
  }

  if (!brief.bestRoom.roomKey) {
    reasons.push("room_fit_poor");
  }

  if (
    packet.contradictions.some(
      (contradiction) =>
        contradiction.severity === "material" &&
        contradiction.resolutionStatus === "unresolved",
    )
  ) {
    reasons.push("unresolved_material_contradiction");
  }

  return [...new Set(reasons)];
}

function computeHeuristicScores(
  brief: MissionBriefV2,
  packet: SourcePacket,
): MissionQualityStamp["dimensionScores"] {
  return {
    freshness: Math.max(1, Math.min(5, Math.round(packet.freshness.recencyScore / 20))),
    trustworthiness: Math.max(1, Math.min(5, Math.round(packet.credibility.overallScore / 20))),
    marketer_relevance:
      brief.framing.marketerUseCase.length > 25 && brief.framing.whyThisMattersForMarketing.length > 25
        ? 4
        : 2,
    specificity:
      brief.execution.steps.every((step) => step.expectedOutput.length > 12) &&
      brief.artifact.outputDescription.length > 30
        ? 4
        : 2,
    one_session_fit:
      brief.execution.timeboxMinutes >= 25 && brief.execution.timeboxMinutes <= 60 ? 4 : 2,
    scaffolding: brief.execution.steps.length >= 3 ? 4 : 2,
    opinionatedness: brief.framingPlus?.opinionatedTake ? 4 : 2,
    source_traceability: brief.sourceReferences.length >= 2 ? 4 : 2,
    novel_user_value:
      brief.sourceReferences.length >= 2 && brief.framing.marketerUseCase.length > 30 ? 4 : 2,
  };
}

function clampDimension(value: number): number {
  return Math.max(0, Math.min(5, Math.round(value)));
}

function buildSuccessCriteriaContext(brief: MissionBriefV2): SuccessCriteriaContext {
  return {
    artifactType: brief.artifact.artifactType,
    format: brief.artifact.format,
    minimumSections: normalizeObservableMinimumSections({
      artifactType: brief.artifact.artifactType,
      format: brief.artifact.format,
      minimumSections: brief.artifact.minimumSections ?? [],
      missionFamily: brief.identity.missionFamily,
    }),
    missionFamily: brief.identity.missionFamily,
  };
}

export const __testing = {
  getDeterministicRejectReasons,
  getSuccessCriteriaRejectReasons,
};
