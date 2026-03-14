// ─── Learning Scaffolding Generator ─────────────────────────
// Turns a video + transcript into a complete learning experience
// with pre-watch challenges, key moments, comprehension checks,
// practice exercises, and discussion questions.
// Uses GPT-4o-mini with Structured Outputs.

import OpenAI from "openai";
import { createClient } from "@/lib/supabase/admin";
import { getTranscript, formatTranscriptForScaffolding } from "@/lib/breaks/transcript";
import { SAFETY_PROMPT } from "@/lib/breaks/contentSafety";

// ─── OpenAI singleton ───────────────────────────────────────

let _openai: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

// ─── Types ──────────────────────────────────────────────────

export interface Scaffolding {
  preWatch: PreWatchChallenge;
  keyMoments: KeyMoment[];
  comprehensionChecks: ComprehensionCheck[];
  exercise: PracticeExercise;
  discussionQuestion: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedLearningMinutes: number;
  generatedAt: string;
}

export interface PreWatchChallenge {
  prompt: string;
  estimatedMinutes: number;
  context: string;
}

export interface KeyMoment {
  timestampSeconds: number;
  label: string;
  concept: string;
  takeaway: string;
}

export interface ComprehensionCheck {
  question: string;
  answer: string;
  timestampHint: number | null;
}

export interface PracticeExercise {
  prompt: string;
  instructions: string[];
  estimatedMinutes: number;
  tools: string[];
  starterCode: string | null;
  successCriteria: string;
}

export interface ScaffoldingBatchResult {
  processed: number;
  succeeded: number;
  failed: number;
  skippedNoTranscript: number;
  durationMs: number;
  details: {
    videoId: string;
    status: "complete" | "failed" | "skipped";
    error?: string;
  }[];
}

// ─── System prompt ──────────────────────────────────────────

const SCAFFOLDING_SYSTEM_PROMPT = `You are a learning experience designer for an AI skills platform. You create scaffolding that turns passive video-watching into active learning.

Your audience: professionals learning AI skills (developers, designers, PMs, founders). They have 10-20 minutes. They're smart but busy.

For every video + transcript, you generate:

1. PRE-WATCH CHALLENGE: A concrete task the learner should attempt BEFORE watching. This activates prior knowledge and creates "productive struggle." Keep it under 5 minutes. Example: "Before watching, try to build a basic Next.js API route that calls the OpenAI API. Note where you get stuck — the video will address exactly those friction points."

2. KEY MOMENTS: 3-6 timestamps where distinct teachable concepts begin. Each needs a label, the concept taught, and a one-sentence takeaway. These serve as navigation waypoints and review anchors.

3. COMPREHENSION CHECKS: 2-3 questions that test whether the learner actually absorbed the key concepts (not trivia — conceptual understanding). Include the answer for self-checking. Reference the video timestamp where each answer is covered.

4. PRACTICE EXERCISE: One hands-on exercise the learner can do in 5-15 minutes after watching. Must be specific: name the tools, describe the steps, give starter code if relevant, and define success criteria. The exercise should build on what the video taught, not just repeat it.

5. DISCUSSION QUESTION: One thought-provoking question for group reflection in the room. Should spark debate, not have a single right answer. Example: "The video uses GPT-4o for code review — when does AI code review add value vs. create false confidence?"

Your output must follow the exact JSON schema provided. Be specific and actionable. Never generate vague scaffolding like "try building something similar" — name the tools, describe the exact steps, define completion criteria.

${SAFETY_PROMPT}`;

// ─── Structured Output schema ───────────────────────────────

