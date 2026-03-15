// ─── Hot-Topic-Triggered Discovery ──────────────────────────
// Finds YouTube content for specific hot topics identified by
// the heat engine. Runs alongside (not replacing) the existing
// scheduled discovery. More targeted and frequent.

import { createClient } from "@/lib/supabase/admin";
import { searchVideos, getVideoDetails } from "./youtubeClient";
import { screenContent } from "./contentSafety";
import { getHotTopics } from "@/lib/topics/heatEngine";
import { getTopicBySlug } from "@/lib/topics/taxonomy";
import type { Topic } from "@/lib/topics/taxonomy";
import { createSignalFromDiscovery } from "@/lib/topics/signalService";
import { getChannelsForTopic } from "@/lib/creators/catalog";

// ─── Constants ──────────────────────────────────────────────

const MIN_DURATION = 240; // 4 minutes
const MAX_DURATION = 1200; // 20 minutes
const DEFAULT_HEAT_THRESHOLD = 0.5;
const DEFAULT_MAX_TOPICS = 5;
const DEFAULT_MAX_RESULTS_PER_TOPIC = 10;
const FRESH_CONTENT_THRESHOLD = 5;
const FRESH_CONTENT_WINDOW_HOURS = 48;

// ─── Types ──────────────────────────────────────────────────

export interface HotTopicDiscoveryResult {
  topicsChecked: number;
  topicsSkipped: number;
  topicsDiscovered: number;
  totalCandidates: number;
  details: {
    topicSlug: string;
    heatScore: number;
    queriesRun: number;
    candidatesFound: number;
    candidatesNew: number;
  }[];
  durationMs: number;
}

// ─── Main function ──────────────────────────────────────────

/**
 * Run targeted YouTube discovery for hot topics.
 * Queries YouTube for topics with heat > threshold.
 * Uses topic name, aliases, and related terms as search queries.
 */
