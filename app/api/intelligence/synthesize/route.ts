/**
 * GET /api/intelligence/synthesize
 *
 * Weekly cron (Monday 6am UTC): synthesizes skill intelligence
 * insights from market state + practitioner data using GPT-4o-mini.
 */

import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { startPipelineEvent } from "@/lib/pipeline/logger";
import { synthesizeWeeklyIntelligence } from "@/lib/intelligence/intelligenceSynthesis";

export async function GET(request: Request): Promise<Response> {
  if (!(await verifyAdminAuth(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const event = await startPipelineEvent(
    "intelligence_synthesis",
    "Intelligence Synthesis"
  );

  try {
    const result = await synthesizeWeeklyIntelligence();

    await event.complete({
      itemsProcessed: result.insights_generated,
      itemsSucceeded: result.insights_published,
      summary: {
        generated: result.insights_generated,
        published: result.insights_published,
      },
    });

    return Response.json({ ok: true, ...result });
  } catch (error) {
    await event.fail(error);
    console.error("[intelligence/synthesize] error:", error);
    return Response.json(
      { ok: false, error: String(error) },
      { status: 500 }
    );
  }
}
