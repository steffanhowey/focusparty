import { NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { refreshShelf, refreshAllShelves } from "@/lib/breaks/shelf";

/**
 * GET /api/breaks/refresh-shelf
 * Called by Vercel Cron weekly (Monday 4 AM UTC).
 * Refreshes all world shelves.
 */
export async function GET(request: Request) {
  if (!(await verifyAdminAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.BREAK_CURATOR_ENABLED === "false") {
    return NextResponse.json({ skipped: true, reason: "curator disabled" });
  }

  try {
    const results = await refreshAllShelves();
    return NextResponse.json({ ok: true, results });
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
    const worldKey = (body as Record<string, unknown>).worldKey as
      | string
      | undefined;

    if (worldKey) {
      const result = await refreshShelf(worldKey);
      return NextResponse.json({ ok: true, result });
    }

    const results = await refreshAllShelves();
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error("[breaks/refresh-shelf] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
