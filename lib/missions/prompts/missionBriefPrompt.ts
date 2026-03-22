import { SAFETY_PROMPT } from "@/lib/breaks/contentSafety";

export interface MissionBriefPromptInput {
  topic_slug: string;
  topic_name: string;
  professional_function: string;
  fluency_level: string;
  mission_family: string;
  artifact_type: string;
  launch_domain: string;
  why_this_matters_now: string;
  why_this_matters_for_marketing: string;
  marketer_use_case: string;
  opinionated_stance: string;
  what_to_ignore: string[];
  preferred_tools: string[];
  source_claims: Array<{
    claim_id: string;
    statement: string;
    importance: string;
    source_item_ids: string[];
  }>;
  source_items: Array<{
    source_item_id: string;
    title: string;
    summary: string;
  }>;
}

export const MISSION_BRIEF_RESPONSE_SCHEMA = {
  name: "mission_brief_v2_draft",
  strict: true,
  schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      short_title: { type: "string" },
      summary: { type: "string" },
      why_this_matters_now: { type: "string" },
      why_this_matters_for_marketing: { type: "string" },
      marketer_use_case: { type: "string" },
      artifact_name: { type: "string" },
      output_description: { type: "string" },
      audience: { type: "string" },
      format: {
        type: "string",
        enum: ["doc", "table", "deck-outline", "prompt-pack", "json", "worksheet"],
      },
      completion_definition: { type: "string" },
      minimum_sections: {
        type: "array",
        items: { type: "string" },
      },
      timebox_minutes: { type: "number" },
      hard_cap_minutes: { type: "number" },
      steps: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            instruction: { type: "string" },
            expected_output: { type: "string" },
            estimated_minutes: { type: "number" },
          },
          required: ["title", "instruction", "expected_output", "estimated_minutes"],
          additionalProperties: false,
        },
      },
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
      best_room_rationale: { type: "string" },
      source_references: {
        type: "array",
        minItems: 2,
        items: {
          type: "object",
          properties: {
            source_item_id: { type: "string" },
            claim_ids: {
              type: "array",
              items: { type: "string" },
            },
            supports_sections: {
              type: "array",
              items: {
                type: "string",
                enum: [
                  "why_now",
                  "why_marketing",
                  "artifact",
                  "steps",
                  "success_criteria",
                ],
              },
            },
          },
          required: ["source_item_id", "claim_ids", "supports_sections"],
          additionalProperties: false,
        },
      },
      required_inputs: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            description: { type: "string" },
            type: {
              type: "string",
              enum: [
                "brand_context",
                "product_context",
                "audience_context",
                "offer",
                "url",
                "text",
                "asset",
                "source_selection",
              ],
            },
            example: { type: ["string", "null"] },
            can_use_placeholder: { type: "boolean" },
          },
          required: ["label", "description", "type", "example", "can_use_placeholder"],
          additionalProperties: false,
        },
      },
      opinionated_take: { type: "string" },
      expected_value_if_completed: { type: "string" },
      suggested_primary_tool: { type: ["string", "null"] },
      checkpoints: {
        type: "array",
        items: { type: "string" },
      },
      common_failure_modes: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: [
      "title",
      "short_title",
      "summary",
      "why_this_matters_now",
      "why_this_matters_for_marketing",
      "marketer_use_case",
      "artifact_name",
      "output_description",
      "audience",
      "format",
      "completion_definition",
      "minimum_sections",
      "timebox_minutes",
      "hard_cap_minutes",
      "steps",
      "success_criteria",
      "best_room_rationale",
      "source_references",
      "required_inputs",
      "opinionated_take",
      "expected_value_if_completed",
      "suggested_primary_tool",
      "checkpoints",
      "common_failure_modes",
    ],
    additionalProperties: false,
  },
} as const;

/** Build the world-class mission-brief prompt payload. */
export function buildMissionBriefPrompt(
  input: MissionBriefPromptInput,
): { system: string; user: string } {
  return {
    system: `You are the mission brief generator for SkillGap.ai.

Generate a one-session, marketer-native mission brief.

Rules:
- The mission must be completable in one focused session.
- The artifact must be concrete and professionally useful.
- Steps must be bounded, ordered, and action-oriented.
- Use the provided claim ids and source item ids exactly.
- The brief must save the user real research and planning time.
- Do not drift into generic education, broad exploration, or vague homework.
- Do not create a watch-and-summarize mission. At most one step may review source material directly, and that step must feed a concrete artifact.
- The artifact audience must be professionally specific (for example, marketers, growth teams, content operators), never demographic or geographic.
- Anchor every step in the selected mission family and the packet claims. The steps should produce the artifact, not just collect notes.
- Return at least 3 success criteria, and each one must be observable from the submitted artifact itself.
- Every success criterion must name a concrete observable condition such as required sections, required fields, cited claims, explicit recommendations, explicit examples, or source-backed notes.
- Do not use subjective-only criteria like "formatted professionally", "clear and actionable", "readability", "practical", or "useful" unless the exact observable condition is also named.
- Include at least one source reference supporting why_marketing and at least one supporting success_criteria.

${SAFETY_PROMPT}`,
    user: JSON.stringify(input),
  };
}
