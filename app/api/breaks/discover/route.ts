import { NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { startPipelineEvent } from "@/lib/pipeline/logger";
import {
  discoverCandidates,
  discoverAndPromote,
  discoverAndPromoteAll,
  pickNextWorldKey,
} from "@/lib/breaks/discovery";
import { WORLD_BREAK_PROFILES, ALL_CATEGORIES } from "@/lib/breaks/worldBreakProfiles";

/**
 * GET /api/breaks/discover
 * Called by Vercel Cron every 6 hours.
 * Discovers content for ALL worlds × ALL categories.
 * At 5 worlds × 4 categories × 3 searches = 60 YouTube API calls per run,
 * well under the 10,000/day quota.
 */
export async function GET(request: Request) {
  if (!(await verifyAdminAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.BREAK_CURATOR_ENABLED === "false") {
    return NextResponse.json({ skipped: true, reason: "curator disabled" });
  }

  const event = await startPipelineEvent("discovery_scheduled", "Scheduled Discovery");

  try {
    const worldKeys = Object.keys(WORLD_BREAK_PROFILES);
    const results = [];
    let errorCount = 0;
    for (const worldKey of worldKeys) {
      for (const category of ALL_CATEGORIES) {
        try {
          const result = await discoverCandidates(worldKey, category);
          results.push(result);
        } catch (err) {
          errorCount++;
          console.error(`[breaks/discover] cron error for ${worldKey}/${category}:`, err);
          results.push({ worldKey, category, error: true });
        }
      }
    }

    await event.complete({
      status: errorCount > 0 ? "partial" : "completed",
      itemsProcessed: results.length,
      itemsSucceeded: results.length - errorCount,
      itemsFailed: errorCount,
      summary: { worldsProcessed: worldKeys.length },
    });

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    await event.fail(err);
    console.error("[breaks/discover] cron error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * POST /api/breaks/discover
 * Manual trigger with full pipeline: discover → evaluate → promote.
 * Body: { worldKey?: string, category?: string }
 *   - If worldKey is "all": runs full pipeline for ALL worlds × ALL categories
 *   - If worldKey provided: runs for that world (all categories, or specific if category given)
 *   - If omitted: picks the least-recently-discovered world
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
    const targetCategory = category ?? "learning";
    const result = await discoverAndPromote(targetWorld, targetCategory);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[breaks/discover] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
