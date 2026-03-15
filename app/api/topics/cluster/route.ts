// ─── Topic Clustering Cron ───────────────────────────────────
// Hourly job: processes unprocessed signals, recalculates heat
// scores, and updates cluster statuses.

import { NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { startPipelineEvent } from "@/lib/pipeline/logger";
import { processSignalBatch } from "@/lib/topics/clusterService";
import {
  recalculateAllHeatScores,
  updateClusterStatuses,
} from "@/lib/topics/heatEngine";
import { discoverAndIndexForHotTopics } from "@/lib/learn/heatDrivenDiscovery";
import type { HeatDrivenResult } from "@/lib/learn/heatDrivenDiscovery";

/**
 * GET — Vercel Cron handler (hourly).
 * Processes signals, recalculates heat, updates statuses.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const isAdmin = await verifyAdminAuth(request);
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const event = await startPipelineEvent("topic_clustering", "Topic Clustering");

  try {
    console.log("[topics/cluster] Starting hourly clustering run");

    // 1. Process unprocessed signals
    const clusterResult = await processSignalBatch(50);

    // 2. Recalculate heat scores for all active clusters
    const heatResult = await recalculateAllHeatScores();

    // 3. Update cluster statuses based on heat thresholds
    const statusResult = await updateClusterStatuses();

    // 4. Index content lake for hot topics with thin coverage
    let discoveryResult: HeatDrivenResult | null = null;
    try {
      discoveryResult = await discoverAndIndexForHotTopics();
      if (discoveryResult.videosIndexed > 0) {
        console.log(
          `[topics/cluster] Heat-driven discovery: ${discoveryResult.videosIndexed} videos indexed for ${discoveryResult.topicsWithThinContent} thin topics`
        );
      }
    } catch (err) {
      console.error("[topics/cluster] heat-driven discovery error:", err);
    }

    console.log(
      `[topics/cluster] Done: ${clusterResult.processed} signals processed, ${heatResult.updated} heat scores updated, ${statusResult.updated} statuses changed`
    );

    await event.complete({
      itemsProcessed: clusterResult.processed,
      itemsSucceeded: clusterResult.processed,
      summary: {
        heatUpdates: heatResult.updated,
        statusUpdates: statusResult.updated,
        discovery: discoveryResult,
      },
    });

    return NextResponse.json({
      ok: true,
      signals: clusterResult,
      heatUpdates: heatResult.updated,
      statusUpdates: statusResult.updated,
      discovery: discoveryResult,
    });
  } catch (err) {
    await event.fail(err);
    console.error("[topics/cluster] Cron error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST — Manual trigger with optional parameters.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const isAdmin = await verifyAdminAuth(request);
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const limit = (body as { limit?: number }).limit ?? 50;

    console.log(`[topics/cluster] Manual trigger (limit=${limit})`);

    const clusterResult = await processSignalBatch(limit);
    const heatResult = await recalculateAllHeatScores();
    const statusResult = await updateClusterStatuses();

    let discoveryResult: HeatDrivenResult | null = null;
    try {
      discoveryResult = await discoverAndIndexForHotTopics();
    } catch (err) {
      console.error("[topics/cluster] heat-driven discovery error:", err);
    }

    return NextResponse.json({
      ok: true,
      signals: clusterResult,
      heatUpdates: heatResult.updated,
      statusUpdates: statusResult.updated,
      discovery: discoveryResult,
    });
  } catch (err) {
    console.error("[topics/cluster] Manual trigger error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
