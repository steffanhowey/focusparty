// ─── Analytics Backfill API ──────────────────────────────────

import { requireAdmin, isAdminError } from "@/lib/admin/requireAdmin";
import { aggregateContentPerformance } from "@/lib/analytics/contentPerformance";
import { aggregateRoomPerformance } from "@/lib/analytics/roomPerformance";

/**
 * POST /api/admin/analytics/backfill
 * Admin-triggered backfill of performance tables for past N days.
 * Body: { days?: number } (default 30, max 90)
 */
export async function POST(request: Request): Promise<Response> {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth;

  let body: { days?: number };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const days = Math.min(90, Math.max(1, body.days ?? 30));
  let contentInserted = 0;
  let roomInserted = 0;

  for (let i = 1; i <= days; i++) {
    const date = new Date(Date.now() - i * 86400000);

    const [contentResult, roomResult] = await Promise.all([
      aggregateContentPerformance(date),
      aggregateRoomPerformance(date),
    ]);

    contentInserted += contentResult.inserted;
    roomInserted += roomResult.inserted;
  }

  return Response.json({
    ok: true,
    daysProcessed: days,
    contentRows: contentInserted,
    roomRows: roomInserted,
  });
}
