import { NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { discoverCandidates } from "@/lib/breaks/discovery";
import { evaluatePendingCandidates } from "@/lib/breaks/evaluateBatch";
import { refreshShelf } from "@/lib/breaks/shelf";
import { WORLD_BREAK_PROFILES } from "@/lib/breaks/worldBreakProfiles";

async function bootstrapWorld(worldKey: string, discoveryRounds: number) {
  console.log(
    `[breaks/bootstrap] Starting "${worldKey}" (${discoveryRounds} rounds)`,
  );

  // Phase 1: Discovery
  const discoveryResults = [];
  for (let i = 0; i < discoveryRounds; i++) {
    const result = await discoverCandidates(worldKey);
    discoveryResults.push(result);
    console.log(
      `[breaks/bootstrap] ${worldKey} discovery ${i + 1}/${discoveryRounds}: ${result.candidatesInserted} new`,
    );
  }
  const totalDiscovered = discoveryResults.reduce(
    (sum, r) => sum + r.candidatesInserted,
    0,
  );

  // Phase 2: Evaluation — loop until no pending remain
  let totalEvaluated = 0;
  let totalRejected = 0;
  let evalPass = 0;
  while (true) {
    evalPass++;
    const result = await evaluatePendingCandidates(worldKey, 20);
    totalEvaluated += result.evaluated;
    totalRejected += result.rejected;
    console.log(
      `[breaks/bootstrap] ${worldKey} eval pass ${evalPass}: ${result.evaluated} eval, ${result.rejected} reject`,
    );
    if (result.evaluated + result.rejected === 0) break;
    if (evalPass >= 10) break;
  }

  // Phase 3: Shelf refresh
  const shelfResult = await refreshShelf(worldKey);
  console.log(
    `[breaks/bootstrap] ${worldKey} complete: ${totalDiscovered} discovered, ${totalEvaluated} evaluated, shelf=${shelfResult.shelfSize}`,
  );

  return {
    worldKey,
    discovery: { rounds: discoveryRounds, totalCandidates: totalDiscovered },
    evaluation: { passes: evalPass, evaluated: totalEvaluated, rejected: totalRejected },
    shelf: shelfResult,
  };
}

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

    // ─── Bootstrap "all" worlds ──────────────────────────
    if (worldKey === "all") {
      console.log(
        `[breaks/bootstrap] Starting bootstrap for ALL worlds (${discoveryRounds} rounds each)`,
      );
      const allResults = [];
      for (const wk of Object.keys(WORLD_BREAK_PROFILES)) {
        try {
          const result = await bootstrapWorld(wk, discoveryRounds);
          allResults.push(result);
        } catch (err) {
          console.error(`[breaks/bootstrap] error for ${wk}:`, err);
          allResults.push({ worldKey: wk, error: true });
        }
      }
      return NextResponse.json({ ok: true, results: allResults });
    }

    // ─── Bootstrap single world ────────────────────────
    if (!worldKey || !(worldKey in WORLD_BREAK_PROFILES)) {
      const validKeys = Object.keys(WORLD_BREAK_PROFILES);
      return NextResponse.json(
        {
          error: `Invalid worldKey. Valid keys: ${validKeys.join(", ")}, or "all"`,
        },
        { status: 400 },
      );
    }

    const result = await bootstrapWorld(worldKey, discoveryRounds);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[breaks/bootstrap] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
