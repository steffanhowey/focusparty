import { randomUUID } from "crypto";
import OpenAI from "openai";
import { SAFETY_PROMPT } from "@/lib/breaks/contentSafety";
import { getPreferredToolSlugs } from "@/lib/learn/functionToolPreferences";
import { getTool } from "@/lib/learn/toolRegistry";
import { getLaunchRoomPreferenceOrder } from "@/lib/launchTaxonomy";
import {
  buildMissionBriefPrompt,
  MISSION_BRIEF_RESPONSE_SCHEMA,
} from "@/lib/missions/prompts/missionBriefPrompt";
import type { MissionBriefV2, MissionStep } from "@/lib/missions/types/missionBriefV2";
import type { MissionPlan } from "@/lib/missions/types/missionPlan";
import type { MissionQualityStamp } from "@/lib/missions/types/quality";
import type { MarketerTranslation } from "@/lib/missions/types/marketerTranslation";
import type { SourcePacket } from "@/lib/missions/types/sourcePacket";
import { buildStableKey } from "@/lib/missions/keys/stableKey";
import {
  analyzeSuccessCriterionDefinition,
  buildObservableSuccessCriteria,
  normalizeObservableMinimumSections,
  type SuccessCriteriaContext,
} from "@/lib/missions/services/successCriteria";

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI();
  }

  return openaiClient;
}

export interface MissionBriefGeneratorInput {
  packet: SourcePacket;
  translation: MarketerTranslation;
  missionPlan: MissionPlan;
  briefVersion: number;
  benchmarkVersion: string;
  familyTemplateVersion?: string;
}

interface MissionBriefDraftResponse {
  title: string;
  short_title: string;
  summary: string;
  why_this_matters_now: string;
  why_this_matters_for_marketing: string;
  marketer_use_case: string;
  artifact_name: string;
  output_description: string;
  audience: string;
  format: MissionBriefV2["artifact"]["format"];
  completion_definition: string;
  minimum_sections: string[];
  timebox_minutes: number;
  hard_cap_minutes: number;
  steps: Array<{
    title: string;
    instruction: string;
    expected_output: string;
    estimated_minutes: number;
  }>;
  success_criteria: Array<{
    label: string;
    definition: string;
    critical: boolean;
  }>;
  best_room_rationale: string;
  source_references: Array<{
    source_item_id: string;
    claim_ids: string[];
    supports_sections: Array<
      "why_now" | "why_marketing" | "artifact" | "steps" | "success_criteria"
    >;
  }>;
  required_inputs: Array<{
    label: string;
    description: string;
    type:
      | "brand_context"
      | "product_context"
      | "audience_context"
      | "offer"
      | "url"
      | "text"
      | "asset"
      | "source_selection";
    example: string | null;
    can_use_placeholder: boolean;
  }>;
  opinionated_take: string;
  expected_value_if_completed: string;
  suggested_primary_tool: string | null;
  checkpoints: string[];
  common_failure_modes: string[];
}

interface SuccessCriteriaCorrectionResponse {
  success_criteria: MissionBriefDraftResponse["success_criteria"];
}

const SUCCESS_CRITERIA_CORRECTION_RESPONSE_SCHEMA = {
  name: "mission_success_criteria_correction",
  strict: true,
  schema: {
    type: "object",
    properties: {
      success_criteria: {
        type: "array",
        minItems: 3,
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            definition: { type: "string" },
            critical: { type: "boolean" },
          },
          required: ["label", "definition", "critical"],
          additionalProperties: false,
        },
      },
    },
    required: ["success_criteria"],
    additionalProperties: false,
  },
} as const;

interface ArtifactNormalizationSupport {
  minimumSections: string[];
  outputDescription: string;
  completionDefinition: string;
  steps: MissionBriefDraftResponse["steps"];
}

interface LaunchLaneDraftOverrides {
  title: string;
  shortTitle: string;
  summary: string;
  whyThisMattersNow: string;
  audience: string;
  artifactName: string;
  expectedValueIfCompleted: string;
  checkpoints: string[];
  commonFailureModes: string[];
}

