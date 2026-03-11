import { NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { discoverCandidates, pickNextWorldKey } from "@/lib/breaks/discovery";

/**
 * GET /api/breaks/discover
 * Called by Vercel Cron every 6 hours.
 * Discovers content for the world key least recently searched.
 */
export async function GET(request: Request) {
  if (!(await verifyAdminAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.BREAK_CURATOR_ENABLED === "false") {
    return NextResponse.json({ skipped: true, reason: "curator disabled" });
  }

  try {
    const worldKey = await pickNextWorldKey();
    const result = await discoverCandidates(worldKey);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[breaks/discover] cron error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * POST /api/breaks/discover
 * Manual trigger. Optional body: { worldKey: string }
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
    const targetWorld = worldKey || (await pickNextWorldKey());

    const result = await discoverCandidates(targetWorld);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[breaks/discover] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
