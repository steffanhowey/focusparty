// ─── Hacker News Signal Collector ────────────────────────────
// Fetches top stories from HN's Firebase API and filters for
// AI-relevant content using keyword matching.

import { AI_KEYWORDS, SIGNAL_SOURCES } from "@/lib/signals/config";
import type { RawSignal, CollectionResult } from "@/lib/signals/types";
import {
  insertSignals,
  startCollectionRun,
  completeCollectionRun,
} from "@/lib/signals/insertSignals";

const SOURCE = "hn";
const HN_API = "https://hacker-news.firebaseio.com/v0";

// ─── Helpers ────────────────────────────────────────────────

function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/** Check if a title matches any AI keyword (case-insensitive). */
function isAIRelevant(title: string): boolean {
  const lower = title.toLowerCase();
  return AI_KEYWORDS.some((kw) => lower.includes(kw));
}

// ─── HN Types ───────────────────────────────────────────────

interface HNStory {
  id: number;
  title: string;
  url?: string;
  score: number;
  descendants: number; // comment count
  time: number; // unix timestamp
  by: string;
  type: string;
}

// ─── Collector ──────────────────────────────────────────────

/**
 * Collect AI-relevant top stories from Hacker News.
 * Uses the official Firebase API (no auth, no rate limits).
 */
export async function collectHNSignals(): Promise<CollectionResult> {
  const start = Date.now();
  const config = SIGNAL_SOURCES[SOURCE];
  const errors: string[] = [];
  const allSignals: RawSignal[] = [];

  const runId = await startCollectionRun(SOURCE);

  try {
    // Fetch top 50 story IDs
    const idsRes = await fetch(`${HN_API}/topstories.json`);
    if (!idsRes.ok) {
      throw new Error(`Failed to fetch top stories: HTTP ${idsRes.status}`);
    }
    const allIds: number[] = await idsRes.json();
    const storyIds = allIds.slice(0, 50);

    // Fetch stories in chunks of 5 (polite concurrency)
    const stories: HNStory[] = [];
    for (let i = 0; i < storyIds.length; i += 5) {
      const chunk = storyIds.slice(i, i + 5);
      const results = await Promise.allSettled(
        chunk.map(async (id) => {
          const res = await fetch(`${HN_API}/item/${id}.json`);
          if (!res.ok) return null;
          return (await res.json()) as HNStory;
        })
      );
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          stories.push(r.value);
        }
      }
    }

    const now = Date.now() / 1000;
    const maxAgeSeconds = 24 * 60 * 60; // 24 hours

    for (const story of stories) {
      // Skip non-story items
      if (story.type !== "story") continue;
      // Skip old stories
      if (now - story.time > maxAgeSeconds) continue;
      // Skip low-engagement
      if (story.score < 20) continue;
      // Must be AI-relevant
      if (!isAIRelevant(story.title)) continue;

      const engagement =
        normalize(story.score, 0, 500) * 0.5 +
        normalize(story.descendants ?? 0, 0, 200) * 0.5;

      if (engagement < config.relevanceThreshold) continue;

      allSignals.push({
        source: SOURCE,
        source_id: `hn:${story.id}`,
        source_url: story.url ?? `https://news.ycombinator.com/item?id=${story.id}`,
        title: story.title,
        summary: null, // HN stories don't have summaries
        engagement_score: Math.round(engagement * 1000) / 1000,
        raw_data: {
          hn_id: story.id,
          score: story.score,
          comments: story.descendants ?? 0,
          by: story.by,
          time: story.time,
          url: story.url ?? null,
        },
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(msg);
  }

  // Cap and sort
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