/** Generate a tiered mission brief draft from packet + translation + mission plan. */
export async function generateMissionBrief(
  input: MissionBriefGeneratorInput,
): Promise<MissionBriefV2> {
  const prompt = buildMissionBriefPrompt({
    topic_slug: input.packet.topic.topicSlug,
    topic_name: input.packet.topic.topicName,
    professional_function: input.missionPlan.professionalFunction,
    fluency_level: input.missionPlan.fluencyLevel,
    mission_family: input.missionPlan.missionFamily,
    artifact_type: input.missionPlan.artifactType,
    launch_domain: input.missionPlan.launchDomain,
    why_this_matters_now: input.packet.whyNow.summary,
    why_this_matters_for_marketing: input.translation.whyThisMattersForFunction,
    marketer_use_case: input.translation.marketerUseCase,
    opinionated_stance: input.translation.opinionatedStance,
    what_to_ignore: input.translation.whatToIgnore,
    preferred_tools: getPreferredToolSlugs(input.missionPlan.professionalFunction),
    source_claims: input.packet.keyClaims.map((claim) => ({
      claim_id: claim.claimId,
      statement: claim.statement,
      importance: claim.importance,
      source_item_ids: claim.sourceItemIds,
    })),
    source_items: input.packet.sourceItems.map((item) => ({
      source_item_id: item.sourceItemId,
      title: item.title,
      summary: item.summary,
    })),
  });

  let draft: MissionBriefDraftResponse;
  try {
    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.25,
      max_tokens: 2200,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: MISSION_BRIEF_RESPONSE_SCHEMA,
      },
    });

    const text = response.choices[0]?.message?.content;
    if (!text) throw new Error("Empty mission brief response");
    draft = JSON.parse(text) as MissionBriefDraftResponse;
  } catch (error) {
    console.warn("[missions/missionBriefGenerator] Falling back:", error);
    draft = buildFallbackMissionBriefDraft(input);
  }

  draft = normalizeDraftForMissionQuality(draft, input);
  draft = await ensureMinimumVerifiableSuccessCriteria(draft, input);

  const preferredRooms = getLaunchRoomPreferenceOrder(input.missionPlan.launchDomain);
  const bestRoomKey = preferredRooms[0] ?? null;
  const stableKey = buildStableKey({
    topicSlug: input.packet.topic.topicSlug,
    professionalFunction: input.missionPlan.professionalFunction,
    fluencyLevel: input.missionPlan.fluencyLevel,
    missionFamily: input.missionPlan.missionFamily,
  });
  const generatedAt = new Date().toISOString();
  const placeholderQuality: MissionQualityStamp = {
    score: 0,
    dimensionScores: {
      freshness: 0,
      trustworthiness: 0,
      marketer_relevance: 0,
      specificity: 0,
      one_session_fit: 0,
      scaffolding: 0,
      opinionatedness: 0,
      source_traceability: 0,
      novel_user_value: 0,
    },
    gateDecision: "fail",
    rejectReasons: [],
    reviewedAt: generatedAt,
    notes: ["Pending quality gate."],
  };

  const requiredInputs = draft.required_inputs.slice(0, 4).map((field, index) => ({
    inputId: `input-${index + 1}-${slugify(field.label)}`,
    label: field.label,
    description: field.description,
    type: field.type,
    example: field.example,
    canUsePlaceholder: field.can_use_placeholder,
  }));

  const toolSlug = draft.suggested_primary_tool ?? getPreferredToolSlugs(input.missionPlan.professionalFunction)[0] ?? "chatgpt";
  const registryTool = getTool(toolSlug);
  const sourceReferences = ensureRequiredSourceReferenceCoverage(
    buildSourceReferences(draft, input.packet),
  );

  return {
    missionId: randomUUID(),
    stableKey,
    schemaVersion: "mission_brief_v2",
    status: "draft",
    identity: {
      title: draft.title,
      shortTitle: draft.short_title,
      summary: draft.summary,
      professionalFunction: input.missionPlan.professionalFunction,
      fluencyLevel: input.missionPlan.fluencyLevel,
      missionFamily: input.missionPlan.missionFamily,
      launchDomain: input.missionPlan.launchDomain,
    },
    topic: {
      topicSlug: input.packet.topic.topicSlug,
      topicName: input.packet.topic.topicName,
      sourcePacketId: input.packet.packetId,
      sourcePacketHash: input.packet.packetHash,
      sourcePacketReadinessState: input.packet.readiness.state,
      timelinessClass: input.packet.sourceWindow.timelinessClass,
      heatScoreSnapshot: input.packet.topic.heatScoreSnapshot,
    },
    framing: {
      whyThisMattersNow: draft.why_this_matters_now,
      whyThisMattersForMarketing: draft.why_this_matters_for_marketing,
      marketerUseCase: draft.marketer_use_case,
    },
    artifact: {
      artifactType: input.missionPlan.artifactType,
      artifactName: draft.artifact_name,
      outputDescription: draft.output_description,
      audience: draft.audience,
      format: draft.format,
      completionDefinition: draft.completion_definition,
      minimumSections: draft.minimum_sections,
    },
    execution: {
      timeboxMinutes: Math.round(draft.timebox_minutes),
      hardCapMinutes: Math.round(draft.hard_cap_minutes),
      steps: draft.steps.map((step, index) => buildMissionStep(step, index)),
    },
    successCriteria: draft.success_criteria.map((criterion, index) => ({
      criterionId: `criterion-${index + 1}`,
      label: criterion.label,
      definition: criterion.definition,
      critical: criterion.critical,
      verificationMethod: "binary",
    })),
    bestRoom: {
      roomKey: bestRoomKey,
      launchDomain: input.missionPlan.launchDomain,
      rationale: draft.best_room_rationale,
    },
    sourceReferences,
    quality: placeholderQuality,
    lifecycleCore: {
      briefVersion: input.briefVersion,
      generatedAt,
      expiresAt: input.packet.expiresAt,
    },
    framingPlus: {
      opinionatedTake: draft.opinionated_take,
      whatToIgnore: input.translation.whatToIgnore.join(" ") || null,
      expectedValueIfCompleted: draft.expected_value_if_completed,
    },
    inputs: {
      requiredInputs,
      optionalInputs: [],
      systemDefaults: [],
    },
    tools: registryTool
      ? {
          primary: {
            toolKey: registryTool.slug,
            displayName: registryTool.name,
            resolutionType: "registry",
            capabilityTags: [registryTool.category],
            required: true,
            rationale: "Recommended primary tool for the first mission rep.",
          },
          supporting: [],
          disallowed: [],
        }
      : {
          primary: {
            toolKey: toolSlug,
            displayName: toolSlug,
            resolutionType: "capability",
            capabilityTags: ["general-llm"],
            required: true,
            rationale: "Fallback capability-based tool reference.",
          },
          supporting: [],
          disallowed: [],
        },
    scaffolding: {
      guidanceLevel: mapGuidanceLevel(input.missionPlan.fluencyLevel),
      warmStartPrompt: null,
      starterTemplate: null,
      checkpoints: draft.checkpoints,
      commonFailureModes: draft.common_failure_modes,
    },
    lifecyclePlus: {
      familyTemplateVersion: input.familyTemplateVersion ?? "prototype_v1",
      benchmarkVersion: input.benchmarkVersion,
      supersedesMissionId: null,
      cacheTags: [
        `topic:${input.packet.topic.topicSlug}`,
        `family:${input.missionPlan.missionFamily}`,
        `domain:${input.missionPlan.launchDomain}`,
      ],
      regenTriggers: ["source_packet_changed", "benchmark_version_changed"],
    },
  };
}

