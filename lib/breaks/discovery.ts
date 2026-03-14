// ─── Break Content Discovery Engine ─────────────────────────
// Searches YouTube for candidate break content, deduplicates
// against existing candidates, and inserts new entries.

import { createClient } from "@/lib/supabase/admin";
import { searchVideos, getVideoDetails } from "./youtubeClient";
import {
  WORLD_BREAK_PROFILES,
  ALL_CATEGORIES,
  getBreakProfile,
  pickQueries,
  pickChannel,
  MIN_DURATION,
  MAX_DURATION,
} from "./worldBreakProfiles";
import { screenContent } from "./contentSafety";
import { evaluatePendingCandidates } from "./evaluateBatch";
import { refreshShelf, type ShelfRefreshResult } from "./shelf";
import { createSignalFromDiscovery } from "@/lib/topics/signalService";

interface DiscoveryResult {
  worldKey: string;
  category: string;
  queriesRun: string[];
  candidatesFound: number;
  candidatesInserted: number;
}

/**
 * Discover new break content candidates for a specific world + category.
 * 1. Picks 1–2 search queries from the world/category profile
 * 2. Searches YouTube
 * 3. Fetches video details (duration, stats)
 * 4. Filters by duration constraints
 * 5. Deduplicates against existing candidates
 * 6. Inserts new candidates with status 'pending'
 */
export async function discoverCandidates(
  worldKey: string,
  category = "learning",
): Promise<DiscoveryResult> {
  const profile = getBreakProfile(worldKey);
  const queries = pickQueries(profile, 2, category);
  const supabase = createClient();

  // Compute published-after date
  const afterDate = new Date();
  afterDate.setMonth(afterDate.getMonth() - profile.publishedAfterMonths);
  const publishedAfter = afterDate.toISOString();

  // Collect all search results: topic queries + channel searches
  const allSearchResults = [];

  // 1. Topic-based searches (2 random queries)
  for (const query of queries) {
    try {
      const results = await searchVideos(query, {
        maxResults: 10,
        publishedAfter,
        videoDuration: "medium", // 4–20 minutes
        order: "relevance",
      });
      allSearchResults.push(...results);
      console.log(
        `[breaks/discover] "${query}" → ${results.length} results`
      );
    } catch (err) {
      console.error(`[breaks/discover] search error for "${query}":`, err);
    }
  }

  // 2. Channel-targeted search (1 random channel from profile/category)
  const channel = pickChannel(profile, category);
  if (channel) {
    try {
      const results = await searchVideos(channel.query ?? "", {
        maxResults: 10,
        publishedAfter,
        videoDuration: "medium",
        order: "date", // Latest uploads from the channel
        channelId: channel.channelId,
      });
      allSearchResults.push(...results);
      console.log(
        `[breaks/discover] channel:${channel.label} → ${results.length} results`
      );
    } catch (err) {
      console.error(
        `[breaks/discover] channel search error for "${channel.label}":`,
        err
      );
    }
  }

  if (allSearchResults.length === 0) {
    return { worldKey, category, queriesRun: queries, candidatesFound: 0, candidatesInserted: 0 };
  }

  // Deduplicate by video ID within this batch
  const uniqueIds = [...new Set(allSearchResults.map((r) => r.videoId))];

  // Check which IDs already exist as candidates for this world+category
  const { data: existing } = await supabase
    .from("fp_break_content_candidates")
    .select("external_id")
    .eq("world_key", worldKey)
    .eq("category", category)
    .eq("source", "youtube")
    .in("external_id", uniqueIds);

  const existingSet = new Set((existing ?? []).map((r) => r.external_id));
  const newIds = uniqueIds.filter((id) => !existingSet.has(id));

  if (newIds.length === 0) {
    console.log(`[breaks/discover] No new candidates for ${worldKey}/${category}`);
    return { worldKey, category, queriesRun: queries, candidatesFound: uniqueIds.length, candidatesInserted: 0 };
  }

  // Fetch full details for new videos
  let details;
  try {
    details = await getVideoDetails(newIds);
  } catch (err) {
    console.error("[breaks/discover] getVideoDetails error:", err);
    return { worldKey, category, queriesRun: queries, candidatesFound: uniqueIds.length, candidatesInserted: 0 };
  }

  // Filter by duration
  const durationFiltered = details.filter(
    (v) =>
      v.durationSeconds >= MIN_DURATION &&
      v.durationSeconds <= MAX_DURATION
  );

  // Safety screen — reject candidates with blocked keywords in title/description
  const filtered = durationFiltered.filter((v) => {
    const result = screenContent(v.title, v.description);
    if (!result.safe) {
      console.warn(`[breaks/discover] SAFETY BLOCKED: "${v.title}" — ${result.reason}`);
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
        world_key: worldKey,
        category,
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
      })
      .single();

    if (error) {
      // Unique constraint violation = already exists, skip
      if (error.code === "23505") continue;
      console.error("[breaks/discover] insert error:", error);
    } else {
      inserted++;
      // Write signal for topic clustering pipeline (fire-and-forget)
      try {
        await createSignalFromDiscovery({
          videoId: video.videoId,
          title: video.title,
          creator: video.channelTitle,
          viewCount: video.viewCount,
          publishedAt: video.publishedAt,
        });
      } catch (err) {
        console.warn("[breaks/discover] signal creation failed:", err);
      }
    }
  }

  console.log(
    `[breaks/discover] ${worldKey}/${category}: ${inserted} new candidates (${filtered.length} passed filters)`
  );

  return {
    worldKey,
    category,
    queriesRun: queries,
    candidatesFound: uniqueIds.length,
    candidatesInserted: inserted,
  };
}

