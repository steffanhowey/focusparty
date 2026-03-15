// ─── Batch Candidate Evaluator ──────────────────────────────
// Fetches pending candidates, scores them with AI, and persists
// scores + status updates to the database. Prefetches transcripts
// in batch for all candidates before evaluation.

import { createClient } from "@/lib/supabase/admin";
import { evaluateCandidate } from "./scoring";
import {
  getTranscriptBatch,
  formatTranscriptForScoring,
  parseChapters,
  formatChaptersForLLM,
} from "./transcript";
import type { TranscriptResult } from "./transcript";
import { screenContent } from "./contentSafety";
import type { BreakContentCandidate } from "@/lib/types";
import { getTopics, formatTaxonomyForPrompt, createTopic } from "@/lib/topics/taxonomy";
import { createSignalFromEvaluation } from "@/lib/topics/signalService";
import { ensureCreator, updateCreatorTopics } from "@/lib/creators/catalog";
import { indexVideoToContentLake } from "@/lib/learn/embeddings";

interface BatchResult {
  evaluated: number;
  rejected: number;
  errors: number;
}

/** Timeout for the evaluation loop — stop before Vercel's 60s limit. */
const EVAL_TIMEOUT_MS = 45_000;

/**
 * Evaluate up to `limit` pending candidates.
 * If worldKey is provided, only evaluates that world.
 * When category is NOT specified, uses fair queuing: fetches
 * proportionally across all categories so learning content
 * doesn't monopolize evaluation slots.
 * Processes sequentially to respect OpenAI rate limits.
 */