function buildFallbackMissionBriefDraft(
  input: MissionBriefGeneratorInput,
): MissionBriefDraftResponse {
  const familyVerb =
    input.missionPlan.missionFamily === "messaging-translation"
      ? "translate"
      : "synthesize";
  const observableArtifact = buildObservableArtifactSupport(input);
  const laneOverrides = buildLaunchLaneDraftOverrides(input);
  const deterministicCriteria = buildObservableSuccessCriteria(
    buildSuccessCriteriaContextFromSupport(input, observableArtifact.minimumSections),
  );

  return {
    title: laneOverrides.title,
    short_title: laneOverrides.shortTitle,
    summary: laneOverrides.summary,
    why_this_matters_now: laneOverrides.whyThisMattersNow,
    why_this_matters_for_marketing: input.translation.whyThisMattersForFunction,
    marketer_use_case: input.translation.marketerUseCase,
    artifact_name: laneOverrides.artifactName,
    output_description: observableArtifact.outputDescription,
    audience: laneOverrides.audience,
    format: input.missionPlan.artifactType === "message-matrix" ? "table" : "doc",
    completion_definition: observableArtifact.completionDefinition,
    minimum_sections: observableArtifact.minimumSections,
    timebox_minutes: 45,
    hard_cap_minutes: 60,
    steps: observableArtifact.steps.map((step, index) => ({
      title: index === 0 ? "Pull the signal into focus" : step.title,
      instruction:
        index === 0
          ? `Review the source-backed claims and ${familyVerb} the key change into one marketer-facing statement before you fill the artifact structure.`
          : step.instruction,
      expected_output: step.expected_output,
      estimated_minutes: step.estimated_minutes,
    })),
    success_criteria: deterministicCriteria,
    best_room_rationale: "Best completed in the launch room that matches the selected domain.",
    source_references: input.packet.keyClaims.slice(0, 2).map((claim) => ({
      source_item_id: claim.sourceItemIds[0] ?? input.packet.sourceItems[0]?.sourceItemId ?? "unknown-source",
      claim_ids: [claim.claimId],
      supports_sections: ["why_now", "why_marketing", "artifact"],
    })),
    required_inputs: [
      {
        label: "Brand or offer context",
        description: "A lightweight description of the brand, product, or offer you want to use.",
        type: "brand_context",
        example: "B2B SaaS for growth teams",
        can_use_placeholder: true,
      },
    ],
    opinionated_take: input.translation.opinionatedStance,
    expected_value_if_completed: laneOverrides.expectedValueIfCompleted,
    suggested_primary_tool: getPreferredToolSlugs(input.missionPlan.professionalFunction)[0] ?? "chatgpt",
    checkpoints: laneOverrides.checkpoints,
    common_failure_modes: laneOverrides.commonFailureModes,
  };
}