// ─── Chained Pipeline ────────────────────────────────────────
// One call: discover → evaluate → promote. Eliminates the 3-step
// manual process and the 12-24 hour delay between discovery and
// content appearing on the shelf.

interface PipelineResult {
  discovery: DiscoveryResult;
  evaluation: { evaluated: number; rejected: number; errors: number };
  shelf: ShelfRefreshResult;
}

/**
 * Full pipeline for a single world + category: discover → evaluate → shelf refresh.
 * Use this for manual triggers and POST requests so content appears
 * immediately instead of waiting for separate cron jobs.
 */
export async function discoverAndPromote(
  worldKey: string,
  category = "learning",
): Promise<PipelineResult> {
  const discovery = await discoverCandidates(worldKey, category);
  const evaluation = await evaluatePendingCandidates(worldKey, 30);
  const shelf = await refreshShelf(worldKey, category);
  return { discovery, evaluation, shelf };
}

/**
 * Run the full pipeline for ALL worlds × ALL categories sequentially.
 * Used by bootstrap-all and manual "nuke and rebuild" workflows.
 */
export async function discoverAndPromoteAll(): Promise<PipelineResult[]> {
  const worldKeys = Object.keys(WORLD_BREAK_PROFILES);
  const results: PipelineResult[] = [];
  for (const worldKey of worldKeys) {
    for (const category of ALL_CATEGORIES) {
      try {
        const result = await discoverAndPromote(worldKey, category);
        results.push(result);
      } catch (err) {
        console.error(`[breaks/discover] pipeline error for ${worldKey}/${category}:`, err);
      }
    }
  }
  return results;
}

/**
 * Pick the world key with the oldest discovery (or no discovery).
 * Used by the cron job to rotate through worlds.
 */
export async function pickNextWorldKey(): Promise<string> {
  const supabase = createClient();
  const worldKeys = Object.keys(WORLD_BREAK_PROFILES);

  // Get latest discovered_at per world
  const { data } = await supabase
    .from("fp_break_content_candidates")
    .select("world_key, discovered_at")
    .order("discovered_at", { ascending: false });

  const latestByWorld = new Map<string, string>();
  for (const row of data ?? []) {
    if (!latestByWorld.has(row.world_key)) {
      latestByWorld.set(row.world_key, row.discovered_at);
    }
  }

  // Worlds with no candidates go first
  const undiscovered = worldKeys.filter((k) => !latestByWorld.has(k));
  if (undiscovered.length > 0) {
    return undiscovered[Math.floor(Math.random() * undiscovered.length)];
  }

  // Otherwise pick the one with the oldest latest discovery
  worldKeys.sort((a, b) => {
    const ta = latestByWorld.get(a) ?? "";
    const tb = latestByWorld.get(b) ?? "";
    return ta.localeCompare(tb);
  });

  return worldKeys[0];
}