const SCAFFOLDING_SCHEMA = {
  name: "scaffolding_output",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      difficulty: {
        type: "string" as const,
        enum: ["beginner", "intermediate", "advanced"],
      },
      estimated_learning_minutes: {
        type: "number" as const,
        description: "Total active learning time including video watch + exercise",
      },
      pre_watch: {
        type: "object" as const,
        properties: {
          prompt: { type: "string" as const },
          estimated_minutes: { type: "number" as const },
          context: { type: "string" as const },
        },
        required: ["prompt", "estimated_minutes", "context"] as const,
        additionalProperties: false,
      },
      key_moments: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            timestamp_seconds: { type: "number" as const },
            label: { type: "string" as const },
            concept: { type: "string" as const },
            takeaway: { type: "string" as const },
          },
          required: ["timestamp_seconds", "label", "concept", "takeaway"] as const,
          additionalProperties: false,
        },
      },
      comprehension_checks: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            question: { type: "string" as const },
            answer: { type: "string" as const },
            timestamp_hint: { type: ["number", "null"] as const },
          },
          required: ["question", "answer", "timestamp_hint"] as const,
          additionalProperties: false,
        },
      },
      exercise: {
        type: "object" as const,
        properties: {
          prompt: { type: "string" as const },
          instructions: {
            type: "array" as const,
            items: { type: "string" as const },
          },
          estimated_minutes: { type: "number" as const },
          tools: {
            type: "array" as const,
            items: { type: "string" as const },
          },
          starter_code: { type: ["string", "null"] as const },
          success_criteria: { type: "string" as const },
        },
        required: ["prompt", "instructions", "estimated_minutes", "tools", "starter_code", "success_criteria"] as const,
        additionalProperties: false,
      },
      discussion_question: { type: "string" as const },
    },
    required: [
      "difficulty",
      "estimated_learning_minutes",
      "pre_watch",
      "key_moments",
      "comprehension_checks",
      "exercise",
      "discussion_question",
    ] as const,
    additionalProperties: false,
  },
};

// ─── Generate scaffolding for a single video ────────────────

/**
 * Generate learning scaffolding for a scored video with transcript.
 * Uses GPT-4o-mini with Structured Outputs.
 * Returns null on failure (fail-gracefully pattern).
 */
export async function generateScaffolding(input: {
  videoId: string;
  title: string;
  description: string;
  creator: string;
  durationSeconds: number;
  topics: string[];
  tasteScore: number;
  transcript: { fullText: string; segments: { start: number }[] } | null;
}): Promise<Scaffolding | null> {
  try {
    const transcriptText = input.transcript
      ? formatTranscriptForScaffolding({
          videoId: input.videoId,
          language: "en",
          source: "youtube_captions",
          fullText: input.transcript.fullText,
          segments: [],
          wordCount: input.transcript.fullText.split(/\s+/).length,
          durationSeconds: input.durationSeconds,
        })
      : null;

    const hasTranscript = !!transcriptText;
    const durationMinutes = Math.ceil(input.durationSeconds / 60);

    const userPrompt = `Generate learning scaffolding for this video:

Title: ${input.title}
Creator: ${input.creator}
Duration: ${durationMinutes} minutes
Topics: ${input.topics.join(", ")}
Quality Score: ${input.tasteScore}/100

${hasTranscript ? `Transcript (for timestamps and content analysis):
---
${transcriptText}
---

Timed segments are available — use exact timestamps from the transcript for key moments.` : `No transcript available — generate scaffolding based on title, description, and topic context. Use estimated timestamps based on video duration.`}

Description: ${(input.description ?? "").slice(0, 500)}`;

    const response = await getClient().chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 2000,
      temperature: 0.4,
      messages: [
        { role: "system", content: SCAFFOLDING_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: SCAFFOLDING_SCHEMA,
      },
    });

    const text = response.choices[0]?.message?.content;
    if (!text) {
      console.error(`[scaffolding] Empty AI response for ${input.videoId}`);
      return null;
    }

    const parsed = JSON.parse(text);

    return {
      preWatch: {
        prompt: parsed.pre_watch.prompt,
        estimatedMinutes: parsed.pre_watch.estimated_minutes,
        context: parsed.pre_watch.context,
      },
      keyMoments: (parsed.key_moments ?? []).map(
        (km: { timestamp_seconds: number; label: string; concept: string; takeaway: string }) => ({
          timestampSeconds: km.timestamp_seconds,
          label: km.label,
          concept: km.concept,
          takeaway: km.takeaway,
        })
      ),
      comprehensionChecks: (parsed.comprehension_checks ?? []).map(
        (cc: { question: string; answer: string; timestamp_hint: number | null }) => ({
          question: cc.question,
          answer: cc.answer,
          timestampHint: cc.timestamp_hint,
        })
      ),
      exercise: {
        prompt: parsed.exercise.prompt,
        instructions: parsed.exercise.instructions,
        estimatedMinutes: parsed.exercise.estimated_minutes,
        tools: parsed.exercise.tools,
        starterCode: parsed.exercise.starter_code,
        successCriteria: parsed.exercise.success_criteria,
      },
      discussionQuestion: parsed.discussion_question,
      difficulty: parsed.difficulty,
      estimatedLearningMinutes: parsed.estimated_learning_minutes,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`[scaffolding] Generation failed for ${input.videoId}:`, error);
    return null;
  }
}

