import { NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { startPipelineEvent } from "@/lib/pipeline/logger";
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

  const event = await startPipelineEvent("evaluation", "Content Evaluation");

  try {
    const result = await evaluatePendingCandidates(undefined, 30);
    await event.complete({
      itemsProcessed: result.evaluated,
      itemsSucceeded: result.evaluated,
      summary: result,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    await event.fail(err);
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
    const { worldKey, category, limit } = body as {
      worldKey?: string;
      category?: string;
      limit?: number;
    };

    const result = await evaluatePendingCandidates(worldKey, limit ?? 30, category);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[breaks/evaluate] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
