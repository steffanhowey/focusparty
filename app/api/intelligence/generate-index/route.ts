/**
 * GET /api/intelligence/generate-index
 *
 * Weekly cron (Monday 7am UTC): generates monthly AI Skills Index.
 * Only produces output in the first 7 days of the month.
 */

import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { startPipelineEvent } from "@/lib/pipeline/logger";
import { generateMonthlyIndex } from "@/lib/intelligence/indexGeneration";

export async function GET(request: Request): Promise<Response> {
  if (!(await verifyAdminAuth(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const event = await startPipelineEvent(
    "skill_index_generation",
    "Skill Index Generation"
  );

  try {
    const result = await generateMonthlyIndex();

    if (result.skipped) {
      await event.complete({
        itemsProcessed: 0,
        itemsSucceeded: 0,
        summary: { skipped: true, period: result.period || "N/A" },
      });
      return Response.json({ ok: true, skipped: true, period: result.period });
    }

    await event.complete({
      itemsProcessed: 1,
      itemsSucceeded: result.entry_id ? 1 : 0,
      summary: { period: result.period, entry_id: result.entry_id },
    });

    return Response.json({ ok: true, ...result });
  } catch (error) {
    await event.fail(error);
    console.error("[intelligence/generate-index] error:", error);
    return Response.json(
      { ok: false, error: String(error) },
      { status: 500 }
    );
  }
}
