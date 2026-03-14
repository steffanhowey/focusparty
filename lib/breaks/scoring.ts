// ─── AI Taste Scoring Engine ────────────────────────────────
// Uses GPT-4o-mini with editorial personas to evaluate break
// content candidates. Computes a weighted taste score with
// freshness bonuses and creator authority boosts.

import OpenAI from "openai";
import { WORLD_CONFIGS } from "@/lib/worlds";
import type { BreakContentCandidate, BreakSegment } from "@/lib/types";
import { getEditorialPersona, getCreatorBoost, getCategoryContentGoal } from "./worldBreakProfiles";
import {
  computeFreshnessDimension,
  computeFreshnessBonus,
} from "./freshness";
import { SAFETY_PROMPT } from "./contentSafety";

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
  content_density: 0.2,
  creator_authority: 0.1,
  freshness: 0.1,
  novelty: 0.1,
} as const;

// ─── Types ──────────────────────────────────────────────────

export interface EvaluationResult {
  tasteScore: number;
  relevanceScore: number;
  engagementScore: number;
  contentDensity: number;
  creatorAuthority: number;
  freshnessScore: number;
  noveltyScore: number;
  evaluationNotes: string;
  editorialNote: string;
  segments: BreakSegment[];
  bestDuration: 3 | 5 | 10;
  rejected: boolean;
  /** 2-5 canonical topic slugs from the taxonomy */
  topics: string[];
  /** Topics suggested by AI that aren't in the taxonomy (max 2) */
  suggestedNewTopics: { slug: string; name: string; category: string }[];
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
  currentShelfTitles: string[],
  transcriptContext?: { transcript: string; chapters: string } | null,
  taxonomyPrompt?: string
): Promise<EvaluationResult> {
  const worldConfig =
    WORLD_CONFIGS[worldKey as keyof typeof WORLD_CONFIGS] ??
    WORLD_CONFIGS.default;

  const category = candidate.category ?? "learning";
  const persona = getEditorialPersona(worldKey, category);
  const contentGoal = getCategoryContentGoal(category);

  const shelfContext =
    currentShelfTitles.length > 0
      ? `Current shelf items:\n${currentShelfTitles.map((t) => `- ${t}`).join("\n")}`
      : "The shelf is currently empty.";

  // Compute raw engagement signal for context
  const viewLikeRatio =
    candidate.view_count && candidate.like_count
      ? ((candidate.like_count / candidate.view_count) * 100).toFixed(2)
      : "unknown";

  // Build the content criteria based on category
  const contentCriteria = contentGoal
    ? `Your job: ${contentGoal}\n\nSelect only content that:\n- delivers genuine value for this category in a short time\n- respects the user's time (no fluff, no clickbait, no padded intros)\n- has high signal-to-noise ratio\n- actively engages the viewer (guided exercises, demonstrations, not just talking)`
    : `Your job is to select only content that:\n- teaches something valuable in a short time\n- respects the user's time (no fluff, no clickbait, no padded intros)\n- has high signal-to-noise ratio\n- matches the specific energy and purpose of this room`;

  const response = await getClient().chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 1000,
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content: `${persona.voicePrompt}

You are curating ${category} content for the "${worldConfig.label}" room.

${contentCriteria}

Reject: ${persona.rejectPatterns.join(", ")}

Prefer: ${persona.preferPatterns.join(", ")}
${SAFETY_PROMPT}${transcriptContext?.transcript ? `

When a transcript is provided, use it to:
- Assess content_density based on actual spoken content (count distinct concepts, assess pacing, identify filler)
- Identify segment start times using EXACT timestamps from the transcript
- Start segments at natural topic boundaries — never mid-sentence
- Skip: intros ("hey guys welcome back"), sponsor reads, outros, filler` : ""}`,
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
${transcriptContext?.transcript ? `
VIDEO TRANSCRIPT (timestamped):
${transcriptContext.transcript}
` : ""}${transcriptContext?.chapters ? `
VIDEO CHAPTERS:
${transcriptContext.chapters}
` : ""}
Score on 5 dimensions (each 0–100). Write a short editorial note explaining why a builder would care. Set reject=true if this content does not meet your standards.

Identify the best 3-minute, 5-minute, and 10-minute segments of this video. Each segment should start at the highest-value point for that duration.${transcriptContext?.transcript ? " Use EXACT timestamps from the transcript — start at natural topic boundaries where the first words hook the viewer." : ""} Skip intros, sponsor reads, and outros. Provide start times in seconds. If the video is shorter than a segment duration, use start: 0. For each segment, write a short label describing what the viewer will learn (max 60 chars).

Pick ONE best_duration (3, 5, or 10) — the single duration where this video delivers the most value as a break clip. Short dense explainers → 3. Tutorials with worked examples → 5. Deep dives, talks, and long-form analysis → 10.

Assign 2-5 topic slugs from the APPROVED TOPIC LIST below. Use ONLY exact slugs from this list. If the content covers a topic not in the list, use the closest match AND add the unlisted topic to "suggested_new_topics" (max 2).

APPROVED TOPICS:
${taxonomyPrompt ?? "react, system-design, creative-coding, typescript, prompt-engineering, vibe-coding, ai-pair-programming, cursor, nextjs"}`,
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
            content_density: {
              type: "number",
              description:
                "Content value density — how much useful material is packed into the runtime (0-100)",
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
            safety_score: {
              type: "number",
              description:
                "Content safety rating (0-100). 0 = harmful/inappropriate content (drugs, violence, hate, NSFW, controversy). 100 = clearly safe, educational, appropriate for all audiences. Set to 0 and reject=true for any content that violates safety rules.",
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
            segments: {
              type: "array",
              description:
                "Best 3-min, 5-min, and 10-min segments of the video",
              items: {
                type: "object",
                properties: {
                  duration: {
                    type: "number",
                    description: "Segment duration in minutes (3, 5, or 10)",
                  },
                  start: {
                    type: "number",
                    description:
                      "Start time in seconds for the highest-value window",
                  },
                  label: {
                    type: "string",
                    description:
                      "Short description of what the viewer will learn (max 60 chars)",
                  },
                },
                required: ["duration", "start", "label"],
                additionalProperties: false,
              },
            },
            best_duration: {
              type: "number",
              description:
                "The single best break duration for this video (3, 5, or 10 minutes). Pick based on content density, pacing, and where the strongest segment is.",
            },
            reject: {
              type: "boolean",
              description:
                "true if this content should be rejected (low quality, off-topic, too long, clickbait)",
            },
            topics: {
              type: "array",
              description:
                "2-5 canonical topic slugs from the approved topic list",
              items: { type: "string" },
            },
            suggested_new_topics: {
              type: "array",
              description:
                "Topics not in the approved list that this content covers (max 2). Only include if no approved topic fits.",
              items: {
                type: "object",
                properties: {
                  slug: { type: "string", description: "Lowercase hyphenated slug" },
                  name: { type: "string", description: "Human-readable name" },
                  category: {
                    type: "string",
                    enum: ["tool", "technique", "concept", "role", "platform"],
                  },
                },
                required: ["slug", "name", "category"],
                additionalProperties: false,
              },
            },
          },
          required: [
            "relevance_score",
            "engagement_score",
            "content_density",
            "creator_authority",
            "novelty_score",
            "safety_score",
            "evaluation_notes",
            "editorial_note",
            "segments",
            "best_duration",
            "reject",
            "topics",
            "suggested_new_topics",
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
    content_density: number;
    creator_authority: number;
    novelty_score: number;
    safety_score: number;
    evaluation_notes: string;
    editorial_note: string;
    segments: BreakSegment[];
    best_duration: number;
    reject: boolean;
    topics: string[];
    suggested_new_topics: { slug: string; name: string; category: string }[];
  };

  // Hard safety gate: force-reject anything the AI scores as unsafe.
  // Threshold is 50 (not 70) — we want to allow edgy/opinionated content
  // with casual profanity, just not genuinely harmful material.
  const safetyScore = parsed.safety_score ?? 100;
  const isSafetyRejected = safetyScore < 50;
  if (isSafetyRejected) {
    console.warn(
      `[breaks/scoring] SAFETY REJECT: "${candidate.title}" (safety_score=${safetyScore})`
    );
  }

  // Hard relevance gate: force-reject content that doesn't belong in this world.
  // A well-produced video about autoimmune disease has no place in Vibe Coding.
  // This catches high-quality-but-wrong-topic content that inflates on other dimensions.
  const relevanceScore = parsed.relevance_score ?? 0;
  const isRelevanceRejected = relevanceScore < 40;
  if (isRelevanceRejected) {
    console.warn(
      `[breaks/scoring] RELEVANCE REJECT: "${candidate.title}" for ${worldKey} (relevance=${relevanceScore})`
    );
  }

  // Compute server-side freshness dimension
  const freshnessDim = computeFreshnessDimension(candidate.published_at);

  // Weighted sum with 6 dimensions
  const weightedScore =
    parsed.relevance_score * WEIGHTS.relevance +
    parsed.engagement_score * WEIGHTS.engagement +
    parsed.content_density * WEIGHTS.content_density +
    parsed.creator_authority * WEIGHTS.creator_authority +
    freshnessDim * WEIGHTS.freshness +
    parsed.novelty_score * WEIGHTS.novelty;

  // Additive freshness bonus (from PRD: +20/+10/+5/-10)
  const freshnessBonus = computeFreshnessBonus(
    candidate.published_at,
    parsed.creator_authority
  );

  // Additive creator authority boost (from authority graph)
  const creatorBoost = getCreatorBoost(worldKey, candidate.creator ?? "", category);

  // Final taste score (clamped 0–100)
  const tasteScore = Math.min(
    100,
    Math.max(0, weightedScore + freshnessBonus + creatorBoost)
  );

  return {
    tasteScore: Math.round(tasteScore * 100) / 100,
    relevanceScore: parsed.relevance_score,
    engagementScore: parsed.engagement_score,
    contentDensity: parsed.content_density,
    creatorAuthority: parsed.creator_authority,
    freshnessScore: freshnessDim,
    noveltyScore: parsed.novelty_score,
    evaluationNotes: parsed.evaluation_notes,
    editorialNote: parsed.editorial_note,
    segments: parsed.segments ?? [],
    bestDuration: ([3, 5, 10].includes(parsed.best_duration) ? parsed.best_duration : 5) as 3 | 5 | 10,
    rejected: parsed.reject || isSafetyRejected || isRelevanceRejected,
    topics: (parsed.topics ?? []).map((t) => t.toLowerCase().trim()).slice(0, 5),
    suggestedNewTopics: (parsed.suggested_new_topics ?? []).slice(0, 2),
  };
}
