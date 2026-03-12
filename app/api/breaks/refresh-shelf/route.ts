import { NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { refreshShelf, refreshAllShelves } from "@/lib/breaks/shelf";
import { evaluatePendingCandidates } from "@/lib/breaks/evaluateBatch";

/**
 * GET /api/breaks/refresh-shelf
 * Called by Vercel Cron daily (4 AM UTC).
 * Evaluates any pending stragglers, then refreshes all world shelves.
 */
export async function GET(request: Request) {
  if (!(await verifyAdminAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.BREAK_CURATOR_ENABLED === "false") {
    return NextResponse.json({ skipped: true, reason: "curator disabled" });
  }

  try {
    // Catch any unevaluated candidates before promoting
    const evalResult = await evaluatePendingCandidates(undefined, 30);
    const results = await refreshAllShelves();
    return NextResponse.json({ ok: true, evalResult, results });
  } catch (err) {
    console.error("[breaks/refresh-shelf] cron error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * POST /api/breaks/refresh-shelf
 * Manual trigger. Optional body: { worldKey }
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

    if (worldKey) {
      const result = await refreshShelf(worldKey, category ?? "learning");
      return NextResponse.json({ ok: true, result });
    }

    const results = await refreshAllShelves();
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error("[breaks/refresh-shelf] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
