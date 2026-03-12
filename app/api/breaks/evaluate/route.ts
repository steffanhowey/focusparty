import { NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { evaluatePendingCandidates } from "@/lib/breaks/evaluateBatch";

/**
 * GET /api/breaks/evaluate
 * Called by Vercel Cron twice daily.
 * Evaluates up to 30 pending candidates across all worlds.
 */
export async function GET(request: Request) {
  if (!(await verifyAdminAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.BREAK_CURATOR_ENABLED === "false") {
    return NextResponse.json({ skipped: true, reason: "curator disabled" });
  }

  try {
    const result = await evaluatePendingCandidates(undefined, 30);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[breaks/evaluate] cron error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * POST /api/breaks/evaluate
 * Manual trigger. Optional body: { worldKey, limit }
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
    const { worldKey, limit } = body as {
      worldKey?: string;
      limit?: number;
    };

    const result = await evaluatePendingCandidates(worldKey, limit ?? 30);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[breaks/evaluate] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
