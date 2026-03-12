import { NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import {
  discoverCandidates,
  discoverAndPromote,
  discoverAndPromoteAll,
  pickNextWorldKey,
} from "@/lib/breaks/discovery";
import { WORLD_BREAK_PROFILES } from "@/lib/breaks/worldBreakProfiles";

/**
 * GET /api/breaks/discover
 * Called by Vercel Cron every 6 hours.
 * Discovers content for ALL worlds (lightweight — discovery only, no eval).
 */
export async function GET(request: Request) {
  if (!(await verifyAdminAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.BREAK_CURATOR_ENABLED === "false") {
    return NextResponse.json({ skipped: true, reason: "curator disabled" });
  }

  try {
    // Discover for ALL worlds instead of just one.
    // At 5 worlds × 3 searches/world = 15 YouTube API calls per run,
    // well under the 10,000/day quota.
    const worldKeys = Object.keys(WORLD_BREAK_PROFILES);
    const results = [];
    for (const worldKey of worldKeys) {
      try {
        const result = await discoverCandidates(worldKey);
        results.push(result);
      } catch (err) {
        console.error(`[breaks/discover] cron error for ${worldKey}:`, err);
        results.push({ worldKey, error: true });
      }
    }
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error("[breaks/discover] cron error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * POST /api/breaks/discover
 * Manual trigger with full pipeline: discover → evaluate → promote.
 * Body: { worldKey?: string }
 *   - If worldKey provided: runs full pipeline for that world
 *   - If worldKey is "all": runs full pipeline for ALL worlds
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
    const worldKey =
      (body as Record<string, unknown>).worldKey as string | undefined;

    if (worldKey === "all") {
      const results = await discoverAndPromoteAll();
      return NextResponse.json({ ok: true, results });
    }

    const targetWorld = worldKey || (await pickNextWorldKey());
    const result = await discoverAndPromote(targetWorld);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[breaks/discover] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
