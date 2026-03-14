// ─── Content Selection & Curriculum Sequencing ───────────────
// Selects the best scored content for a topic and uses GPT-4o-mini
// to order it into a beginner→advanced learning progression.

import OpenAI from "openai";
import { createClient } from "@/lib/supabase/admin";
import { SAFETY_PROMPT } from "@/lib/breaks/contentSafety";
import type { Scaffolding } from "@/lib/scaffolding/generator";
import type { BreakSegment } from "@/lib/types";

// ─── OpenAI singleton ───────────────────────────────────────

let _openai: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

// ─── Types ──────────────────────────────────────────────────

export interface SelectedContent {
  candidateId: string;
  scoreId: string;
  externalId: string;
  title: string;
  creator: string;
  channelId: string;
  durationSeconds: number;
  tasteScore: number;
  topics: string[];
  scaffolding: Scaffolding | null;
  scaffoldingStatus: string;
  segments: BreakSegment[] | null;
  bestDuration: 3 | 5 | 10 | null;
  publishedAt: string | null;
}

export interface CurriculumItem extends SelectedContent {
  sequencePosition: number;
  learningRationale: string;
}

export interface CurriculumSequence {
  items: CurriculumItem[];
  totalDurationMinutes: number;
  difficultyProgression: string;
}

export interface ContentSelectionResult {
  selected: SelectedContent[];
  curriculum: CurriculumSequence;
}

// ─── Selection weights ──────────────────────────────────────

const SELECTION_WEIGHTS = {
  taste: 0.40,
  scaffolding: 0.30,
  creatorDiversity: 0.20,
  freshness: 0.10,
} as const;

const MAX_PER_CREATOR = 3;
const MIN_ITEMS = 8;
const MAX_ITEMS = 12;

// ─── Core ───────────────────────────────────────────────────

/**
 * Select the best content for a topic, ranked by composite score.
 */
export async function selectContentForTopic(
  topicSlug: string,
  options?: { minScore?: number; maxItems?: number }
): Promise<SelectedContent[]> {
  const minScore = options?.minScore ?? 55;
  const maxItems = options?.maxItems ?? MAX_ITEMS;
  const supabase = createClient();

  // Query scored candidates with matching topic
  const { data: rows, error } = await supabase
    .from("fp_break_content_scores")
    .select(`
      id,
      candidate_id,
      taste_score,
      scaffolding,
      scaffolding_status,
      segments,
      best_duration,
      topics,
      candidate:fp_break_content_candidates!inner(
        external_id, title, creator, channel_id,
        duration_seconds, published_at
      )
    `)
    .gte("taste_score", minScore)
    .contains("topics", [topicSlug])
    .order("taste_score", { ascending: false })
    .limit(50);

  if (error || !rows || rows.length === 0) {
    console.error("[rooms/contentSelector] Query error or no results:", error);
    return [];
  }

  // Map to SelectedContent
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candidates: SelectedContent[] = rows.map((row: any) => ({
    candidateId: row.candidate_id,
    scoreId: row.id,
    externalId: row.candidate?.external_id ?? "",
    title: row.candidate?.title ?? "",
    creator: row.candidate?.creator ?? "",
    channelId: row.candidate?.channel_id ?? "",
    durationSeconds: row.candidate?.duration_seconds ?? 0,
    tasteScore: row.taste_score ?? 0,
    topics: row.topics ?? [],
    scaffolding: row.scaffolding ?? null,
    scaffoldingStatus: row.scaffolding_status ?? "none",
    segments: row.segments ?? null,
    bestDuration: row.best_duration ?? null,
    publishedAt: row.candidate?.published_at ?? null,
  }));

  // Compute composite rank
  const now = Date.now();
  const creatorCounts = new Map<string, number>();
  const ranked: { item: SelectedContent; compositeScore: number }[] = [];

  for (const item of candidates) {
    // Scaffolding completeness
    const scaffoldingScore =
      item.scaffoldingStatus === "complete" ? 1.0 :
      item.scaffoldingStatus === "generating" ? 0.3 : 0.0;

    // Creator diversity bonus (decreases with more items per creator)
    const creatorCount = creatorCounts.get(item.channelId) ?? 0;
    const diversityScore = creatorCount === 0 ? 1.0 : creatorCount === 1 ? 0.5 : 0.0;
    creatorCounts.set(item.channelId, creatorCount + 1);

    // Freshness (newer = higher, normalized over 90 days)
    let freshnessScore = 0.5;
    if (item.publishedAt) {
      const ageMs = now - new Date(item.publishedAt).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      freshnessScore = Math.max(0, 1.0 - ageDays / 90);
    }

    const composite =
      (item.tasteScore / 100) * SELECTION_WEIGHTS.taste +
      scaffoldingScore * SELECTION_WEIGHTS.scaffolding +
      diversityScore * SELECTION_WEIGHTS.creatorDiversity +
      freshnessScore * SELECTION_WEIGHTS.freshness;

    ranked.push({ item, compositeScore: composite });
  }

  // Sort by composite descending
  ranked.sort((a, b) => b.compositeScore - a.compositeScore);

  // Apply creator cap and select top items
  const selected: SelectedContent[] = [];
  const finalCreatorCounts = new Map<string, number>();

  for (const { item } of ranked) {
    if (selected.length >= maxItems) break;

    const count = finalCreatorCounts.get(item.channelId) ?? 0;
    if (count >= MAX_PER_CREATOR) continue;

    finalCreatorCounts.set(item.channelId, count + 1);
    selected.push(item);
  }

  return selected;
}

