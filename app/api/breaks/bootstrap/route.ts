import { NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { discoverCandidates } from "@/lib/breaks/discovery";
import { evaluatePendingCandidates } from "@/lib/breaks/evaluateBatch";
import { refreshShelf } from "@/lib/breaks/shelf";
import { WORLD_SEARCH_PROFILES } from "@/lib/breaks/searchProfiles";

/**
 * POST /api/breaks/bootstrap
 *
 * Fully stocks a world's break shelf in a single call:
 *   1. Discovery (N rounds) → accumulate YouTube candidates
 *   2. Evaluation (loop until no pending remain) → AI score all candidates
 *   3. Shelf refresh → promote into all 3 duration buckets
 *
 * Body: { worldKey: string, discoveryRounds?: number }
 *
 * Typical usage for a new world:
 *   curl -X POST /api/breaks/bootstrap \
 *     -H "Authorization: Bearer ..." \
 *     -d '{"worldKey":"vibe-coding","discoveryRounds":3}'
 */
export async function POST(request: Request) {
  if (!(await verifyAdminAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const worldKey = body.worldKey as string | undefined;
    const discoveryRounds = Math.min(
      (body.discoveryRounds as number) || 3,
      10,
    );

    if (!worldKey || !WORLD_SEARCH_PROFILES[worldKey]) {
      const validKeys = Object.keys(WORLD_SEARCH_PROFILES);
      return NextResponse.json(
        {
          error: `Invalid worldKey. Valid keys: ${validKeys.join(", ")}`,
        },
        { status: 400 },
      );
    }

    console.log(
      `[breaks/bootstrap] Starting bootstrap for "${worldKey}" (${discoveryRounds} discovery rounds)`,
    );

    // ─── Phase 1: Discovery ─────────────────────────────
    const discoveryResults = [];
    for (let i = 0; i < discoveryRounds; i++) {
      const result = await discoverCandidates(worldKey);
      discoveryResults.push(result);
      console.log(
        `[breaks/bootstrap] Discovery round ${i + 1}/${discoveryRounds}: ${result.candidatesInserted} new candidates`,
      );
    }

    const totalDiscovered = discoveryResults.reduce(
      (sum, r) => sum + r.candidatesInserted,
      0,
    );

    // ─── Phase 2: Evaluation ────────────────────────────
    // Loop until all pending candidates are evaluated
    let totalEvaluated = 0;
    let totalRejected = 0;
    let evalPass = 0;

    while (true) {
      evalPass++;
      const result = await evaluatePendingCandidates(worldKey, 20);
      totalEvaluated += result.evaluated;
      totalRejected += result.rejected;

      console.log(
        `[breaks/bootstrap] Eval pass ${evalPass}: ${result.evaluated} evaluated, ${result.rejected} rejected`,
      );

      // Stop when no more pending candidates
      if (result.evaluated + result.rejected === 0) break;
      // Safety: cap at 10 passes to prevent runaway loops
      if (evalPass >= 10) break;
    }

    // ─── Phase 3: Shelf Refresh ─────────────────────────
    const shelfResult = await refreshShelf(worldKey);

    console.log(
      `[breaks/bootstrap] Complete: ${totalDiscovered} discovered, ${totalEvaluated} evaluated, ${totalRejected} rejected, shelf=${shelfResult.shelfSize} items`,
    );

    return NextResponse.json({
      ok: true,
      worldKey,
      discovery: {
        rounds: discoveryRounds,
        totalCandidates: totalDiscovered,
      },
      evaluation: {
        passes: evalPass,
        evaluated: totalEvaluated,
        rejected: totalRejected,
      },
      shelf: shelfResult,
    });
  } catch (err) {
    console.error("[breaks/bootstrap] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
