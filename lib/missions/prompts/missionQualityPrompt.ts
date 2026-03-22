import { SAFETY_PROMPT } from "@/lib/breaks/contentSafety";

export interface MissionQualityPromptInput {
  topic_slug: string;
  timeliness_class: string;
  source_packet_readiness_state: string;
  why_this_matters_now: string;
  why_this_matters_for_marketing: string;
  marketer_use_case: string;
  artifact: {
    artifact_type: string;
    artifact_name: string;
    output_description: string;
    audience: string;
    format: string;
  };
  execution: {
    timebox_minutes: number;
    hard_cap_minutes: number;
    steps: Array<{
      title: string;
      expected_output: string;
    }>;
  };
  success_criteria: Array<{
    label: string;
    definition: string;
  }>;
  source_references: Array<{
    claim_ids: string[];
    supports_sections: string[];
  }>;
  opinionated_take: string | null;
}

export const MISSION_QUALITY_RESPONSE_SCHEMA = {
  name: "mission_quality_gate",
  strict: true,
  schema: {
    type: "object",
    properties: {
      dimension_scores: {
        type: "object",
        properties: {
          freshness: { type: "number" },
          trustworthiness: { type: "number" },
          marketer_relevance: { type: "number" },
          specificity: { type: "number" },
          one_session_fit: { type: "number" },
          scaffolding: { type: "number" },
          opinionatedness: { type: "number" },
          source_traceability: { type: "number" },
          novel_user_value: { type: "number" },
        },
        required: [
          "freshness",
          "trustworthiness",
          "marketer_relevance",
          "specificity",
          "one_session_fit",
          "scaffolding",
          "opinionatedness",
          "source_traceability",
          "novel_user_value",
        ],
        additionalProperties: false,
      },
      reject_reasons: {
        type: "array",
        items: {
          type: "string",
          enum: [
            "off_domain_topic",
            "insufficient_source_packet",
            "no_marketer_relevance",
            "no_allowed_family_candidates",
            "family_selection_low_confidence",
            "stale_without_evergreen_rationale",
            "artifact_too_generic",
            "artifact_not_marketer_native",
            "timebox_not_one_session",
            "steps_ambiguous",
            "missing_required_inputs",
            "tool_unresolved",
            "missing_source_traceability",
            "too_few_success_criteria",
            "success_criteria_subjective_language",
            "success_criteria_missing_observable_condition",
            "success_criteria_missing_required_artifact_structure",
            "success_criteria_unverifiable",
            "room_fit_poor",
            "duplicate_active_version",
            "unresolved_material_contradiction",
            "low_novel_user_value",
          ],
        },
      },
      notes: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: ["dimension_scores", "reject_reasons", "notes"],
    additionalProperties: false,
  },
} as const;

/** Build the mission-quality prompt payload. */
export function buildMissionQualityPrompt(
  input: MissionQualityPromptInput,
): { system: string; user: string } {
  return {
    system: `You are the mission quality gate for SkillGap.ai.

Score whether this mission is worth surfacing.

Rules:
- Score each dimension 0-5.
- Be strict about genericity, vague artifacts, and weak time savings.
- Success criteria must be checkable from the final artifact itself, not from subjective quality impressions.
- "novel_user_value" means: would this save a marketer meaningful research and first-rep design time versus doing their own scattered research?
- Reject weak missions even if they are technically valid.

${SAFETY_PROMPT}`,
    user: JSON.stringify(input),
  };
}