/**
 * Use GPT-4o-mini to sequence selected content into a curriculum.
 * Falls back to taste_score order on failure.
 */
export async function sequenceCurriculum(
  topicSlug: string,
  topicName: string,
  items: SelectedContent[]
): Promise<CurriculumSequence> {
  if (items.length === 0) {
    return { items: [], totalDurationMinutes: 0, difficultyProgression: "empty" };
  }

  try {
    const openai = getClient();

    const itemSummaries = items.map((item, i) => ({
      index: i,
      title: item.title,
      creator: item.creator,
      durationMinutes: Math.round((item.durationSeconds || 300) / 60),
      difficulty: item.scaffolding?.difficulty ?? "unknown",
      topics: item.topics.slice(0, 5),
      hasScaffolding: item.scaffoldingStatus === "complete",
    }));

    const systemPrompt = `You are a curriculum designer for SkillGap.ai, a learning platform for tech professionals.

You will be given a list of video content about "${topicName}". Your job is to ORDER them into the best learning progression — from foundational/beginner concepts to advanced/specialized topics.

Rules:
- Every item must appear exactly once in your output
- The sequence should build knowledge progressively
- Group related concepts together when it makes sense
- Provide a brief learning rationale for each item explaining WHY it belongs at that position

${SAFETY_PROMPT}`;

    const userPrompt = `Topic: ${topicName} (${topicSlug})

Videos to sequence (${items.length} items):
${JSON.stringify(itemSummaries, null, 2)}

Order these into the optimal learning progression.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "curriculum_sequence",
          strict: true,
          schema: {
            type: "object",
            properties: {
              sequence: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    index: { type: "number" },
                    learningRationale: { type: "string" },
                  },
                  required: ["index", "learningRationale"],
                  additionalProperties: false,
                },
              },
              difficultyProgression: { type: "string" },
            },
            required: ["sequence", "difficultyProgression"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Empty LLM response");

    const parsed = JSON.parse(content) as {
      sequence: { index: number; learningRationale: string }[];
      difficultyProgression: string;
    };

    // Map back to CurriculumItems
    const curriculumItems: CurriculumItem[] = [];
    for (let pos = 0; pos < parsed.sequence.length; pos++) {
      const entry = parsed.sequence[pos];
      const item = items[entry.index];
      if (!item) continue;
      curriculumItems.push({
        ...item,
        sequencePosition: pos + 1,
        learningRationale: entry.learningRationale,
      });
    }

    // Ensure all items are included (in case LLM missed some)
    const includedIds = new Set(curriculumItems.map((c) => c.scoreId));
    for (const item of items) {
      if (!includedIds.has(item.scoreId)) {
        curriculumItems.push({
          ...item,
          sequencePosition: curriculumItems.length + 1,
          learningRationale: "Additional content",
        });
      }
    }

    const totalDurationMinutes = Math.round(
      curriculumItems.reduce((sum, item) => sum + (item.durationSeconds || 0), 0) / 60
    );

    return {
      items: curriculumItems,
      totalDurationMinutes,
      difficultyProgression: parsed.difficultyProgression,
    };
  } catch (err) {
    console.error("[rooms/contentSelector] Curriculum sequencing failed, using taste_score order:", err);
    return fallbackSequence(items);
  }
}

/**
 * Select content and sequence it into a curriculum in one call.
 */
export async function selectAndSequence(
  topicSlug: string,
  topicName: string
): Promise<ContentSelectionResult> {
  const selected = await selectContentForTopic(topicSlug);

  if (selected.length === 0) {
    return {
      selected: [],
      curriculum: { items: [], totalDurationMinutes: 0, difficultyProgression: "empty" },
    };
  }

  const curriculum = await sequenceCurriculum(topicSlug, topicName, selected);
  return { selected, curriculum };
}

// ─── Helpers ────────────────────────────────────────────────

function fallbackSequence(items: SelectedContent[]): CurriculumSequence {
  const sorted = [...items].sort((a, b) => b.tasteScore - a.tasteScore);
  const curriculumItems: CurriculumItem[] = sorted.map((item, i) => ({
    ...item,
    sequencePosition: i + 1,
    learningRationale: "Ordered by content quality score",
  }));

  const totalDurationMinutes = Math.round(
    curriculumItems.reduce((sum, item) => sum + (item.durationSeconds || 0), 0) / 60
  );

  return {
    items: curriculumItems,
    totalDurationMinutes,
    difficultyProgression: "Ordered by quality score (fallback)",
  };
}