function buildMissionStep(
  step: MissionBriefDraftResponse["steps"][number],
  index: number,
): MissionStep {
  return {
    stepId: `step-${index + 1}`,
    title: step.title,
    instruction: step.instruction,
    expectedOutput: step.expected_output,
    estimatedMinutes: Math.max(1, Math.round(step.estimated_minutes)),
  };
}

function buildSourceReferences(
  draft: MissionBriefDraftResponse,
  packet: SourcePacket,
): MissionBriefV2["sourceReferences"] {
  const validClaimIds = new Set(packet.keyClaims.map((claim) => claim.claimId));
  const validSourceItemIds = new Set(packet.sourceItems.map((item) => item.sourceItemId));
  const references = draft.source_references
    .filter(
      (reference) =>
        validSourceItemIds.has(reference.source_item_id) &&
        reference.claim_ids.some((claimId) => validClaimIds.has(claimId)),
    )
    .map((reference, index) => ({
      referenceId: `ref-${index + 1}`,
      sourceItemId: reference.source_item_id,
      claimIds: reference.claim_ids.filter((claimId) => validClaimIds.has(claimId)),
      supportsSections: reference.supports_sections,
    }));

  if (references.length >= 2) {
    return references;
  }

  return packet.keyClaims.slice(0, 2).map((claim, index) => ({
    referenceId: `ref-${index + 1}`,
    sourceItemId: claim.sourceItemIds[0] ?? packet.sourceItems[0]?.sourceItemId ?? "unknown-source",
    claimIds: [claim.claimId],
    supportsSections: ["why_now", "why_marketing", "artifact"],
  }));
}

function normalizeDraftForMissionQuality(
  draft: MissionBriefDraftResponse,
  input: MissionBriefGeneratorInput,
): MissionBriefDraftResponse {
  const fallback = buildFallbackMissionBriefDraft(input);
  const forceLaneCopy =
    isPromptEngineeringResearchLane(input) || isClaudeCodeMessagingLane(input);
  const consumptionHeavy = isConsumptionHeavyStepPlan(draft.steps);
  const observableArtifact = buildObservableArtifactSupport(input, draft.minimum_sections);
  const weakArtifactStructure = isWeakArtifactStructure(draft.minimum_sections);
  const weakStepOutputs = hasWeakObservableStepOutputs(draft.steps);

  return {
    ...draft,
    title: forceLaneCopy ? fallback.title : draft.title,
    short_title: forceLaneCopy ? fallback.short_title : draft.short_title,
    summary: forceLaneCopy ? fallback.summary : draft.summary,
    why_this_matters_now:
      shouldUseFallbackWhyNow(draft.why_this_matters_now, input) ? fallback.why_this_matters_now : draft.why_this_matters_now,
    audience: normalizeProfessionalAudience(draft.audience, fallback.audience),
    artifact_name: forceLaneCopy ? fallback.artifact_name : draft.artifact_name,
    output_description:
      draft.output_description.trim().length >= 30
        ? draft.output_description
        : observableArtifact.outputDescription,
    completion_definition:
      draft.completion_definition.trim().length >= 30
        ? draft.completion_definition
        : observableArtifact.completionDefinition,
    minimum_sections: weakArtifactStructure
      ? observableArtifact.minimumSections
      : normalizeObservableMinimumSections(
          buildSuccessCriteriaContextFromSupport(input, draft.minimum_sections),
        ),
    steps:
      consumptionHeavy || weakStepOutputs ? observableArtifact.steps : draft.steps,
    checkpoints:
      (consumptionHeavy || weakStepOutputs) && fallback.checkpoints.length > 0
        ? fallback.checkpoints
        : draft.checkpoints,
    common_failure_modes:
      (consumptionHeavy || weakStepOutputs) && fallback.common_failure_modes.length > 0
        ? fallback.common_failure_modes
        : draft.common_failure_modes,
    expected_value_if_completed:
      shouldUseFallbackExpectedValue(draft.expected_value_if_completed)
        ? fallback.expected_value_if_completed
        : draft.expected_value_if_completed,
  };
}

