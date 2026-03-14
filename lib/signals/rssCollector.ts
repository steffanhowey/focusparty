// ─── RSS Signal Collector ────────────────────────────────────
// Parses RSS/Atom feeds from AI research blogs and industry
// leaders. Uses rss-parser for feed parsing.

import Parser from "rss-parser";
import { createHash } from "crypto";
import { RSS_FEEDS, SIGNAL_SOURCES } from "@/lib/signals/config";
import type { RawSignal, CollectionResult } from "@/lib/signals/types";
import {
  insertSignals,
  startCollectionRun,
  completeCollectionRun,
} from "@/lib/signals/insertSignals";

const SOURCE = "rss";

const parser = new Parser({
  timeout: 10000,
  headers: {
    "User-Agent": "SkillGapAI/1.0 (signal-collector)",
  },
});

// ─── Helpers ────────────────────────────────────────────────

/** Generate a stable ID from a URL using md5. */
function hashUrl(url: string): string {
  return createHash("md5").update(url).digest("hex").slice(0, 16);
}

// ─── Collector ──────────────────────────────────────────────

/**
 * Collect recent articles from AI-focused RSS/Atom feeds.
 * RSS items don't have engagement metrics, so they get a neutral score (0.5).
 */
export async function collectRSSSignals(): Promise<CollectionResult> {
  const start = Date.now();
  const config = SIGNAL_SOURCES[SOURCE];
  const errors: string[] = [];
  const allSignals: RawSignal[] = [];

  const runId = await startCollectionRun(SOURCE);

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48h ago

  for (const feed of RSS_FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);

      for (const item of parsed.items ?? []) {
        // Skip items without a link (can't generate stable ID)
        if (!item.link) continue;

        // Skip items older than 48h
        const pubDate = item.pubDate ? new Date(item.pubDate) : null;
        if (pubDate && pubDate < cutoff) continue;

        // Extract content snippet
        const content = item.contentSnippet ?? item.content ?? "";
        const summary = content
          .replace(/<[^>]*>/g, "") // strip HTML
          .slice(0, 500) || null;

        allSignals.push({
          source: SOURCE,
          source_id: `rss:${hashUrl(item.link)}`,
          source_url: item.link,
          title: item.title ?? "Untitled",
          summary,
          engagement_score: 0.5, // neutral — RSS has no engagement metrics
          raw_data: {
            feed_label: feed.label,
            feed_url: feed.url,
            pub_date: item.pubDate ?? null,
            author: item.creator ?? item.author ?? null,
            categories: item.categories ?? [],
          },
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${feed.label}: ${msg}`);
    }
  }

  // Cap at maxSignalsPerRun (most recent first by position in feed)
  const capped = allSignals.slice(0, config.maxSignalsPerRun);

  const { inserted, deduplicated } = await insertSignals(capped);

  await completeCollectionRun(runId, {
    status: errors.length < RSS_FEEDS.length ? "completed" : "failed",
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
