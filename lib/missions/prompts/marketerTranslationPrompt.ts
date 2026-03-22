import { SAFETY_PROMPT } from "@/lib/breaks/contentSafety";

export interface MarketerTranslationPromptInput {
  professional_function: string;
  function_perspective: string;
  mission_framing: string;
  topic_slug: string;
  topic_name: string;
  allowed_family_scope: string[];
  why_now_summary: string;
  key_claims: Array<{
    claim_id: string;
    statement: string;
    claim_type: string;
    importance: string;
  }>;
  marketer_hints: Array<{
    launch_domain: string;
    why_marketers_should_care: string;
    example_use_case: string;
    missionable: boolean;
    suggested_artifact: string | null;
  }>;
}

export const MARKETER_TRANSLATION_RESPONSE_SCHEMA = {
  name: "mission_marketer_translation",
  strict: true,
  schema: {
    type: "object",
    properties: {
      why_this_matters_for_function: { type: "string" },
      marketer_use_case: { type: "string" },
      affected_launch_domains: {
        type: "array",
        items: {
          type: "object",
          properties: {
            launch_domain: {
              type: "string",
              enum: [
                "research-insight",
                "positioning-messaging",
                "content-systems",
                "campaigns-experiments",
                "workflow-design-operations",
              ],
            },
            score: { type: "number" },
            rationale: { type: "string" },
          },
          required: ["launch_domain", "score", "rationale"],
          additionalProperties: false,
        },
      },
      mission_family_candidates: {
        type: "array",
        items: {
          type: "object",
          properties: {
            family: {
              type: "string",
              enum: [
                "adoption-evaluation",
                "research-synthesis",
                "messaging-translation",
                "campaign-design",
                "content-system-design",
                "workflow-design",
                "creative-direction",
              ],
            },
            score: { type: "number" },
            rationale: { type: "string" },
            recommended_artifact_type: {
              type: "string",
              enum: [
                "adoption-memo",
                "audience-brief",
                "competitive-brief",
                "message-matrix",
                "experiment-plan",
                "content-system",
                "workflow-spec",
                "creative-brief",
                "prompt-pack",
              ],
            },
          },
          required: ["family", "score", "rationale", "recommended_artifact_type"],
          additionalProperties: false,
        },
      },
      recommended_use_cases: {
        type: "array",
        items: { type: "string" },
      },
      non_use_cases: {
        type: "array",
        items: { type: "string" },
      },
      required_input_hints: {
        type: "array",
        items: { type: "string" },
      },
      opinionated_stance: { type: "string" },
      what_to_ignore: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: [
      "why_this_matters_for_function",
      "marketer_use_case",
      "affected_launch_domains",
      "mission_family_candidates",
      "recommended_use_cases",
      "non_use_cases",
      "required_input_hints",
      "opinionated_stance",
      "what_to_ignore",
    ],
    additionalProperties: false,
  },
} as const;

/** Build the marketer-translation prompt payload. */
export function buildMarketerTranslationPrompt(
  input: MarketerTranslationPromptInput,
): { system: string; user: string } {
  return {
    system: `You are the marketer-native translation engine for SkillGap.ai.

Turn raw AI/tool/workflow evidence into clear professional value for the target function.

Rules:
- Explain why the topic matters for the function, not for generic "knowledge workers".
- Produce exactly one concrete marketer use case that can anchor a one-session mission.
- Separate realistic first moves from hype.
- Recommend mission families based on the job shape, not the final output format.
- If allowed_family_scope contains exactly one family, tailor the translation to that family and make the launch-domain choice match it.
- If allowed_family_scope contains multiple families, include every supported family candidate from that scope instead of collapsing to one generic angle.
- Do not default everything to workflow operations when the topic can clearly support research or messaging work.

${SAFETY_PROMPT}`,
    user: JSON.stringify(input),
  };
}