async function ensureMinimumVerifiableSuccessCriteria(
  draft: MissionBriefDraftResponse,
  input: MissionBriefGeneratorInput,
): Promise<MissionBriefDraftResponse> {
  const context = buildSuccessCriteriaContextFromDraft(draft, input);
  if (
    draft.success_criteria.length >= 3 &&
    draft.success_criteria.every((criterion) =>
      isVerifiableSuccessCriterionDefinition(criterion.definition, context),
    )
  ) {
    return draft;
  }

  try {
    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      max_tokens: 600,
      messages: [
        {
          role: "system",
          content: `You are fixing mission success criteria for SkillGap.ai.

Rules:
- Return exactly 3 success criteria.
- Each criterion must be observable from the final submitted artifact.
- Each criterion must name a concrete observable condition such as required sections, required fields, cited claims, explicit recommendations, or source-backed examples.
- Do not use subjective-only language like "formatted professionally", "clear and actionable", "readability", "practical", or "useful" unless the exact observable artifact condition is also named.
- At least one criterion must reference the required artifact structure directly.

${SAFETY_PROMPT}`,
        },
        {
          role: "user",
          content: JSON.stringify({
            topic_slug: input.packet.topic.topicSlug,
            mission_family: input.missionPlan.missionFamily,
            artifact_type: input.missionPlan.artifactType,
            artifact_format: draft.format,
            minimum_sections: context.minimumSections,
            output_description: draft.output_description,
            completion_definition: draft.completion_definition,
            steps: draft.steps.map((step) => ({
              title: step.title,
              expected_output: step.expected_output,
            })),
            existing_success_criteria: draft.success_criteria,
            key_claims: input.packet.keyClaims.map((claim) => claim.statement),
          }),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: SUCCESS_CRITERIA_CORRECTION_RESPONSE_SCHEMA,
      },
    });

    const text = response.choices[0]?.message?.content;
    if (!text) {
      return draft;
    }

    const correction = JSON.parse(text) as SuccessCriteriaCorrectionResponse;
    if (
      correction.success_criteria.length < 3 ||
      correction.success_criteria.some(
        (criterion) =>
          !isVerifiableSuccessCriterionDefinition(criterion.definition, context),
      )
    ) {
      return {
        ...draft,
        success_criteria: buildObservableSuccessCriteria(context),
      };
    }

    return {
      ...draft,
      success_criteria: correction.success_criteria,
    };
  } catch (error) {
    console.warn("[missions/missionBriefGenerator] Success criteria correction failed:", error);
    return {
      ...draft,
      success_criteria: buildObservableSuccessCriteria(context),
    };
  }
}

function normalizeProfessionalAudience(
  audience: string,
  fallbackAudience: string,
): string {
  const normalized = audience.trim();
  const lower = normalized.toLowerCase();

  const isProfessional =
    /(marketer|marketing|growth|brand|content|demand|ops|operator|team|leader|manager|strategist)/.test(
      lower,
    );
  const isDemographic =
    /(aged|age|years old|silicon valley|gen z|millennial|students|everyone|all users)/.test(
      lower,
    );

  if (!normalized || isDemographic || !isProfessional) {
    return fallbackAudience;
  }

  return normalized;
}

function isConsumptionHeavyStepPlan(
  steps: MissionBriefDraftResponse["steps"],
): boolean {
  const consumptionOnlyCount = steps.filter((step) =>
    /^(watch|read|research|explore|review)\b/i.test(step.instruction.trim()) ||
    /^(watch|read|research|explore|review)\b/i.test(step.title.trim()),
  ).length;

  return consumptionOnlyCount > 1;
}

function isVerifiableSuccessCriterionDefinition(
  definition: string,
  context: SuccessCriteriaContext,
): boolean {
  if (definition.trim().length < 20) return false;
  return analyzeSuccessCriterionDefinition(definition, context).valid;
}

function buildSuccessCriteriaContextFromDraft(
  draft: MissionBriefDraftResponse,
  input: MissionBriefGeneratorInput,
): SuccessCriteriaContext {
  return {
    artifactType: input.missionPlan.artifactType,
    format: draft.format,
    minimumSections: normalizeObservableMinimumSections(
      buildSuccessCriteriaContextFromSupport(input, draft.minimum_sections),
    ),
    missionFamily: input.missionPlan.missionFamily,
  };
}

