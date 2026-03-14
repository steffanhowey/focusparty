// ─── Reddit Signal Collector ────────────────────────────────
// Fetches hot posts from AI-related subreddits via Reddit's
// public JSON API (no auth required).

import { REDDIT_SUBREDDITS, SIGNAL_SOURCES } from "@/lib/signals/config";
import type { RawSignal, CollectionResult } from "@/lib/signals/types";
import {
  insertSignals,
  startCollectionRun,
  completeCollectionRun,
} from "@/lib/signals/insertSignals";

const SOURCE = "reddit";

// ─── Helpers ────────────────────────────────────────────────

/** Normalize a value into 0–1 range. */
function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/** Sleep for ms. Used between subreddit fetches to respect rate limits. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Reddit Types ───────────────────────────────────────────

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  score: number;
  num_comments: number;
  url: string;
  permalink: string;
  created_utc: number;
  subreddit: string;
}

// ─── Collector ──────────────────────────────────────────────

/**
 * Collect hot posts from AI-related subreddits.
 * Uses Reddit's public JSON endpoint (no OAuth needed).
 */
export async function collectRedditSignals(): Promise<CollectionResult> {
  const start = Date.now();
  const config = SIGNAL_SOURCES[SOURCE];
  const errors: string[] = [];
  const allSignals: RawSignal[] = [];

  const runId = await startCollectionRun(SOURCE);

  for (const subreddit of REDDIT_SUBREDDITS) {
    try {
      const res = await fetch(
        `https://www.reddit.com/r/${subreddit}/hot.json?limit=25`,
        {
          headers: {
            // Reddit requires a descriptive user-agent for API access
            "User-Agent": "SkillGapAI/1.0 (signal-collector)",
          },
        }
      );

      if (!res.ok) {
        errors.push(`r/${subreddit}: HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      const posts: RedditPost[] = (data?.data?.children ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((child: any) => child.data as RedditPost);

      const now = Date.now() / 1000;
      const maxAgeSeconds = 48 * 60 * 60; // 48 hours

      for (const post of posts) {
        // Skip old posts
        if (now - post.created_utc > maxAgeSeconds) continue;
        // Skip low-engagement posts
        if (post.score < 10) continue;

        const engagement =
          normalize(post.score, 0, 1000) * 0.6 +
          normalize(post.num_comments, 0, 200) * 0.4;

        if (engagement < config.relevanceThreshold) continue;

        allSignals.push({
          source: SOURCE,
          source_id: `reddit:${post.id}`,
          source_url: `https://www.reddit.com${post.permalink}`,
          title: post.title,
          summary: (post.selftext ?? "").slice(0, 500) || null,
          engagement_score: Math.round(engagement * 1000) / 1000,
          raw_data: {
            subreddit: post.subreddit,
            score: post.score,
            num_comments: post.num_comments,
            created_utc: post.created_utc,
            url: post.url,
          },
        });
      }

      // Rate limit: 1 req/sec between subreddits
      await sleep(1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`r/${subreddit}: ${msg}`);
    }
  }

  // Cap at maxSignalsPerRun, take highest engagement first
  allSignals.sort((a, b) => b.engagement_score - a.engagement_score);
  const capped = allSignals.slice(0, config.maxSignalsPerRun);

  const { inserted, deduplicated } = await insertSignals(capped);

  await completeCollectionRun(runId, {
    status: errors.length < REDDIT_SUBREDDITS.length ? "completed" : "failed",
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
