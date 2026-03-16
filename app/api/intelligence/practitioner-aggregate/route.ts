/**
 * GET /api/intelligence/practitioner-aggregate
 *
 * Daily cron (3am UTC): aggregates fp_user_skills into
 * fp_practitioner_snapshots for trend analysis.
 */

import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { startPipelineEvent } from "@/lib/pipeline/logger";
import { aggregatePractitionerSnapshots } from "@/lib/intelligence/practitionerAggregation";

export async function GET(request: Request): Promise<Response> {
  if (!(await verifyAdminAuth(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const event = await startPipelineEvent(
    "practitioner_aggregation",
    "Practitioner Aggregation"
  );

  try {
    const result = await aggregatePractitionerSnapshots();

    await event.complete({
      itemsProcessed: result.skills_processed,
      itemsSucceeded: result.snapshots_created,
      summary: result,
    });

    return Response.json({ ok: true, ...result });
  } catch (error) {
    await event.fail(error);
    console.error("[intelligence/practitioner-aggregate] error:", error);
    return Response.json(
      { ok: false, error: String(error) },
      { status: 500 }
    );
  }
}