// ─── Batch scaffolding generation ───────────────────────────

/**
 * Generate scaffolding for a batch of scored candidates.
 * Processes sequentially to manage LLM costs.
 * Updates scaffolding_status on fp_break_content_scores as it goes.
 */
export async function generateScaffoldingBatch(options?: {
  limit?: number;
  minScore?: number;
  videoIds?: string[];
}): Promise<ScaffoldingBatchResult> {
  const startTime = Date.now();
  const limit = options?.limit ?? 10;
  const minScore = options?.minScore ?? 55;
  const supabase = createClient();

  // Find candidates needing scaffolding
  let query = supabase
    .from("fp_break_content_scores")
    .select("*, candidate:fp_break_content_candidates!inner(*)")
    .in("scaffolding_status", ["none", null])
    .gte("taste_score", minScore)
    .order("taste_score", { ascending: false })
    .limit(limit);

  if (options?.videoIds && options.videoIds.length > 0) {
    query = supabase
      .from("fp_break_content_scores")
      .select("*, candidate:fp_break_content_candidates!inner(*)")
      .in("candidate.external_id", options.videoIds)
      .limit(limit);
  }

  const { data: scores, error: fetchErr } = await query;
  if (fetchErr) {
    console.error("[scaffolding] fetch error:", fetchErr);
    return { processed: 0, succeeded: 0, failed: 0, skippedNoTranscript: 0, durationMs: Date.now() - startTime, details: [] };
  }

  if (!scores || scores.length === 0) {
    console.log("[scaffolding] No candidates need scaffolding");
    return { processed: 0, succeeded: 0, failed: 0, skippedNoTranscript: 0, durationMs: Date.now() - startTime, details: [] };
  }

  console.log(`[scaffolding] Processing ${scores.length} candidates`);

  let succeeded = 0;
  let failed = 0;
  let skippedNoTranscript = 0;
  const details: ScaffoldingBatchResult["details"] = [];

  for (const scored of scores) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const candidate = scored.candidate as any;
    if (!candidate) {
      details.push({ videoId: "unknown", status: "failed", error: "No candidate data" });
      failed++;
      continue;
    }

    const videoId = candidate.external_id;

    // Mark as generating
    await supabase
      .from("fp_break_content_scores")
      .update({ scaffolding_status: "generating" })
      .eq("id", scored.id);

    try {
      // Fetch transcript
      const transcript = await getTranscript(videoId);

      if (!transcript) {
        skippedNoTranscript++;
        // Still attempt scaffolding without transcript (lower quality)
        console.log(`[scaffolding] No transcript for "${candidate.title}", generating from metadata only`);
      }

      const scaffolding = await generateScaffolding({
        videoId,
        title: candidate.title ?? "",
        description: candidate.description ?? "",
        creator: candidate.creator ?? "Unknown",
        durationSeconds: candidate.duration_seconds ?? 0,
        topics: (scored.topics ?? []) as string[],
        tasteScore: scored.taste_score ?? 0,
        transcript: transcript
          ? { fullText: transcript.fullText, segments: transcript.segments }
          : null,
      });

      if (scaffolding) {
        await supabase
          .from("fp_break_content_scores")
          .update({
            scaffolding,
            scaffolding_status: "complete",
          })
          .eq("id", scored.id);

        succeeded++;
        details.push({ videoId, status: "complete" });
        console.log(`[scaffolding] Generated for "${candidate.title}"`);
      } else {
        await supabase
          .from("fp_break_content_scores")
          .update({ scaffolding_status: "failed" })
          .eq("id", scored.id);

        failed++;
        details.push({ videoId, status: "failed", error: "Generation returned null" });
      }
    } catch (error) {
      await supabase
        .from("fp_break_content_scores")
        .update({ scaffolding_status: "failed" })
        .eq("id", scored.id);

      failed++;
      details.push({ videoId, status: "failed", error: (error as Error).message });
      console.error(`[scaffolding] Error for "${candidate.title}":`, error);
    }
  }

  const durationMs = Date.now() - startTime;
  console.log(
    `[scaffolding] Done: ${succeeded} succeeded, ${failed} failed, ${skippedNoTranscript} no transcript in ${durationMs}ms`
  );

  return { processed: scores.length, succeeded, failed, skippedNoTranscript, durationMs, details };
}
