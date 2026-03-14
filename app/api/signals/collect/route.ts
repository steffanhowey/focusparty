// ─── Signal Collection Orchestrator ──────────────────────────
// Cron: every 15 min. Runs due signal collectors based on their
// configured frequency. Each source runs independently — partial
// failures don't block other sources.

import { NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { startPipelineEvent } from "@/lib/pipeline/logger";
import { SIGNAL_SOURCES } from "@/lib/signals/config";
import { getLastRunTime } from "@/lib/signals/insertSignals";
import { collectRedditSignals } from "@/lib/signals/redditCollector";
import { collectHNSignals } from "@/lib/signals/hnCollector";
import { collectRSSSignals } from "@/lib/signals/rssCollector";
import { collectYouTubeVelocitySignals } from "@/lib/signals/youtubeSignalCollector";
import { collectInternalSignals } from "@/lib/signals/internalCollector";
import type { CollectionResult } from "@/lib/signals/types";

// ─── Collector Registry ─────────────────────────────────────

const COLLECTORS: Record<string, () => Promise<CollectionResult>> = {
  reddit: collectRedditSignals,
  hn: collectHNSignals,
  rss: collectRSSSignals,
  youtube_velocity: collectYouTubeVelocitySignals,
  internal: collectInternalSignals,
};

// ─── Frequency Gating ───────────────────────────────────────

/**
 * Check which sources are due for collection based on their
 * configured frequency and the last run time.
 */
async function getDueSources(
  requestedSources?: string[]
): Promise<string[]> {
  const sources = requestedSources ?? Object.keys(SIGNAL_SOURCES);
  const due: string[] = [];

  for (const source of sources) {
    const config = SIGNAL_SOURCES[source];
    if (!config || !config.enabled) continue;

    // If specific sources are requested, skip frequency check
    if (requestedSources) {
      due.push(source);
      continue;
    }

    const lastRun = await getLastRunTime(source);
    if (!lastRun) {
      // Never run before — due immediately
      due.push(source);
      continue;
    }

    const minutesSinceLastRun = (Date.now() - lastRun.getTime()) / (1000 * 60);
    if (minutesSinceLastRun >= config.frequencyMinutes) {
      due.push(source);
    }
  }

  return due;
}

// ─── Handlers ───────────────────────────────────────────────

/**
 * GET /api/signals/collect — Cron handler (every 15 min).
 * Runs all due collectors based on their frequency settings.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const isAdmin = await verifyAdminAuth(request);
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const event = await startPipelineEvent("signal_collection", "Signal Collection");
  const startTime = Date.now();

  try {
    const dueSources = await getDueSources();

    if (dueSources.length === 0) {
      await event.complete({ itemsProcessed: 0, summary: { message: "No sources due" } });
      return NextResponse.json({
        ok: true,
        message: "No sources due for collection",
        results: [],
        durationMs: Date.now() - startTime,
      });
    }

    console.log(`[signals/collect] Running collectors: ${dueSources.join(", ")}`);

    // Run all due collectors concurrently
    const settled = await Promise.allSettled(
      dueSources.map((source) => COLLECTORS[source]())
    );

    const results: CollectionResult[] = [];
    const failures: string[] = [];

    for (let i = 0; i < settled.length; i++) {
      const result = settled[i];
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        const msg = result.reason instanceof Error
          ? result.reason.message
          : String(result.reason);
        failures.push(`${dueSources[i]}: ${msg}`);
        results.push({
          source: dueSources[i],
          collected: 0,
          deduplicated: 0,
          inserted: 0,
          errors: [msg],
          durationMs: 0,
        });
      }
    }

    const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0);
    const totalCollected = results.reduce((sum, r) => sum + r.collected, 0);

    console.log(
      `[signals/collect] Done. Collected: ${totalCollected}, Inserted: ${totalInserted}, Failures: ${failures.length}`
    );

    await event.complete({
      status: failures.length > 0 ? "partial" : "completed",
      itemsProcessed: totalCollected,
      itemsSucceeded: totalInserted,
      itemsFailed: failures.length,
      summary: { sourcesRun: dueSources.length, totalCollected, totalInserted },
      errors: failures.map((f) => ({ message: f })),
    });

    return NextResponse.json({
      ok: true,
      results,
      summary: {
        sourcesRun: dueSources.length,
        totalCollected,
        totalInserted,
        failures: failures.length,
      },
      durationMs: Date.now() - startTime,
    });
  } catch (err) {
    await event.fail(err);
    console.error("[signals/collect] orchestrator error:", err);
    return NextResponse.json(
      { error: "Signal collection failed" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/signals/collect — Manual trigger.
 * Accepts optional { sources: string[] } to run specific collectors.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const isAdmin = await verifyAdminAuth(request);
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    let requestedSources: string[] | undefined;

    try {
      const body = await request.json();
      if (Array.isArray(body.sources)) {
        requestedSources = body.sources.filter(
          (s: unknown) => typeof s === "string" && COLLECTORS[s as string]
        );
      }
    } catch {
      // No body or invalid JSON — run all enabled sources
    }

    const dueSources = await getDueSources(requestedSources);

    console.log(`[signals/collect] Manual run: ${dueSources.join(", ")}`);

    const settled = await Promise.allSettled(
      dueSources.map((source) => COLLECTORS[source]())
    );

    const results: CollectionResult[] = [];
    for (let i = 0; i < settled.length; i++) {
      const result = settled[i];
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        const msg = result.reason instanceof Error
          ? result.reason.message
          : String(result.reason);
        results.push({
          source: dueSources[i],
          collected: 0,
          deduplicated: 0,
          inserted: 0,
          errors: [msg],
          durationMs: 0,
        });
      }
    }

    const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0);
    const totalCollected = results.reduce((sum, r) => sum + r.collected, 0);

    return NextResponse.json({
      ok: true,
      results,
      summary: {
        sourcesRun: dueSources.length,
        totalCollected,
        totalInserted,
      },
      durationMs: Date.now() - startTime,
    });
  } catch (err) {
    console.error("[signals/collect] manual trigger error:", err);
    return NextResponse.json(
      { error: "Signal collection failed" },
      { status: 500 }
    );
  }
}
