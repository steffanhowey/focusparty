// ─── Embedding Pipeline ──────────────────────────────────────
// Generates text embeddings via OpenAI text-embedding-3-small
// and indexes content into fp_content_lake for semantic search.

import OpenAI from "openai";
import { createClient } from "@/lib/supabase/admin";
import type { BreakContentCandidate } from "@/lib/types";

// ─── OpenAI singleton ───────────────────────────────────────

let _openai: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

const EMBEDDING_MODEL = "text-embedding-3-small";

// ─── Public API ─────────────────────────────────────────────

/**
 * Generate a 1536-dimension embedding for a text string.
 * Uses text-embedding-3-small (~$0.02 per 1M tokens).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await getClient().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8000), // cap input to ~2K tokens
  });
  return response.data[0].embedding;
}

/**
 * Build the search text used for embedding generation.
 * Concatenates title, description, topics, and creator for
 * a balanced semantic representation.
 */
export function buildSearchText(item: {
  title: string;
  description?: string | null;
  topics?: string[] | null;
  creator_name?: string | null;
}): string {
  const parts = [item.title];
  if (item.description) parts.push(item.description.slice(0, 500));
  if (item.topics?.length) parts.push(item.topics.join(" "));
  if (item.creator_name) parts.push(`by ${item.creator_name}`);
  return parts.join(" | ");
}

/**
 * Index a scored video candidate into the content lake.
 * Called after evaluation passes (taste_score >= 55).
 * Fire-and-forget — errors are logged, not thrown.
 */
export async function indexVideoToContentLake(
  candidate: BreakContentCandidate,
  score: {
    taste_score: number;
    relevance_score: number | null;
    engagement_score: number | null;
    content_density: number | null;
    creator_authority: number | null;
    freshness_score: number | null;
    novelty_score: number | null;
    editorial_note: string | null;
    topics: string[] | null;
    segments: unknown[] | null;
    scaffolding?: unknown | null;
    scaffolding_status?: string | null;
    id?: string;
  }
): Promise<void> {
  const supabase = createClient();

  const searchText = buildSearchText({
    title: candidate.title,
    description: candidate.description,
    topics: score.topics,
    creator_name: candidate.creator,
  });

  const embedding = await generateEmbedding(searchText);

  const { error } = await supabase.from("fp_content_lake").upsert(
    {
      content_type: "video",
      external_id: candidate.external_id,
      source: "youtube",
      source_url: candidate.video_url,
      title: candidate.title,
      description: candidate.description,
      creator_name: candidate.creator,
      creator_id: candidate.channel_id,
      thumbnail_url: candidate.thumbnail_url,
      published_at: candidate.published_at,
      duration_seconds: candidate.duration_seconds,
      view_count: candidate.view_count,
      like_count: candidate.like_count,
      quality_score: score.taste_score,
      relevance_scores: {
        relevance: score.relevance_score,
        engagement: score.engagement_score,
        content_density: score.content_density,
        creator_authority: score.creator_authority,
        freshness: score.freshness_score,
        novelty: score.novelty_score,
      },
      topics: score.topics ?? [],
      editorial_note: score.editorial_note,
      scaffolding: score.scaffolding ?? null,
      scaffolding_status: score.scaffolding_status ?? "none",
      embedding: `[${embedding.join(",")}]`,
      embedding_model: EMBEDDING_MODEL,
      search_text: searchText,
      source_candidate_id: candidate.id,
      source_score_id: score.id ?? null,
      status: "active",
    },
    { onConflict: "content_type,external_id" }
  );

  if (error) {
    console.error("[learn/embeddings] content lake upsert failed:", error);
    throw error;
  }

  console.log(
    `[learn/embeddings] Indexed video "${candidate.title}" (score ${score.taste_score})`
  );
}

/**
 * Index an evaluated article into the content lake.
 */
export async function indexArticleToContentLake(article: {
  id: string;
  source_url: string;
  source_id: string;
  feed_label: string | null;
  title: string;
  summary: string | null;
  full_text: string | null;
  word_count: number | null;
  author: string | null;
  published_at: string | null;
  quality_score: number | null;
  relevance_scores: Record<string, number> | null;
  topics: string[];
  editorial_note: string | null;
}): Promise<void> {
  const supabase = createClient();

  const searchText = buildSearchText({
    title: article.title,
    description: article.summary,
    topics: article.topics,
    creator_name: article.author,
  });

  const embedding = await generateEmbedding(searchText);

  const { error } = await supabase.from("fp_content_lake").upsert(
    {
      content_type: "article",
      external_id: article.source_id,
      source: "rss",
      source_url: article.source_url,
      title: article.title,
      description: article.summary,
      creator_name: article.author,
      thumbnail_url: null,
      published_at: article.published_at,
      article_text: article.full_text?.slice(0, 50000) ?? null,
      article_word_count: article.word_count,
      article_source_feed: article.feed_label,
      quality_score: article.quality_score,
      relevance_scores: article.relevance_scores,
      topics: article.topics,
      editorial_note: article.editorial_note,
      embedding: `[${embedding.join(",")}]`,
      embedding_model: EMBEDDING_MODEL,
      search_text: searchText,
      status: "active",
    },
    { onConflict: "content_type,external_id" }
  );

  if (error) {
    console.error("[learn/embeddings] article upsert failed:", error);
    throw error;
  }

  console.log(
    `[learn/embeddings] Indexed article "${article.title}" (score ${article.quality_score})`
  );
}