export async function discoverForHotTopics(options?: {
  heatThreshold?: number;
  maxTopics?: number;
  maxResultsPerTopic?: number;
  topicSlugs?: string[];
}): Promise<HotTopicDiscoveryResult> {
  const startTime = Date.now();
  const threshold = options?.heatThreshold ?? DEFAULT_HEAT_THRESHOLD;
  const maxTopics = options?.maxTopics ?? DEFAULT_MAX_TOPICS;
  const maxResults = options?.maxResultsPerTopic ?? DEFAULT_MAX_RESULTS_PER_TOPIC;

  let topics: { slug: string; name: string; heatScore: number; category: string; aliases: string[] }[] = [];

  if (options?.topicSlugs && options.topicSlugs.length > 0) {
    // Manual override: discover for specific topics regardless of heat
    for (const slug of options.topicSlugs) {
      const topic = await getTopicBySlug(slug);
      if (topic) {
        topics.push({
          slug: topic.slug,
          name: topic.name,
          heatScore: 1.0,
          category: topic.category,
          aliases: topic.aliases,
        });
      }
    }
  } else {
    // Get hot topics from heat engine
    const hotClusters = await getHotTopics(threshold, maxTopics * 2);
    topics = hotClusters
      .filter((c) => c.topic)
      .map((c) => ({
        slug: c.topic!.slug,
        name: c.topic!.name,
        heatScore: c.heatScore,
        category: c.topic!.category,
        aliases: c.topic!.aliases,
      }));
  }

  if (topics.length === 0) {
    console.log(`[hot-topic-discovery] No topics above threshold ${threshold}`);
    return {
      topicsChecked: 0,
      topicsSkipped: 0,
      topicsDiscovered: 0,
      totalCandidates: 0,
      details: [],
      durationMs: Date.now() - startTime,
    };
  }

  // Limit to maxTopics
  topics = topics.slice(0, maxTopics);

  const supabase = createClient();
  let topicsSkipped = 0;
  let topicsDiscovered = 0;
  let totalCandidates = 0;
  const details: HotTopicDiscoveryResult["details"] = [];

  for (const topic of topics) {
    // Check if topic already has enough fresh content
    const hasFresh = await hasEnoughFreshContent(topic.slug);
    if (hasFresh) {
      topicsSkipped++;
      details.push({
        topicSlug: topic.slug,
        heatScore: topic.heatScore,
        queriesRun: 0,
        candidatesFound: 0,
        candidatesNew: 0,
      });
      console.log(`[hot-topic-discovery] Skipping ${topic.slug} — enough fresh content`);
      continue;
    }

    // Generate search queries
    const queries = generateSearchQueries({
      slug: topic.slug,
      name: topic.name,
      category: topic.category as Topic["category"],
      aliases: topic.aliases,
    });

    // Also get channel-specific queries from creator catalog
    const relevantChannels = await getChannelsForTopic(topic.slug);

    // Collect all search results
    const allResults = [];
    let queriesRun = 0;

    // General topic searches (limit to 3 queries per topic)
    for (const query of queries.slice(0, 3)) {
      try {
        const results = await searchVideos(query, {
          maxResults: Math.min(maxResults, 10),
          videoDuration: "medium",
          order: "relevance",
          publishedAfter: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        });
        allResults.push(...results);
        queriesRun++;
        console.log(`[hot-topic-discovery] "${query}" → ${results.length} results`);
      } catch (err) {
        console.error(`[hot-topic-discovery] search error for "${query}":`, err);
      }
    }

    // Channel-specific searches (top 3 relevant creators)
    for (const channel of relevantChannels.slice(0, 3)) {
      try {
        const results = await searchVideos(topic.name, {
          channelId: channel.channelId,
          maxResults: 5,
          order: "date",
          publishedAfter: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
        allResults.push(...results);
        queriesRun++;
        console.log(
          `[hot-topic-discovery] channel:${channel.channelName}/"${topic.name}" → ${results.length} results`
        );
      } catch (err) {
        console.error(
          `[hot-topic-discovery] channel search error for ${channel.channelName}:`,
          err
        );
      }
    }

    if (allResults.length === 0) {
      details.push({
        topicSlug: topic.slug,
        heatScore: topic.heatScore,
        queriesRun,
        candidatesFound: 0,
        candidatesNew: 0,
      });
      continue;
    }

    // Deduplicate by video ID
    const uniqueIds = [...new Set(allResults.map((r) => r.videoId))];

    // Check which IDs already exist
    const { data: existing } = await supabase
      .from("fp_break_content_candidates")
      .select("external_id")
      .eq("source", "youtube")
      .in("external_id", uniqueIds);

    const existingSet = new Set((existing ?? []).map((r) => r.external_id));
    const newIds = uniqueIds.filter((id) => !existingSet.has(id));

    if (newIds.length === 0) {
      details.push({
        topicSlug: topic.slug,
        heatScore: topic.heatScore,
        queriesRun,
        candidatesFound: uniqueIds.length,
        candidatesNew: 0,
      });
      continue;
    }

    // Fetch full video details
    let videoDetails;
    try {
      videoDetails = await getVideoDetails(newIds.slice(0, 20));
    } catch (err) {
      console.error("[hot-topic-discovery] getVideoDetails error:", err);
      details.push({
        topicSlug: topic.slug,
        heatScore: topic.heatScore,
        queriesRun,
        candidatesFound: uniqueIds.length,
        candidatesNew: 0,
      });
      continue;
    }

    // Filter by duration and safety
    const filtered = videoDetails.filter((v) => {
      if (v.durationSeconds < MIN_DURATION || v.durationSeconds > MAX_DURATION) return false;
      const safety = screenContent(v.title, v.description);
      if (!safety.safe) {
        console.warn(`[hot-topic-discovery] SAFETY BLOCKED: "${v.title}" — ${safety.reason}`);
        return false;
      }
      return true;
    });

    // Insert candidates
    let inserted = 0;
    for (const video of filtered) {
      const { error } = await supabase
        .from("fp_break_content_candidates")
        .insert({
          source: "youtube",
          external_id: video.videoId,
          world_key: "default",
          category: "learning",
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
          status: "pending",
          discovery_source: "hot-topic",
        })
        .single();

      if (error) {
        if (error.code === "23505") continue;
        console.error("[hot-topic-discovery] insert error:", error);
      } else {
        inserted++;
        // Fire signal (fire-and-forget)
        try {
          await createSignalFromDiscovery({
            videoId: video.videoId,
            title: video.title,
            creator: video.channelTitle,
            viewCount: video.viewCount,
            publishedAt: video.publishedAt,
          });
        } catch (err) {
          console.warn("[hot-topic-discovery] signal creation failed:", err);
        }
      }
    }

    topicsDiscovered++;
    totalCandidates += inserted;
    details.push({
      topicSlug: topic.slug,
      heatScore: topic.heatScore,
      queriesRun,
      candidatesFound: uniqueIds.length,
      candidatesNew: inserted,
    });

    console.log(
      `[hot-topic-discovery] ${topic.slug} (heat=${topic.heatScore.toFixed(2)}): ${inserted} new candidates from ${queriesRun} queries`
    );
  }

  const durationMs = Date.now() - startTime;
  console.log(
    `[hot-topic-discovery] Done: ${topicsDiscovered} topics yielded ${totalCandidates} new candidates in ${durationMs}ms`
  );

  return {
    topicsChecked: topics.length,
    topicsSkipped,
    topicsDiscovered,
    totalCandidates,
    details,
    durationMs,
  };
}

// ─── Helpers ────────────────────────────────────────────────

/**
 * Generate YouTube search queries for a specific topic.
 * Uses topic name, aliases, and category-specific patterns.
 */
export function generateSearchQueries(topic: {
  slug: string;
  name: string;
  category: Topic["category"];
  aliases: string[];
}): string[] {
  const queries: string[] = [];

  // Primary: topic name
  queries.push(topic.name);

  // Aliases as separate queries
  for (const alias of topic.aliases.slice(0, 2)) {
    queries.push(alias);
  }

  // Category-specific patterns
  switch (topic.category) {
    case "tool":
      queries.push(`${topic.name} tutorial`);
      queries.push(`${topic.name} review 2026`);
      break;
    case "technique":
      queries.push(`${topic.name} how to`);
      queries.push(`${topic.name} guide`);
      break;
    case "concept":
      queries.push(`${topic.name} explained`);
      queries.push(`what is ${topic.name}`);
      break;
    case "platform":
      queries.push(`${topic.name} tutorial`);
      queries.push(`${topic.name} new features`);
      break;
    case "role":
      // Use name directly — already descriptive
      break;
  }

  // Deduplicate
  return [...new Set(queries)];
}

/**
 * Check if a topic already has sufficient fresh content.
 * Returns true if there are >= threshold scored candidates
 * for this topic from the last 48 hours.
 */
async function hasEnoughFreshContent(
  topicSlug: string,
  threshold = FRESH_CONTENT_THRESHOLD
): Promise<boolean> {
  const supabase = createClient();
  const windowStart = new Date(
    Date.now() - FRESH_CONTENT_WINDOW_HOURS * 60 * 60 * 1000
  ).toISOString();

  const { count } = await supabase
    .from("fp_break_content_scores")
    .select("*", { count: "exact", head: true })
    .contains("topics", [topicSlug])
    .gte("created_at", windowStart);

  return (count ?? 0) >= threshold;
}
