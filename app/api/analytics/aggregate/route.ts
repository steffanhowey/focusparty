// ─── Analytics Aggregation Cron ──────────────────────────────
// Daily 2am UTC: rolls up engagement and session data into
// performance tables for analytics and calibration.

import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { startPipelineEvent } from "@/lib/pipeline/logger";
import { aggregateContentPerformance } from "@/lib/analytics/contentPerformance";
import { aggregateRoomPerformance } from "@/lib/analytics/roomPerformance";

/**
 * GET /api/analytics/aggregate
 * Cron-triggered daily aggregation of content + room performance.
 */
export async function GET(request: Request): Promise<Response> {
  if (!(await verifyAdminAuth(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const event = await startPipelineEvent("analytics_aggregation", "Analytics Aggregation");

  try {
    const yesterday = new Date(Date.now() - 86400000);

    const [contentResult, roomResult] = await Promise.all([
      aggregateContentPerformance(yesterday),
      aggregateRoomPerformance(yesterday),
    ]);

    const totalProcessed = contentResult.processed + roomResult.processed;
    const totalInserted = contentResult.inserted + roomResult.inserted;

    await event.complete({
      itemsProcessed: totalProcessed,
      itemsSucceeded: totalInserted,
      summary: {
        content: contentResult,
        room: roomResult,
        date: yesterday.toISOString().split("T")[0],
      },
    });

    return Response.json({
      ok: true,
      content: contentResult,
      room: roomResult,
    });
  } catch (error) {
    await event.fail(error);
    console.error("[analytics/aggregate] error:", error);
    return Response.json(
      { ok: false, error: String(error) },
      { status: 500 }
    );
  }
}
