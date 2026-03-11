// ─── AI Taste Scoring Engine ────────────────────────────────
// Uses GPT-4o-mini with editorial personas to evaluate break
// content candidates. Computes a weighted taste score with
// freshness bonuses and creator authority boosts.

import OpenAI from "openai";
import { WORLD_CONFIGS } from "@/lib/worlds";
import type { BreakContentCandidate } from "@/lib/types";
import { getEditorialPersona } from "./editorialPersonas";
import { getCreatorBoost } from "./creatorAuthority";
import {
  computeFreshnessDimension,
  computeFreshnessBonus,
} from "./freshness";

// ─── OpenAI singleton ───────────────────────────────────────

let _openai: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

// ─── Score weights ──────────────────────────────────────────

const WEIGHTS = {
  relevance: 0.3,
  engagement: 0.2,
  educational_density: 0.2,
  creator_authority: 0.1,
  freshness: 0.1,
  novelty: 0.1,
} as const;

// ─── Types ──────────────────────────────────────────────────

export interface EvaluationResult {
  tasteScore: number;
  relevanceScore: number;
  engagementScore: number;
  educationalDensity: number;
  creatorAuthority: number;
  freshnessScore: number;
  noveltyScore: number;
  evaluationNotes: string;
  editorialNote: string;
  rejected: boolean;
}

// ─── Evaluate a single candidate ────────────────────────────

/**
 * Score a candidate using GPT-4o-mini with editorial persona.
 * Returns dimension scores + computed weighted taste score
 * with freshness bonuses and creator authority boosts.
 */
export async function evaluateCandidate(
  candidate: BreakContentCandidate,
  worldKey: string,
  currentShelfTitles: string[]
): Promise<EvaluationResult> {
  const worldConfig =
    WORLD_CONFIGS[worldKey as keyof typeof WORLD_CONFIGS] ??
    WORLD_CONFIGS.default;

  const persona = getEditorialPersona(worldKey);

  const shelfContext =
    currentShelfTitles.length > 0
      ? `Current shelf items:\n${currentShelfTitles.map((t) => `- ${t}`).join("\n")}`
      : "The shelf is currently empty.";

  // Compute raw engagement signal for context
  const viewLikeRatio =
    candidate.view_count && candidate.like_count
      ? ((candidate.like_count / candidate.view_count) * 100).toFixed(2)
      : "unknown";

  const response = await getClient().chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 600,
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content: `${persona.voicePrompt}

You are curating content for the "${worldConfig.label}" room.

Your job is to select only content that:
- teaches something valuable in a short time
- respects the user's time (no fluff, no clickbait, no padded intros)
- has high signal-to-noise ratio
- matches the specific energy and purpose of this room

Reject: ${persona.rejectPatterns.join(", ")}

Prefer: ${persona.preferPatterns.join(", ")}`,
      },
      {
        role: "user",
        content: `Evaluate this video candidate for the "${worldConfig.label}" room.

Title: ${candidate.title}
Creator: ${candidate.creator ?? "Unknown"}
Duration: ${candidate.duration_seconds ? Math.ceil(candidate.duration_seconds / 60) + " min" : "unknown"}
Description: ${(candidate.description ?? "").slice(0, 500)}
Views: ${candidate.view_count?.toLocaleString() ?? "unknown"}
Like/View ratio: ${viewLikeRatio}%
Published: ${candidate.published_at ?? "unknown"}

${shelfContext}

Score on 5 dimensions (each 0–100). Write a short editorial note explaining why a builder would care. Set reject=true if this content does not meet your standards.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "content_evaluation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            relevance_score: {
              type: "number",
              description:
                "How well the topic fits this room's builders (0-100)",
            },
            engagement_score: {
              type: "number",
              description:
                "Quality signals from view/like metrics and title quality (0-100)",
            },
            educational_density: {
              type: "number",
              description:
                "Likely information density based on title/description/creator (0-100)",
            },
            creator_authority: {
              type: "number",
              description:
                "Is this person a recognized expert or notable creator (0-100)",
            },
            novelty_score: {
              type: "number",
              description:
                "How different is this from current shelf items (0-100)",
            },
            evaluation_notes: {
              type: "string",
              description: "Brief 1-2 sentence explanation of the score",
            },
            editorial_note: {
              type: "string",
              description:
                "A 1-sentence editorial note starting with 'Why this matters:' explaining why a focused builder would value this content. Max 100 characters.",
            },
            reject: {
              type: "boolean",
              description:
                "true if this content should be rejected (low quality, off-topic, too long, clickbait)",
            },
          },
          required: [
            "relevance_score",
            "engagement_score",
            "educational_density",
            "creator_authority",
            "novelty_score",
            "evaluation_notes",
            "editorial_note",
            "reject",
          ],
          additionalProperties: false,
        },
      },
    },
  });

  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new Error("[breaks/scoring] Empty AI response");
  }

  const parsed = JSON.parse(text) as {
    relevance_score: number;
    engagement_score: number;
    educational_density: number;
    creator_authority: number;
    novelty_score: number;
    evaluation_notes: string;
    editorial_note: string;
    reject: boolean;
  };

  // Compute server-side freshness dimension
  const freshnessDim = computeFreshnessDimension(candidate.published_at);

  // Weighted sum with 6 dimensions
  const weightedScore =
    parsed.relevance_score * WEIGHTS.relevance +
    parsed.engagement_score * WEIGHTS.engagement +
    parsed.educational_density * WEIGHTS.educational_density +
    parsed.creator_authority * WEIGHTS.creator_authority +
    freshnessDim * WEIGHTS.freshness +
    parsed.novelty_score * WEIGHTS.novelty;

  // Additive freshness bonus (from PRD: +20/+10/+5/-10)
  const freshnessBonus = computeFreshnessBonus(
    candidate.published_at,
    parsed.creator_authority
  );

  // Additive creator authority boost (from authority graph)
  const creatorBoost = getCreatorBoost(worldKey, candidate.creator ?? "");

  // Final taste score (clamped 0–100)
  const tasteScore = Math.min(
    100,
    Math.max(0, weightedScore + freshnessBonus + creatorBoost)
  );

  return {
    tasteScore: Math.round(tasteScore * 100) / 100,
    relevanceScore: parsed.relevance_score,
    engagementScore: parsed.engagement_score,
    educationalDensity: parsed.educational_density,
    creatorAuthority: parsed.creator_authority,
    freshnessScore: freshnessDim,
    noveltyScore: parsed.novelty_score,
    evaluationNotes: parsed.evaluation_notes,
    editorialNote: parsed.editorial_note,
    rejected: parsed.reject,
  };
}
