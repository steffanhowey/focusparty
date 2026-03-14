// ─── YouTube Velocity Signal Collector ───────────────────────
// Detects recently-published videos from tracked channels that
// are gaining views unusually fast. This is a velocity signal,
// not a content evaluation — it feeds the heat scoring engine.

import { searchVideos, getVideoDetails } from "@/lib/breaks/youtubeClient";
import { SIGNAL_SOURCES } from "@/lib/signals/config";
import type { RawSignal, CollectionResult } from "@/lib/signals/types";
import {
  insertSignals,
  startCollectionRun,
  completeCollectionRun,
} from "@/lib/signals/insertSignals";
import { ensureCreator } from "@/lib/creators/catalog";

const SOURCE = "youtube_velocity";

/** Minimum views per hour to consider a video as having velocity. */
const MIN_VELOCITY = 50;

/** Max channels to check per run (to manage API quota). */
const MAX_CHANNELS_PER_RUN = 20;

// ─── Helpers ────────────────────────────────────────────────

function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/**
 * Get all unique channel IDs from worldBreakProfiles.
 * Uses dynamic import to avoid circular dependencies.
 */
async function getAllChannelIds(): Promise<{ channelId: string; label: string }[]> {
  const { WORLD_BREAK_PROFILES } = await import("@/lib/breaks/worldBreakProfiles");
  const seen = new Set<string>();
  const channels: { channelId: string; label: string }[] = [];

  for (const profile of Object.values(WORLD_BREAK_PROFILES)) {
    for (const ch of profile.channels) {
      if (!seen.has(ch.channelId)) {
        seen.add(ch.channelId);
        channels.push({ channelId: ch.channelId, label: ch.label });
      }
    }
  }

  return channels;
}

// ─── Module State ───────────────────────────────────────────
// Track which channels were checked last to rotate through them.

let lastCheckedIndex = 0;

// ─── Collector ──────────────────────────────────────────────

/**
 * Detect high-velocity recent videos from tracked YouTube channels.
 * Costs ~100 quota units per channel search + 1 unit per video detail.
 * Capped at 20 channels per run, rotating through the full list.
 */
export async function collectYouTubeVelocitySignals(): Promise<CollectionResult> {
  const start = Date.now();
  const config = SIGNAL_SOURCES[SOURCE];
  const errors: string[] = [];
  const allSignals: RawSignal[] = [];

  const runId = await startCollectionRun(SOURCE);

  try {
    const allChannels = await getAllChannelIds();

    // Rotate through channels across runs
    const startIdx = lastCheckedIndex % allChannels.length;
    const channelsToCheck: typeof allChannels = [];
    for (let i = 0; i < Math.min(MAX_CHANNELS_PER_RUN, allChannels.length); i++) {
      channelsToCheck.push(allChannels[(startIdx + i) % allChannels.length]);
    }
    lastCheckedIndex = (startIdx + channelsToCheck.length) % allChannels.length;

    const publishedAfter = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    for (const channel of channelsToCheck) {
      try {
        // Search for recent videos from this channel
        const results = await searchVideos("", {
          channelId: channel.channelId,
          publishedAfter,
          order: "date",
          maxResults: 5,
        });

        if (results.length === 0) continue;

        // Get view counts for found videos
        const videoIds = results.map((r) => r.videoId);
        const details = await getVideoDetails(videoIds);

        const now = Date.now();

        for (const video of details) {
          const publishedMs = new Date(video.publishedAt).getTime();
          const hoursOld = Math.max(1, (now - publishedMs) / (1000 * 60 * 60));
          const velocity = video.viewCount / hoursOld;

          if (velocity < MIN_VELOCITY) continue;

          const engagement = normalize(velocity, 0, 1000);
          if (engagement < config.relevanceThreshold) continue;

          allSignals.push({
            source: SOURCE,
            source_id: `yt_velocity:${video.videoId}`,
            source_url: `https://www.youtube.com/watch?v=${video.videoId}`,
            title: video.title,
            summary: (video.description ?? "").slice(0, 300) || null,
            engagement_score: Math.round(engagement * 1000) / 1000,
            raw_data: {
              channel_id: channel.channelId,
              channel_label: channel.label,
              view_count: video.viewCount,
              like_count: video.likeCount,
              comment_count: video.commentCount,
              published_at: video.publishedAt,
              velocity: Math.round(velocity),
              hours_old: Math.round(hoursOld * 10) / 10,
            },
          });

          // Auto-catalog creator (fire-and-forget)
          ensureCreator(channel.channelId, {
            channelName: channel.label,
            discoverySource: "signal",
          }).catch(() => {});
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${channel.label}: ${msg}`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(msg);
  }

  // Cap and sort by engagement
  allSignals.sort((a, b) => b.engagement_score - a.engagement_score);
  const capped = allSignals.slice(0, config.maxSignalsPerRun);

  const { inserted, deduplicated } = await insertSignals(capped);

  await completeCollectionRun(runId, {
    status: errors.length === 0 ? "completed" : "failed",
    signalsCollected: capped.length,
    signalsDeduplicated: deduplicated,
    errors,
  });

  return {
    source: SOURCE,
    collected: capped.length,
    deduplicated,
    inserted,
    errors,
    durationMs: Date.now() - start,
  };
}
