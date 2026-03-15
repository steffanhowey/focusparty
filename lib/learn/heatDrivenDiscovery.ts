// ─── Heat-Driven Content Lake Discovery ─────────────────────
// Bridges the heat engine to the content lake: when hot topics
// have thin content lake coverage, searches YouTube, scores for
// learning quality, and indexes winners directly into fp_content_lake.

import { createClient } from "@/lib/supabase/admin";
import { getHotTopics } from "@/lib/topics/heatEngine";
import { generateSearchQueries } from "@/lib/breaks/topicTriggeredDiscovery";
import { searchVideos, getVideoDetails } from "@/lib/breaks/youtubeClient";
import type { YTVideoDetails } from "@/lib/breaks/youtubeClient";
import { screenContent } from "@/lib/breaks/contentSafety";
import { scoreForLearning } from "@/lib/learn/seedScorer";
import type { LearnScore } from "@/lib/learn/seedScorer";
import { indexVideoToContentLake } from "@/lib/learn/embeddings";
import type { BreakContentCandidate } from "@/lib/types";

// ─── Constants ──────────────────────────────────────────────

const DEFAULT_HEAT_THRESHOLD = 0.5;
const DEFAULT_CONTENT_THRESHOLD = 5;
const DEFAULT_MAX_TOPICS = 3;
const DEFAULT_MAX_VIDEOS_PER_TOPIC = 8;
const MIN_DURATION = 240; // 4 minutes
const MAX_DURATION = 1200; // 20 minutes
const TIMEOUT_MS = 25_000;
const QUALITY_GATE = 40;

// ─── Types ──────────────────────────────────────────────────

export interface HeatDrivenResult {
  topicsChecked: number;
  topicsWithThinContent: number;
  videosSearched: number;
  videosScored: number;
  videosIndexed: number;
  errors: number;
  durationMs: number;
}

// ─── Main function ──────────────────────────────────────────

/**
 * Discover and index YouTube videos into the content lake for
 * hot topics with thin coverage. Designed to run as a step in
 * the hourly clustering cron.
 */
export async function discoverAndIndexForHotTopics(options?: {
  heatThreshold?: number;
  contentThreshold?: number;
  maxTopics?: number;
  maxVideosPerTopic?: number;
}): Promise<HeatDrivenResult> {
  const startTime = Date.now();
  const deadline = startTime + TIMEOUT_MS;
  const threshold = options?.heatThreshold ?? DEFAULT_HEAT_THRESHOLD;
  const contentThreshold = options?.contentThreshold ?? DEFAULT_CONTENT_THRESHOLD;
  const maxTopics = options?.maxTopics ?? DEFAULT_MAX_TOPICS;
  const maxVideosPerTopic = options?.maxVideosPerTopic ?? DEFAULT_MAX_VIDEOS_PER_TOPIC;

  const result: HeatDrivenResult = {
    topicsChecked: 0,
    topicsWithThinContent: 0,
    videosSearched: 0,
    videosScored: 0,
    videosIndexed: 0,
    errors: 0,
    durationMs: 0,
  };

  try {
    // 1. Get hot/emerging topics from heat engine
    const hotClusters = await getHotTopics(threshold, maxTopics * 2);
    const topicsWithCanonical = hotClusters.filter((c) => c.topic);

    if (topicsWithCanonical.length === 0) {
      console.log(`[heat-driven-discovery] No topics above threshold ${threshold}`);
      result.durationMs = Date.now() - startTime;
      return result;
    }

    // 2. Check content lake coverage per topic
    const supabase = createClient();
    const thinTopics: { slug: string; name: string; category: string; aliases: string[]; lakeCount: number }[] = [];

    for (const cluster of topicsWithCanonical) {
      const topic = cluster.topic!;
      result.topicsChecked++;

      const { count } = await supabase
        .from("fp_content_lake")
        .select("*", { count: "exact", head: true })
        .contains("topics", [topic.slug]);

      const lakeCount = count ?? 0;
      if (lakeCount < contentThreshold) {
        thinTopics.push({
          slug: topic.slug,
          name: topic.name,
          category: topic.category,
          aliases: topic.aliases,
          lakeCount,
        });
      }
    }

    if (thinTopics.length === 0) {
      console.log("[heat-driven-discovery] All hot topics have sufficient content lake coverage");
      result.durationMs = Date.now() - startTime;
      return result;
    }

    result.topicsWithThinContent = thinTopics.length;
    const topicsToProcess = thinTopics.slice(0, maxTopics);

    console.log(
      `[heat-driven-discovery] ${topicsToProcess.length} thin topics to process: ${topicsToProcess.map((t) => `${t.slug}(${t.lakeCount})`).join(", ")}`
    );

    // 3. For each thin topic: search → score → index
    for (const topic of topicsToProcess) {
      if (Date.now() > deadline) {
        console.warn("[heat-driven-discovery] Timeout reached, stopping");
        break;
      }

      try {
        await processTopicDiscovery(topic, maxVideosPerTopic, supabase, result);
      } catch (err) {
        console.error(`[heat-driven-discovery] Error processing ${topic.slug}:`, err);
        result.errors++;
      }
    }
  } catch (err) {
    console.error("[heat-driven-discovery] Fatal error:", err);
    result.errors++;
  }

  result.durationMs = Date.now() - startTime;
  console.log(
    `[heat-driven-discovery] Done: ${result.videosIndexed} videos indexed for ${result.topicsWithThinContent} thin topics in ${result.durationMs}ms`
  );
  return result;
}

