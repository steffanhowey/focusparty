import { NextResponse } from "next/server";
import { searchVideos, getVideoDetails } from "@/lib/breaks/youtubeClient";
import { scoreForLearning } from "@/lib/learn/seedScorer";
import {
  generateEmbedding,
  buildSearchText,
} from "@/lib/learn/embeddings";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { SEED_CATEGORIES } from "@/lib/learn/seedTopics";

const MIN_DURATION = 120; // 2 min minimum
const MAX_DURATION = 2400; // 40 min maximum (longer OK for learning)
const MIN_QUALITY = 50; // Minimum quality score to index
const RESULTS_PER_QUERY = 8;

/**
 * POST /api/admin/seed-content-lake
 * Body: { categories?: string[], maxPerCategory?: number }
 *
 * Seeds the content lake with AI/learning videos from YouTube.
 * Protected by ADMIN_SECRET header.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get("x-admin-secret");
  if (authHeader !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const targetCategories: string[] =
    body.categories ?? SEED_CATEGORIES.map((c) => c.slug);
  const maxPerCategory: number = body.maxPerCategory ?? 15;

  const supabase = createAdminClient();
  const results: Array<{
    category: string;
    searched: number;
    scored: number;
    indexed: number;
    rejected: number;
  }> = [];

  // Get existing video IDs to deduplicate
  const { data: existingRows } = await supabase
    .from("fp_content_lake")
    .select("external_id")
    .eq("content_type", "video");
  const existingIds = new Set(
    (existingRows ?? []).map((r: { external_id: string }) => r.external_id)
  );

  for (const cat of SEED_CATEGORIES) {
    if (!targetCategories.includes(cat.slug)) continue;

    console.log(`[seed] Starting category: ${cat.label}`);
    let searched = 0;
    let scored = 0;
    let indexed = 0;
    let rejected = 0;

    // Search YouTube for each query in this category
    const allVideoIds = new Set<string>();

    for (const query of cat.queries) {
      try {
        const searchResults = await searchVideos(query, {
          maxResults: RESULTS_PER_QUERY,
          videoDuration: "medium", // 4-20 min
          order: "relevance",
        });
        searched += searchResults.length;

        for (const sr of searchResults) {
          if (!existingIds.has(sr.videoId)) {
            allVideoIds.add(sr.videoId);
          }
        }
      } catch (error) {
        console.error(`[seed] YouTube search failed for "${query}":`, error);
      }
    }

    // Also search for longer videos (medium filter caps at 20min, but tutorials can be longer)
    for (const query of cat.queries.slice(0, 2)) {
      try {
        const longResults = await searchVideos(query, {
          maxResults: 5,
          videoDuration: "long", // 20+ min
          order: "viewCount",
        });
        for (const sr of longResults) {
          if (!existingIds.has(sr.videoId)) {
            allVideoIds.add(sr.videoId);
          }
        }
      } catch {
        // Non-critical, continue
      }
    }

    // Get video details for all unique candidates
    const videoIds = [...allVideoIds].slice(0, maxPerCategory * 3);
    if (videoIds.length === 0) {
      results.push({ category: cat.slug, searched, scored, indexed, rejected });
      continue;
    }

    let videos;
    try {
      videos = await getVideoDetails(videoIds);
    } catch (error) {
      console.error(`[seed] Video details failed for ${cat.slug}:`, error);
      results.push({ category: cat.slug, searched, scored, indexed, rejected });
      continue;
    }

    // Filter by duration
    const validVideos = videos.filter(
      (v) =>
        v.durationSeconds >= MIN_DURATION && v.durationSeconds <= MAX_DURATION
    );

    // Score each video (cap at maxPerCategory * 2 to limit API calls)
    const toScore = validVideos.slice(0, maxPerCategory * 2);

    for (const video of toScore) {
      try {
        const score = await scoreForLearning({
          title: video.title,
          description: video.description,
          channelTitle: video.channelTitle,
          durationSeconds: video.durationSeconds,
          viewCount: video.viewCount,
        });
        scored++;

        if (score.rejected || score.quality_score < MIN_QUALITY) {
          rejected++;
          console.log(
            `[seed] Rejected: "${video.title}" (quality: ${score.quality_score}, reason: ${score.reject_reason ?? "low_quality"})`
          );
          continue;
        }

        // Index to content lake with embedding
        const searchText = buildSearchText({
          title: video.title,
          description: video.description,
          topics: score.topics,
          creator_name: video.channelTitle,
        });
        const embedding = await generateEmbedding(searchText);

        const { error } = await supabase.from("fp_content_lake").upsert(
          {
            content_type: "video",
            external_id: video.videoId,
            source: "youtube",
            source_url: `https://youtube.com/watch?v=${video.videoId}`,
            title: video.title,
            description: video.description,
            creator_name: video.channelTitle,
            creator_id: video.channelId,
            thumbnail_url: video.thumbnailUrl,
            published_at: video.publishedAt,
            duration_seconds: video.durationSeconds,
            view_count: video.viewCount,
            like_count: video.likeCount,
            quality_score: score.quality_score,
            relevance_scores: {
              relevance: score.relevance,
              teaching_quality: score.teaching_quality,
              practical_value: score.practical_value,
            },
            topics: score.topics,
            editorial_note: score.editorial_note,
            embedding: `[${embedding.join(",")}]`,
            embedding_model: "text-embedding-3-small",
            search_text: searchText,
            scaffolding: null,
            scaffolding_status: "none",
            status: "active",
          },
          { onConflict: "content_type,external_id" }
        );

        if (error) {
          console.error(
            `[seed] Upsert failed for "${video.title}":`,
            error
          );
        } else {
          indexed++;
          existingIds.add(video.videoId);
          console.log(
            `[seed] Indexed: "${video.title}" (quality: ${score.quality_score}, topics: ${score.topics.join(", ")})`
          );
        }

        // Stop if we've indexed enough for this category
        if (indexed >= maxPerCategory) break;
      } catch (error) {
        console.error(
          `[seed] Processing failed for "${video.title}":`,
          error
        );
      }
    }

    results.push({ category: cat.slug, searched, scored, indexed, rejected });
    console.log(
      `[seed] Category ${cat.slug}: searched=${searched} scored=${scored} indexed=${indexed} rejected=${rejected}`
    );
  }

  const totalIndexed = results.reduce((sum, r) => sum + r.indexed, 0);
  const totalSearched = results.reduce((sum, r) => sum + r.searched, 0);

  return NextResponse.json({
    success: true,
    summary: {
      categories_processed: results.length,
      total_searched: totalSearched,
      total_indexed: totalIndexed,
    },
    categories: results,
  });
}

/**
 * GET /api/admin/seed-content-lake
 * Returns the current state of the content lake.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get("x-admin-secret");
  if (authHeader !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: stats } = await supabase
    .from("fp_content_lake")
    .select("content_type, topics, quality_score")
    .eq("status", "active");

  const topicCounts: Record<string, number> = {};
  let total = 0;
  let avgQuality = 0;

  for (const row of (stats ?? []) as Array<{
    content_type: string;
    topics: string[] | null;
    quality_score: number | null;
  }>) {
    total++;
    avgQuality += row.quality_score ?? 0;
    for (const topic of row.topics ?? []) {
      topicCounts[topic] = (topicCounts[topic] ?? 0) + 1;
    }
  }

  return NextResponse.json({
    total_items: total,
    average_quality: total > 0 ? Math.round(avgQuality / total) : 0,
    topics: Object.entries(topicCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([topic, count]) => ({ topic, count })),
  });
}
