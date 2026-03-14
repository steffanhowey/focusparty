// ─── Pipeline Status Endpoint ────────────────────────────────
// Single endpoint to check full pipeline health and content counts.
// GET /api/pipeline/status (protected by ADMIN_SECRET)

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/admin";
import { getPipelineHealthSummary, getPipelineAlerts } from "@/lib/pipeline/logger";

/**
 * GET /api/pipeline/status
 * Returns pipeline health, content pipeline counts, and shelf health.
 */
export async function GET(request: Request): Promise<Response> {
  // Auth
  const adminSecret = process.env.ADMIN_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient();

  // Run all queries in parallel
  const [
    health,
    alerts,
    pendingCandidates,
    evaluatedUnscaffolded,
    scaffoldedNotOnShelf,
    shelfHealth,
  ] = await Promise.all([
    getPipelineHealthSummary(),
    getPipelineAlerts(),
    // Pending candidates (not yet evaluated)
    supabase
      .from("fp_break_content_candidates")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    // Evaluated but unscaffolded
    supabase
      .from("fp_break_content_scores")
      .select("*", { count: "exact", head: true })
      .gte("taste_score", 55)
      .or("scaffolding.is.null,scaffolding_status.neq.complete"),
    // Scaffolded candidates not yet on shelf (scored + scaffolded but not promoted)
    supabase
      .from("fp_break_content_scores")
      .select("*, candidate:fp_break_content_candidates!inner(status)", { count: "exact", head: true })
      .not("scaffolding", "is", null)
      .eq("candidate.status", "scored"),
    // Shelf items per world key
    supabase
      .from("fp_break_content_items")
      .select("room_world_key, scaffolding, created_at")
      .eq("status", "active"),
  ]);

  // Compute shelf health per world key
  const shelfByWorld: Record<string, {
    totalItems: number;
    scaffoldedItems: number;
    oldestItemAge: string | null;
  }> = {};

  if (shelfHealth.data) {
    for (const item of shelfHealth.data) {
      const wk = item.room_world_key as string;
      if (!shelfByWorld[wk]) {
        shelfByWorld[wk] = { totalItems: 0, scaffoldedItems: 0, oldestItemAge: null };
      }
      shelfByWorld[wk].totalItems++;
      if (item.scaffolding) {
        shelfByWorld[wk].scaffoldedItems++;
      }
      const created = item.created_at as string;
      if (!shelfByWorld[wk].oldestItemAge || created < shelfByWorld[wk].oldestItemAge!) {
        shelfByWorld[wk].oldestItemAge = created;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    pipeline: health,
    alerts,
    contentCounts: {
      pendingCandidates: pendingCandidates.count ?? 0,
      evaluatedUnscaffolded: evaluatedUnscaffolded.count ?? 0,
      scaffoldedNotOnShelf: scaffoldedNotOnShelf.count ?? 0,
    },
    shelfHealth: shelfByWorld,
  });
}