// ─── Helpers ────────────────────────────────────────────────

/**
 * Search, score, and index videos for a single topic.
 */
async function processTopicDiscovery(
  topic: { slug: string; name: string; category: string; aliases: string[] },
  maxVideos: number,
  supabase: ReturnType<typeof createClient>,
  result: HeatDrivenResult
): Promise<void> {
  // Generate search queries from topic metadata
  const queries = generateSearchQueries({
    slug: topic.slug,
    name: topic.name,
    category: topic.category as "tool" | "technique" | "concept" | "platform" | "role",
    aliases: topic.aliases,
  });

  // Run YouTube searches (limit to 2 queries per topic for speed)
  const allVideoIds = new Set<string>();
  for (const query of queries.slice(0, 2)) {
    try {
      const results = await searchVideos(query, {
        maxResults: Math.min(maxVideos, 5),
        videoDuration: "medium",
        order: "relevance",
        publishedAfter: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      });
      results.forEach((r) => allVideoIds.add(r.videoId));
      result.videosSearched += results.length;
    } catch (err) {
      console.error(`[heat-driven-discovery] Search error for "${query}":`, err);
      result.errors++;
    }
  }

  if (allVideoIds.size === 0) return;

  // Deduplicate against existing content lake entries
  const videoIds = [...allVideoIds];
  const { data: existing } = await supabase
    .from("fp_content_lake")
    .select("external_id")
    .eq("content_type", "video")
    .in("external_id", videoIds);

  const existingSet = new Set((existing ?? []).map((r) => r.external_id));
  const newIds = videoIds.filter((id) => !existingSet.has(id));

  if (newIds.length === 0) {
    console.log(`[heat-driven-discovery] ${topic.slug}: all videos already in content lake`);
    return;
  }

  // Fetch full video details
  let videoDetails: YTVideoDetails[];
  try {
    videoDetails = await getVideoDetails(newIds.slice(0, maxVideos));
  } catch (err) {
    console.error(`[heat-driven-discovery] getVideoDetails error for ${topic.slug}:`, err);
    result.errors++;
    return;
  }

  // Filter by duration and safety
  const filtered = videoDetails.filter((v) => {
    if (v.durationSeconds < MIN_DURATION || v.durationSeconds > MAX_DURATION) return false;
    const safety = screenContent(v.title, v.description);
    if (!safety.safe) {
      console.warn(`[heat-driven-discovery] SAFETY BLOCKED: "${v.title}" — ${safety.reason}`);
      return false;
    }
    return true;
  });

  // Score and index each video
  for (const video of filtered) {
    try {
      const score = await scoreForLearning({
        title: video.title,
        description: video.description,
        channelTitle: video.channelTitle,
        durationSeconds: video.durationSeconds,
        viewCount: video.viewCount,
      });
      result.videosScored++;

      if (score.rejected || score.quality_score < QUALITY_GATE) {
        console.log(
          `[heat-driven-discovery] Rejected "${video.title}" (score=${score.quality_score}, reason=${score.reject_reason ?? "low quality"})`
        );
        continue;
      }

      // Index to content lake
      const [candidate, scoreObj] = buildContentLakeEntry(video, score);
      await indexVideoToContentLake(candidate, scoreObj);
      result.videosIndexed++;

      console.log(
        `[heat-driven-discovery] Indexed "${video.title}" for ${topic.slug} (score=${score.quality_score})`
      );
    } catch (err) {
      console.error(`[heat-driven-discovery] Score/index error for "${video.title}":`, err);
      result.errors++;
    }
  }
}

/**
 * Adapt YTVideoDetails + LearnScore into the shape expected by indexVideoToContentLake.
 */
function buildContentLakeEntry(
  video: YTVideoDetails,
  score: LearnScore
): [BreakContentCandidate, Parameters<typeof indexVideoToContentLake>[1]] {
  const candidate = {
    id: "",
    source: "youtube",
    external_id: video.videoId,
    world_key: "default",
    category: "learning" as const,
    title: video.title,
    description: video.description,
    creator: video.channelTitle,
    channel_id: video.channelId,
    video_url: `https://www.youtube.com/watch?v=${video.videoId}`,
    thumbnail_url: video.thumbnailUrl,
    duration_seconds: video.durationSeconds,
    published_at: video.publishedAt,
    view_count: video.viewCount,
    like_count: video.likeCount,
    comment_count: video.commentCount,
    discovered_at: new Date().toISOString(),
    status: "pending" as const,
    discovery_source: "hot-topic" as const,
  };

  const scoreObj = {
    taste_score: score.quality_score,
    relevance_score: score.relevance,
    engagement_score: null,
    content_density: score.teaching_quality,
    creator_authority: null,
    freshness_score: null,
    novelty_score: score.practical_value,
    editorial_note: score.editorial_note,
    topics: score.topics,
    segments: null,
  };

  return [candidate, scoreObj];
}
