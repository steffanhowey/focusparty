// ─── Content Lake Data Layer ─────────────────────────────────
// CRUD operations for the fp_content_lake table.

import { createClient } from "@/lib/supabase/admin";
import type { ContentLakeItem, ContentSearchResult } from "@/lib/types";

const CONTENT_LAKE_COLS = `
  id, content_type, external_id, source, source_url,
  title, description, creator_name, thumbnail_url,
  published_at, duration_seconds, article_word_count,
  quality_score, topics, editorial_note,
  scaffolding, scaffolding_status, indexed_at
`;

/**
 * Fetch recently indexed content, ordered by quality.
 * Used for the Learn home "trending" section.
 */
export async function getRecentContent(
  limit = 20,
  contentType?: "video" | "article"
): Promise<ContentLakeItem[]> {
  const supabase = createClient();

  let query = supabase
    .from("fp_content_lake")
    .select(CONTENT_LAKE_COLS)
    .eq("status", "active")
    .order("quality_score", { ascending: false })
    .limit(limit);

  if (contentType) {
    query = query.eq("content_type", contentType);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[learn/contentLake] getRecentContent error:", error);
    return [];
  }
  return (data ?? []) as ContentLakeItem[];
}

/**
 * Fetch content by topic slug(s).
 */
export async function getContentByTopics(
  topics: string[],
  limit = 20
): Promise<ContentLakeItem[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("fp_content_lake")
    .select(CONTENT_LAKE_COLS)
    .eq("status", "active")
    .overlaps("topics", topics)
    .order("quality_score", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[learn/contentLake] getContentByTopics error:", error);
    return [];
  }
  return (data ?? []) as ContentLakeItem[];
}

/**
 * Semantic search via the search_content_lake() Postgres function.
 * Returns results with similarity and combined_score.
 */
export async function searchContentLake(
  queryEmbedding: number[],
  options?: {
    contentType?: "video" | "article";
    topics?: string[];
    limit?: number;
  }
): Promise<ContentSearchResult[]> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("search_content_lake", {
    query_embedding: `[${queryEmbedding.join(",")}]`,
    content_type_filter: options?.contentType ?? null,
    topic_filter: options?.topics?.length ? options.topics : null,
    result_limit: options?.limit ?? 20,
  });

  if (error) {
    console.error("[learn/contentLake] search error:", error);
    return [];
  }
  return (data ?? []) as ContentSearchResult[];
}

/**
 * Get total count of indexed content.
 */
export async function getContentLakeStats(): Promise<{
  total: number;
  videos: number;
  articles: number;
}> {
  const supabase = createClient();

  const { count: total } = await supabase
    .from("fp_content_lake")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  const { count: videos } = await supabase
    .from("fp_content_lake")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .eq("content_type", "video");

  const { count: articles } = await supabase
    .from("fp_content_lake")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .eq("content_type", "article");

  return {
    total: total ?? 0,
    videos: videos ?? 0,
    articles: articles ?? 0,
  };
}
