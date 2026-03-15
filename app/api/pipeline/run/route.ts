// ─── Unified Content Pipeline Cron ──────────────────────────
// Single cron endpoint that runs the full pipeline (discover →
// evaluate → shelf refresh) for one world per invocation,
// rotating through worlds by least-recently-discovered.
//
// Replaces the 3 separate crons (discover, evaluate, refresh-shelf)
// to eliminate the 10-22 hour latency between discovery and shelf.

import { NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { startPipelineEvent } from "@/lib/pipeline/logger";
import {
  discoverAndPromote,
  discoverAndPromoteAll,
  pickNextWorldKey,
} from "@/lib/breaks/discovery";

/**
 * GET /api/pipeline/run
 * Called by Vercel Cron every 3 hours (8 runs/day).
 * Picks the least-recently-discovered world and runs the full
 * pipeline for ALL 4 categories in that world.
 */
export async function GET(request: Request) {
  if (!(await verifyAdminAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.BREAK_CURATOR_ENABLED === "false") {
    return NextResponse.json({ skipped: true, reason: "curator disabled" });
  }

  const event = await startPipelineEvent("pipeline_unified", "Unified Pipeline Run");

  try {
    const worldKey = await pickNextWorldKey();
    console.log(`[pipeline/run] Starting unified pipeline for world: ${worldKey}`);

    const result = await discoverAndPromote(worldKey);

    await event.complete({
      status: result.errors.length > 0 ? "partial" : "completed",
      itemsProcessed: result.discovered + result.evaluated,
      itemsSucceeded: result.discovered + result.evaluated,
      itemsFailed: result.errors.length,
      summary: result,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    await event.fail(err);
    console.error("[pipeline/run] cron error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * POST /api/pipeline/run
 * Manual trigger with optional parameters.
 * Body: { worldKey?: string | "all", category?: string }
 */
export async function POST(request: Request) {
  if (!(await verifyAdminAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.BREAK_CURATOR_ENABLED === "false") {
    return NextResponse.json({ skipped: true, reason: "curator disabled" });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { worldKey, category } = body as { worldKey?: string; category?: string };

    if (worldKey === "all") {
      const results = await discoverAndPromoteAll();
      return NextResponse.json({ ok: true, results });
    }

    const targetWorld = worldKey || (await pickNextWorldKey());
    const result = await discoverAndPromote(targetWorld, category);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[pipeline/run] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