function buildSuccessCriteriaContextFromSupport(
  input: MissionBriefGeneratorInput,
  minimumSections: string[],
): SuccessCriteriaContext {
  return {
    artifactType: input.missionPlan.artifactType,
    format: input.missionPlan.artifactType === "message-matrix" ? "table" : "doc",
    minimumSections,
    missionFamily: input.missionPlan.missionFamily,
  };
}

function buildObservableArtifactSupport(
  input: MissionBriefGeneratorInput,
  minimumSections: string[] = [],
): ArtifactNormalizationSupport {
  const context = buildSuccessCriteriaContextFromSupport(input, minimumSections);
  const normalizedSections = normalizeObservableMinimumSections(context);

  if (isPromptEngineeringResearchLane(input)) {
    const sections = [
      "named workflow",
      "prompt structure 1",
      "prompt structure 2",
      "failure modes to avoid",
      "recommended workflow change",
    ];

    return {
      minimumSections: sections,
      outputDescription:
        "A workflow-specific brief that shows how to improve one AI-assisted marketing workflow, such as content-brief drafting, with two explicit prompt structures, two failure modes, and one recommended workflow change.",
      completionDefinition:
        "The brief is complete when it names one workflow, documents two specific prompt structures to test, lists two concrete failure modes to avoid, and ends with one recommended workflow change backed by at least two cited packet-backed claims.",
      steps: [
        {
          title: "Choose one workflow",
          instruction:
            "Name one recurring marketing workflow to improve, such as AI-assisted content-brief drafting, and write the working thesis for why output quality breaks there now.",
          expected_output:
            'A named workflow and a one-sentence thesis, for example: "Content-brief drafting needs stronger prompt structure to produce more specific AI output."',
          estimated_minutes: 10,
        },
        {
          title: "Document two prompt structures",
          instruction:
            "Add two source-backed prompt structures that fit the chosen workflow and explain when each one should be used.",
          expected_output:
            "Two explicit prompt structures tied to the chosen workflow, each paired with a named use case or workflow moment.",
          estimated_minutes: 20,
        },
        {
          title: "Capture failure modes and the workflow recommendation",
          instruction:
            "List two concrete failure modes to avoid, then end with one workflow recommendation another marketer could apply in the next rep.",
          expected_output:
            "A finalized brief with two failure modes, one workflow recommendation, and at least two cited packet-backed claims.",
          estimated_minutes: 15,
        },
      ],
    };
  }

  if (isClaudeCodeMessagingLane(input)) {
    const sections = [
      "audience",
      "pain point",
      "value claim",
      "proof set",
      "objection",
      "non-fit boundary",
      "example phrasing",
    ];

    return {
      minimumSections: sections,
      outputDescription:
        "An internal message matrix for one marketer communication scenario that includes one audience, one pain point, one value claim, one proof set, one objection, one non-fit boundary, and example phrasing a teammate could actually reuse.",
      completionDefinition:
        "The matrix is complete when it names one audience, one pain point, one value claim, one proof set, one objection, one non-fit boundary, and includes at least two example phrasing lines a marketer could use in an internal memo or stakeholder update.",
      steps: [
        {
          title: "Lock the audience and pain point",
          instruction:
            "Choose one concrete communication scenario, such as a product marketer briefing a marketing ops lead on whether to pilot Claude Code for a workflow, then name the audience and the pain point first.",
          expected_output:
            "A matrix outline with a single audience, a single workflow pain point, and a clear value question to answer.",
          estimated_minutes: 10,
        },
        {
          title: "Build the value case",
          instruction:
            "Fill the matrix with one value claim, one proof set, one objection, and one non-fit boundary so the message stays honest and usable.",
          expected_output:
            "A draft matrix that includes a value claim, proof set, objection, and non-fit boundary for the chosen audience.",
          estimated_minutes: 20,
        },
        {
          title: "Write the usable phrasing",
          instruction:
            "Add at least two example phrasing lines that a marketer could paste into an internal memo, Slack note, or pilot recommendation.",
          expected_output:
            "A finalized message matrix with at least two reusable phrasing lines and a bounded recommendation.",
          estimated_minutes: 15,
        },
      ],
    };
  }

  if (
    input.missionPlan.missionFamily === "messaging-translation" ||
    input.missionPlan.artifactType === "message-matrix"
  ) {
    return {
      minimumSections: normalizedSections,
      outputDescription:
        "A message matrix with explicit fields for audience/problem, prompt principle, marketer benefit, and example phrasing.",
      completionDefinition:
        "The matrix is complete when it includes the required fields, at least three rows, and at least two source-backed notes or cited claims.",
      steps: [
        {
          title: "Define the matrix structure",
          instruction:
            "Set up the message matrix using the required fields before you draft any rows.",
          expected_output:
            `A matrix outline with the fields "${normalizedSections[0]}", "${normalizedSections[1]}", "${normalizedSections[2]}", and "${normalizedSections[3]}".`,
          estimated_minutes: 10,
        },
        {
          title: "Draft the core rows",
          instruction:
            "Fill at least three rows by translating the packet claims into marketer-facing message choices and example phrasing.",
          expected_output:
            "A draft matrix with at least three rows, each naming a prompt principle, a marketer benefit, and example phrasing.",
          estimated_minutes: 25,
        },
        {
          title: "Add source-backed proof",
          instruction:
            "Attach cited packet-backed claims or source-backed notes to the rows that should be defended with evidence.",
          expected_output:
            "A finalized matrix with at least two rows that include cited packet-backed claims or source-backed notes.",
          estimated_minutes: 10,
        },
      ],
    };
  }

  return {
    minimumSections: normalizedSections,
    outputDescription:
      "A research brief with explicit sections for the working thesis, source-backed prompt patterns, marketing implications, and the recommended next move.",
    completionDefinition:
      "The brief is complete when the required sections are filled, at least three recommendations or workflow patterns are documented, and at least two cited packet-backed claims appear in the brief.",
    steps: [
      {
        title: "Lock the brief structure",
        instruction:
          "Set up the brief using the required sections before drafting recommendations.",
        expected_output:
          `A brief outline with the sections "${normalizedSections[0]}", "${normalizedSections[1]}", "${normalizedSections[2]}", and "${normalizedSections[3]}".`,
        estimated_minutes: 10,
      },
      {
        title: "Draft the recommendations",
        instruction:
          "Document at least three source-backed recommendations or workflow patterns and pair each one with a named marketer use case or workflow implication.",
        expected_output:
          "A draft brief containing at least three explicit recommendations or workflow patterns paired with named marketer use cases.",
        estimated_minutes: 25,
      },
      {
        title: "Add evidence and finalize",
        instruction:
          "Cite packet-backed claims or source-backed recommendations directly in the brief so another marketer can review the evidence trail.",
        expected_output:
          "A finalized brief with at least two cited packet-backed claims or source-backed recommendations.",
        estimated_minutes: 10,
      },
    ],
  };
}

