// ─── Hot Topics API ──────────────────────────────────────────
// GET: Hot topic clusters sorted by heat score

import { NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { getHotTopics } from "@/lib/topics/heatEngine";

/**
 * GET /api/admin/topics/hot — Get hot topic clusters.
 * Query params: threshold (default 0.2), limit (default 20)
 */
export async function GET(request: Request): Promise<NextResponse> {
  const isAdmin = await verifyAdminAuth(request);
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const threshold = parseFloat(url.searchParams.get("threshold") ?? "0.2");
  const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);

  try {
    const clusters = await getHotTopics(threshold, limit);
    return NextResponse.json({ clusters, total: clusters.length });
  } catch (err) {
    console.error("[admin/topics/hot] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch hot topics" },
      { status: 500 }
    );
  }
}