export async function evaluatePendingCandidates(
  worldKey?: string,
  limit = 50,
  category?: string
): Promise<BatchResult> {
  const supabase = createClient();

  // ── Fair queuing: fetch proportionally across categories ──
  const categories = category
    ? [category]
    : ["learning", "reset", "reflect", "move"];
  const perCategoryLimit = Math.ceil(limit / categories.length);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let candidates: any[] = [];

  for (const cat of categories) {
    let query = supabase
      .from("fp_break_content_candidates")
      .select("*")
      .eq("status", "pending")
      .eq("category", cat)
      .order("discovered_at", { ascending: true })
      .limit(perCategoryLimit);

    if (worldKey) {
      query = query.eq("world_key", worldKey);
    }

    const { data, error: fetchErr } = await query;
    if (fetchErr) {
      console.error(`[breaks/evaluate] fetch error for ${cat}:`, fetchErr);
      continue;
    }
    if (data) candidates.push(...data);
  }

  if (candidates.length === 0) {
    console.log("[breaks/evaluate] No pending candidates");
    return { evaluated: 0, rejected: 0, errors: 0 };
  }

  console.log(
    `[breaks/evaluate] Processing ${candidates.length} candidates`
  );

  // Load taxonomy once for the entire batch (cached, ~80 topics)
  let taxonomyPrompt: string | undefined;
  try {
    const topics = await getTopics();
    taxonomyPrompt = formatTaxonomyForPrompt(topics);
  } catch (err) {
    console.warn("[breaks/evaluate] Failed to load taxonomy, using freeform topics:", err);
  }

  // Batch-prefetch transcripts for all candidates
  const videoIds = (candidates as BreakContentCandidate[])
    .map((c) => c.external_id)
    .filter(Boolean);
  let transcriptMap = new Map<string, TranscriptResult>();
  try {
    transcriptMap = await getTranscriptBatch(videoIds);
    console.log(
      `[breaks/evaluate] Prefetched transcripts: ${transcriptMap.size}/${videoIds.length} available`
    );
  } catch (err) {
    console.warn("[breaks/evaluate] Batch transcript prefetch failed:", err);
  }

  // Fetch current shelf titles per (world, category) for novelty context.
  // Novelty must be scoped to category — a move video should be compared
  // against other move shelf items, not learning titles.
  const worldCategoryKeys = [
    ...new Set(candidates.map((c) => `${c.world_key}:${c.category ?? "learning"}`)),
  ];
  const shelfTitlesByWorldCategory = new Map<string, string[]>();

  for (const key of worldCategoryKeys) {
    const [wk, cat] = key.split(":");
    const { data: shelfItems } = await supabase
      .from("fp_break_content_items")
      .select("title")
      .eq("room_world_key", wk)
      .eq("category", cat)
      .eq("status", "active");
    shelfTitlesByWorldCategory.set(
      key,
      (shelfItems ?? []).map((i) => i.title)
    );
  }

  let evaluated = 0;
  let rejected = 0;
  let errors = 0;
  const startTime = Date.now();

  for (const candidate of candidates as BreakContentCandidate[]) {
    // Timeout guard — stop before Vercel's limit
    if (Date.now() - startTime > EVAL_TIMEOUT_MS) {
      console.log(
        `[breaks/evaluate] Timeout after ${evaluated + rejected} candidates (${Date.now() - startTime}ms), stopping`
      );
      break;
    }

    try {
      // ── Pre-screen: keyword blocklist (zero API cost) ──
      const safetyCheck = screenContent(candidate.title, candidate.description);
      if (!safetyCheck.safe) {
        await supabase
          .from("fp_break_content_candidates")
          .update({ status: "rejected" })
          .eq("id", candidate.id);
        rejected++;
        console.warn(
          `[breaks/evaluate] SAFETY PRE-SCREEN REJECTED "${candidate.title}" — ${safetyCheck.reason}`
        );
        continue;
      }

      // ── Transcript from prefetched batch ──
      let transcriptContext: { transcript: string; chapters: string } | null = null;
      const transcriptResult = candidate.external_id
        ? transcriptMap.get(candidate.external_id) ?? null
        : null;

      if (transcriptResult) {
        const formattedTranscript = formatTranscriptForScoring(transcriptResult);
        const chapters = parseChapters(candidate.description ?? null);
        const formattedChapters = formatChaptersForLLM(chapters);
        transcriptContext = {
          transcript: formattedTranscript,
          chapters: formattedChapters,
        };
      }

      const shelfKey = `${candidate.world_key}:${candidate.category ?? "learning"}`;
      const shelfTitles = shelfTitlesByWorldCategory.get(shelfKey) ?? [];
      const result = await evaluateCandidate(
        candidate,
        candidate.world_key,
        shelfTitles,
        transcriptContext,
        taxonomyPrompt
      );

      if (result.rejected) {
        // Mark as rejected
        await supabase
          .from("fp_break_content_candidates")
          .update({ status: "rejected" })
          .eq("id", candidate.id);
        rejected++;
        console.log(
          `[breaks/evaluate] REJECTED "${candidate.title}" — ${result.evaluationNotes}`
        );
      } else {
        // Insert score with transcript metadata
        const { error: scoreErr } = await supabase
          .from("fp_break_content_scores")
          .insert({
            candidate_id: candidate.id,
            world_key: candidate.world_key,
            taste_score: result.tasteScore,
            relevance_score: result.relevanceScore,
            engagement_score: result.engagementScore,
            content_density: result.contentDensity,
            creator_authority: result.creatorAuthority,
            freshness_score: result.freshnessScore,
            novelty_score: result.noveltyScore,
            evaluation_notes: result.evaluationNotes,
            editorial_note: result.editorialNote,
            segments: result.segments,
            best_duration: result.bestDuration,
            topics: result.topics,
            suggested_new_topics: result.suggestedNewTopics,
            transcript_available: !!transcriptResult,
            transcript_word_count: transcriptResult?.wordCount ?? null,
            transcript_source: transcriptResult?.source ?? null,
          });

        if (scoreErr) {
          console.error("[breaks/evaluate] score insert error:", scoreErr);
          errors++;
          continue;
        }

        // Mark candidate as evaluated
        await supabase
          .from("fp_break_content_candidates")
          .update({ status: "evaluated" })
          .eq("id", candidate.id);

        // Create pending topics for any AI-suggested new topics
        if (result.suggestedNewTopics?.length) {
          for (const suggestion of result.suggestedNewTopics) {
            try {
              await createTopic({
                slug: suggestion.slug,
                name: suggestion.name,
                category: suggestion.category,
                status: "pending",
              });
              console.log(
                `[breaks/evaluate] Created pending topic: ${suggestion.slug}`
              );
            } catch {
              // Duplicate slug — ignore
            }
          }
        }

        // Write signal for topic clustering pipeline
        try {
          await createSignalFromEvaluation(candidate, result.topics, result.tasteScore);
        } catch (err) {
          console.warn("[breaks/evaluate] signal creation failed:", err);
        }

        // Auto-catalog creator (fire-and-forget)
        if (candidate.channel_id) {
          ensureCreator(candidate.channel_id, {
            channelName: candidate.creator ?? undefined,
            discoverySource: "pipeline",
          }).catch((err) =>
            console.warn("[breaks/evaluate] creator catalog failed:", err)
          );
          updateCreatorTopics(candidate.channel_id, result.topics).catch((err) =>
            console.warn("[breaks/evaluate] creator topics update failed:", err)
          );
        }

        // Index to content lake for Learn search (fire-and-forget)
        if (result.tasteScore >= 55) {
          indexVideoToContentLake(candidate, {
            taste_score: result.tasteScore,
            relevance_score: result.relevanceScore,
            engagement_score: result.engagementScore,
            content_density: result.contentDensity,
            creator_authority: result.creatorAuthority,
            freshness_score: result.freshnessScore,
            novelty_score: result.noveltyScore,
            editorial_note: result.editorialNote,
            topics: result.topics,
            segments: result.segments,
          }).catch((err) =>
            console.warn("[breaks/evaluate] content lake indexing failed:", err)
          );
        }

        evaluated++;
        console.log(
          `[breaks/evaluate] SCORED "${candidate.title}" → ${result.tasteScore}${transcriptResult ? " (with transcript)" : ""} — ${result.evaluationNotes}`
        );
      }
    } catch (err) {
      console.error(
        `[breaks/evaluate] error on "${candidate.title}":`,
        err
      );
      errors++;
    }
  }

  console.log(
    `[breaks/evaluate] Done: ${evaluated} evaluated, ${rejected} rejected, ${errors} errors`
  );

  return { evaluated, rejected, errors };
}