function buildLaunchLaneDraftOverrides(
  input: MissionBriefGeneratorInput,
): LaunchLaneDraftOverrides {
  if (isPromptEngineeringResearchLane(input)) {
    return {
      title: "Prompt Engineering for Content-Brief Drafting",
      shortTitle: "Prompt Workflow Upgrade",
      summary:
        "A workflow-specific brief that improves AI-assisted content-brief drafting with two source-backed prompt structures and clear failure modes.",
      whyThisMattersNow:
        "Access to AI is common now. The edge is getting reliable, specific output inside one recurring workflow like content-brief drafting, not collecting more generic prompt advice.",
      audience:
        "A content marketer improving AI-assisted content-brief drafting for a real campaign workflow.",
      artifactName: "Content-Brief Prompt Upgrade Brief",
      expectedValueIfCompleted:
        "You leave with a workflow recommendation another marketer could use in the next content-brief drafting rep, not just a pile of prompt notes.",
      checkpoints: [
        "The brief names one workflow, such as content-brief drafting, rather than prompt engineering in general.",
        "The brief documents two explicit prompt structures and two concrete failure modes.",
      ],
      commonFailureModes: [
        "Turning the brief into general prompt advice instead of a workflow recommendation.",
        "Listing prompt best practices without naming two usable structures and two failure modes.",
      ],
    };
  }

  if (isClaudeCodeMessagingLane(input)) {
    return {
      title: "Claude Code Pilot Message Matrix",
      shortTitle: "Claude Code Value Matrix",
      summary:
        "A message matrix a product marketer can use to explain one Claude Code pilot clearly and honestly to a marketing ops lead.",
      whyThisMattersNow:
        "More teams are evaluating AI workflow tools, but weak internal messaging turns those tools into hype or confusion. The advantage now is explaining one bounded use case clearly enough that a teammate can act on it.",
      audience:
        "A product marketer drafting an internal note for a marketing ops lead evaluating a Claude Code pilot.",
      artifactName: "Claude Code Internal Value Matrix",
      expectedValueIfCompleted:
        "You leave with a message asset you could paste into an internal memo, pilot proposal, or stakeholder update immediately.",
      checkpoints: [
        "The matrix names one audience, one workflow pain point, and one value claim before it explains the tool.",
        "The matrix includes one objection and one non-fit boundary so the recommendation stays credible.",
      ],
      commonFailureModes: [
        "Writing a product summary instead of a message asset for one real communication scenario.",
        "Explaining Claude Code features without naming the audience, objection, and non-fit boundary.",
      ],
    };
  }

  const topicName = capitalize(input.packet.topic.topicName);

  return {
    title: `${topicName} for Marketers`,
    shortTitle: input.packet.topic.topicName,
    summary: `${topicName} translated into a concrete marketer-facing first rep.`,
    whyThisMattersNow: input.packet.whyNow.summary,
    audience: "A marketer deciding what to do next with this capability",
    artifactName:
      input.missionPlan.artifactType === "message-matrix"
        ? "Message matrix"
        : "Audience brief",
    expectedValueIfCompleted:
      "You leave with a concrete first rep instead of a pile of scattered notes.",
    checkpoints: [
      "Your thesis is specific enough that another marketer would know what changed.",
      "The artifact contains at least one source-backed recommendation.",
    ],
    commonFailureModes: [
      "Repeating generic AI talking points instead of using the packet evidence.",
      "Making the artifact too broad for a single session.",
    ],
  };
}

