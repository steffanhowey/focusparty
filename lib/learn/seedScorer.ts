// ─── Learn Content Scorer ─────────────────────────────────────
// Lightweight AI evaluation for learning content.
// Uses GPT-4o-mini Structured Outputs.

import OpenAI from "openai";
import { SAFETY_PROMPT } from "@/lib/breaks/contentSafety";

let _openai: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

export interface LearnScore {
  quality_score: number; // 0-100 overall quality
  relevance: number; // 0-100 how relevant to AI/tech learning
  teaching_quality: number; // 0-100 how well it teaches
  practical_value: number; // 0-100 how actionable/hands-on
  topics: string[]; // 2-5 topic slugs
  editorial_note: string; // 1-sentence summary
  rejected: boolean; // safety or quality reject
  reject_reason: string | null;
}

const SYSTEM_PROMPT = `You are a content evaluator for SkillGap.ai, an AI-native learning platform. Score YouTube videos for their value as learning resources about AI tools, coding, prompt engineering, and related topics.

${SAFETY_PROMPT}

Score each dimension 0-100:
- relevance: Is this about AI, machine learning, AI tools, coding with AI, or a directly related topic? Score 0 if it's off-topic (wellness, lifestyle, etc.)
- teaching_quality: Does it teach clearly? Good structure, explanations, examples?
- practical_value: Can someone DO something after watching? Tutorials and hands-on demos score highest.

Reject if:
- Safety score would be below 50
- Relevance is below 30 (not about AI/tech)
- It's a pure opinion/reaction video with no teaching value
- It's primarily promotional/advertisement content

Topics: assign 2-5 topic slugs from this list: prompt-engineering, ai-coding, cursor, copilot, ai-agents, rag, vector-databases, fine-tuning, llm-fundamentals, ai-tools, claude, chatgpt, v0, replit, midjourney, ai-for-business, ai-automation, no-code-ai, ai-design, machine-learning, neural-networks, transformers, embeddings, api-design, python-ai, javascript-ai, nextjs, react, ai-productivity, developer-tools

Quality score = (relevance * 0.3) + (teaching_quality * 0.4) + (practical_value * 0.3)`;

const SCORE_SCHEMA = {
  type: "object" as const,
  properties: {
    relevance: { type: "number" as const },
    teaching_quality: { type: "number" as const },
    practical_value: { type: "number" as const },
    topics: { type: "array" as const, items: { type: "string" as const } },
    editorial_note: { type: "string" as const },
    rejected: { type: "boolean" as const },
    reject_reason: { type: ["string", "null"] as const },
  },
  required: [
    "relevance",
    "teaching_quality",
    "practical_value",
    "topics",
    "editorial_note",
    "rejected",
    "reject_reason",
  ] as const,
  additionalProperties: false,
};

/**
 * Score a video for learning quality using GPT-4o-mini.
 */
export async function scoreForLearning(video: {
  title: string;
  description: string;
  channelTitle: string;
  durationSeconds: number;
  viewCount: number;
}): Promise<LearnScore> {
  const openai = getClient();

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Evaluate this video:
Title: ${video.title}
Channel: ${video.channelTitle}
Duration: ${Math.round(video.durationSeconds / 60)} minutes
Views: ${video.viewCount.toLocaleString()}
Description: ${(video.description ?? "").slice(0, 500)}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "learn_score",
          strict: true,
          schema: SCORE_SCHEMA,
        },
      },
    });

    const raw = JSON.parse(response.choices[0].message.content ?? "{}");
    const quality_score = Math.round(
      raw.relevance * 0.3 +
        raw.teaching_quality * 0.4 +
        raw.practical_value * 0.3
    );

    return {
      quality_score,
      relevance: raw.relevance,
      teaching_quality: raw.teaching_quality,
      practical_value: raw.practical_value,
      topics: raw.topics ?? [],
      editorial_note: raw.editorial_note ?? "",
      rejected: raw.rejected ?? false,
      reject_reason: raw.reject_reason ?? null,
    };
  } catch (error) {
    console.error("[learn/seedScorer] scoring failed:", error);
    return {
      quality_score: 0,
      relevance: 0,
      teaching_quality: 0,
      practical_value: 0,
      topics: [],
      editorial_note: "Scoring failed",
      rejected: true,
      reject_reason: "scoring_error",
    };
  }
}
