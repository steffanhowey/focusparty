import { SAFETY_PROMPT } from "@/lib/breaks/contentSafety";
import type { LaunchDomainKey, WorkflowSlug } from "@/lib/missions/types/common";

export interface SourcePacketPromptSource {
  source_index: number;
  source_item_id: string;
  title: string;
  creator_or_publication: string | null;
  published_at: string | null;
  source_kind: string;
  evidence_tier: string;
  summary: string;
  topics: string[];
  editorial_note: string | null;
  excerpt: string | null;
}

export interface SourcePacketPromptInput {
  topic_name: string;
  topic_slug: string;
  topic_category: string;
  heat_score_snapshot: number | null;
  signal_count_7d: number;
  source_diversity_7d: number;
  sources: SourcePacketPromptSource[];
}

export const SOURCE_PACKET_RESPONSE_SCHEMA = {
  name: "mission_source_packet_analysis",
  strict: true,
  schema: {
    type: "object",
    properties: {
      why_now: {
        type: "object",
        properties: {
          summary: { type: "string" },
          change_type: {
            type: "string",
            enum: [
              "new-release",
              "feature-maturation",
              "cost-shift",
              "workflow-adoption",
              "competitive-pressure",
              "evergreen-relevance",
            ],
          },
          what_changed: {
            type: "array",
            items: { type: "string" },
          },
          what_is_ready_now: {
            type: "array",
            items: { type: "string" },
          },
          what_is_noise_or_not_yet_proven: {
            type: "array",
            items: { type: "string" },
          },
          expiry_reason: { type: "string" },
        },
        required: [
          "summary",
          "change_type",
          "what_changed",
          "what_is_ready_now",
          "what_is_noise_or_not_yet_proven",
          "expiry_reason",
        ],
        additionalProperties: false,
      },
      key_claims: {
        type: "array",
        items: {
          type: "object",
          properties: {
            statement: { type: "string" },
            claim_type: {
              type: "string",
              enum: [
                "capability",
                "workflow-shift",
                "market-signal",
                "risk",
                "limitation",
              ],
            },
            confidence: { type: "number" },
            importance: {
              type: "string",
              enum: ["high", "medium", "low"],
            },
            source_indexes: {
              type: "array",
              items: { type: "number" },
            },
          },
          required: [
            "statement",
            "claim_type",
            "confidence",
            "importance",
            "source_indexes",
          ],
          additionalProperties: false,
        },
      },
      contradictions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            summary: { type: "string" },
            severity: {
              type: "string",
              enum: ["minor", "material"],
            },
            conflicting_claim_indexes: {
              type: "array",
              items: { type: "number" },
            },
            resolution_status: {
              type: "string",
              enum: ["resolved", "unresolved", "monitor"],
            },
            recommended_editorial_stance: { type: "string" },
          },
          required: [
            "summary",
            "severity",
            "conflicting_claim_indexes",
            "resolution_status",
            "recommended_editorial_stance",
          ],
          additionalProperties: false,
        },
      },
      uncertainties: {
        type: "array",
        items: {
          type: "object",
          properties: {
            summary: { type: "string" },
            reason: {
              type: "string",
              enum: [
                "low_source_count",
                "vendor_only",
                "community_rumor",
                "outdated_signal",
                "ambiguous_impact",
              ],
            },
            severity: {
              type: "string",
              enum: ["low", "medium", "high"],
            },
            affected_claim_indexes: {
              type: "array",
              items: { type: "number" },
            },
          },
          required: ["summary", "reason", "severity", "affected_claim_indexes"],
          additionalProperties: false,
        },
      },
      marketer_relevance_hints: {
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
            workflow_slug: {
              type: "string",
              enum: [
                "research-insight",
                "positioning-messaging",
                "content-systems",
                "campaigns-experiments",
                "workflow-design-operations",
              ],
            },
            impact_type: {
              type: "string",
              enum: ["speed", "quality", "coverage", "experimentation", "cost", "risk"],
            },
            why_marketers_should_care: { type: "string" },
            example_use_case: { type: "string" },
            missionable: { type: "boolean" },
            suggested_artifact: { type: ["string", "null"] },
          },
          required: [
            "launch_domain",
            "workflow_slug",
            "impact_type",
            "why_marketers_should_care",
            "example_use_case",
            "missionable",
            "suggested_artifact",
          ],
          additionalProperties: false,
        },
      },
    },
    required: [
      "why_now",
      "key_claims",
      "contradictions",
      "uncertainties",
      "marketer_relevance_hints",
    ],
    additionalProperties: false,
  },
} as const;

/** Build the source-packet analysis prompt payload. */
export function buildSourcePacketPrompt(
  input: SourcePacketPromptInput,
): { system: string; user: string } {
  return {
    system: `You are the mission evidence planner for SkillGap.ai.

Your job is to turn topic evidence into a reusable source packet for mission generation.
You are not writing the mission itself.

Rules:
- Be evidence-backed and specific.
- Do not invent claims that are not supported by the provided sources.
- Separate what is real now from what is hype, rumor, or still unclear.
- Prefer marketer-native workflow implications over abstract "AI is changing everything" statements.
- A marketer relevance hint must point to a concrete job-to-be-done.

${SAFETY_PROMPT}`,
    user: JSON.stringify(input),
  };
}

export function isLaunchDomainKey(value: string): value is LaunchDomainKey {
  return [
    "research-insight",
    "positioning-messaging",
    "content-systems",
    "campaigns-experiments",
    "workflow-design-operations",
  ].includes(value);
}

export function isWorkflowSlug(value: string): value is WorkflowSlug {
  return isLaunchDomainKey(value);
}
