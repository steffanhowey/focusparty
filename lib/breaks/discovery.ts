// ─── Break Content Discovery Engine ─────────────────────────
// Searches YouTube for candidate break content, deduplicates
// against existing candidates, and inserts new entries.

import { createClient } from "@/lib/supabase/admin";
import { searchVideos, getVideoDetails } from "./youtubeClient";
import { WORLD_SEARCH_PROFILES, pickQueries, pickChannel } from "./searchProfiles";
import { screenContent } from "./contentSafety";

interface DiscoveryResult {
  worldKey: string;
  queriesRun: string[];
  candidatesFound: number;
  candidatesInserted: number;
}

/**
 * Discover new break content candidates for a specific world.
 * 1. Picks 1–2 search queries from the world's profile
 * 2. Searches YouTube
 * 3. Fetches video details (duration, stats)
 * 4. Filters by duration constraints
 * 5. Deduplicates against existing candidates
 * 6. Inserts new candidates with status 'pending'
 */
export async function discoverCandidates(
  worldKey: string
): Promise<DiscoveryResult> {
  const profile = WORLD_SEARCH_PROFILES[worldKey] ?? WORLD_SEARCH_PROFILES.default;
  const queries = pickQueries(profile, 2);
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

  // 2. Channel-targeted search (1 random channel from profile)
  const channel = pickChannel(profile);
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
    return { worldKey, queriesRun: queries, candidatesFound: 0, candidatesInserted: 0 };
  }

  // Deduplicate by video ID within this batch
  const uniqueIds = [...new Set(allSearchResults.map((r) => r.videoId))];

  // Check which IDs already exist as candidates for this world
  const { data: existing } = await supabase
    .from("fp_break_content_candidates")
    .select("external_id")
    .eq("world_key", worldKey)
    .eq("source", "youtube")
    .in("external_id", uniqueIds);

  const existingSet = new Set((existing ?? []).map((r) => r.external_id));
  const newIds = uniqueIds.filter((id) => !existingSet.has(id));

  if (newIds.length === 0) {
    console.log(`[breaks/discover] No new candidates for ${worldKey}`);
    return { worldKey, queriesRun: queries, candidatesFound: uniqueIds.length, candidatesInserted: 0 };
  }

  // Fetch full details for new videos
  let details;
  try {
    details = await getVideoDetails(newIds);
  } catch (err) {
    console.error("[breaks/discover] getVideoDetails error:", err);
    return { worldKey, queriesRun: queries, candidatesFound: uniqueIds.length, candidatesInserted: 0 };
  }

  // Filter by duration
  const durationFiltered = details.filter(
    (v) =>
      v.durationSeconds >= profile.minDuration &&
      v.durationSeconds <= profile.maxDuration
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
        title: video.title,
        description: video.description,
        creator: video.channelTitle,
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
    }
  }

  console.log(
    `[breaks/discover] ${worldKey}: ${inserted} new candidates (${filtered.length} passed filters)`
  );

  return {
    worldKey,
    queriesRun: queries,
    candidatesFound: uniqueIds.length,
    candidatesInserted: inserted,
  };
}

/**
 * Pick the world key with the oldest discovery (or no discovery).
 * Used by the cron job to rotate through worlds.
 */
export async function pickNextWorldKey(): Promise<string> {
  const supabase = createClient();
  const worldKeys = Object.keys(WORLD_SEARCH_PROFILES);

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