function isPromptEngineeringResearchLane(
  input: MissionBriefGeneratorInput,
): boolean {
  return (
    input.packet.topic.topicSlug === "prompt-engineering" &&
    input.missionPlan.missionFamily === "research-synthesis"
  );
}

function isClaudeCodeMessagingLane(
  input: MissionBriefGeneratorInput,
): boolean {
  return (
    input.packet.topic.topicSlug === "claude-code" &&
    input.missionPlan.missionFamily === "messaging-translation"
  );
}

function shouldUseFallbackWhyNow(
  whyThisMattersNow: string,
  input: MissionBriefGeneratorInput,
): boolean {
  const normalized = whyThisMattersNow.trim().toLowerCase();

  if (normalized.length < 40) return true;
  if (isPromptEngineeringResearchLane(input)) {
    return /(prompt engineering matters|better prompts|prompt tips|generic prompts)/i.test(
      normalized,
    );
  }
  if (isClaudeCodeMessagingLane(input)) {
    return /(feature|features|tool overview|product summary|explain claude code)/i.test(
      normalized,
    );
  }

  return false;
}

function shouldUseFallbackExpectedValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (normalized.length < 40) return true;

  return /(learn|understand|explain|overview|notes|summarize)/i.test(normalized);
}

function isWeakArtifactStructure(minimumSections: string[]): boolean {
  return minimumSections.map((section) => section.trim()).filter(Boolean).length < 3;
}

function hasWeakObservableStepOutputs(
  steps: MissionBriefDraftResponse["steps"],
): boolean {
  return steps.some((step) =>
    /(first draft artifact|complete first draft|polished artifact ready for review|ready for review|plain-english working thesis|complete first draft artifact)/i.test(
      step.expected_output,
    ),
  );
}

function ensureRequiredSourceReferenceCoverage(
  references: MissionBriefV2["sourceReferences"],
): MissionBriefV2["sourceReferences"] {
  if (references.length === 0) {
    return references;
  }

  const ensureSection = (
    section: MissionBriefV2["sourceReferences"][number]["supportsSections"][number],
    referenceIndex: number,
  ): void => {
    if (references.some((reference) => reference.supportsSections.includes(section))) {
      return;
    }

    const target = references[Math.min(referenceIndex, references.length - 1)];
    if (!target) return;
    target.supportsSections = [...new Set([...target.supportsSections, section])];
  };

  ensureSection("why_marketing", 0);
  ensureSection("success_criteria", 1);

  return references;
}

function mapGuidanceLevel(
  fluencyLevel: MissionPlan["fluencyLevel"],
): NonNullable<MissionBriefV2["scaffolding"]>["guidanceLevel"] {
  switch (fluencyLevel) {
    case "exploring":
      return "guided";
    case "practicing":
      return "scaffolded";
    case "proficient":
      return "independent";
    default:
      return "solo";
  }
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function capitalize(value: string): string {
  return value.length === 0 ? value : value[0].toUpperCase() + value.slice(1);
}

export const __testing = {
  buildFallbackMissionBriefDraft,
  buildObservableArtifactSupport,
};
