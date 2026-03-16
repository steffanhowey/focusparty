/**
 * GET /api/intelligence/skill-heat
 *
 * Daily cron (3:30am UTC): computes skill market state from
 * topic heat scores + practitioner data.
 */

import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { startPipelineEvent } from "@/lib/pipeline/logger";
import { computeSkillMarketState } from "@/lib/intelligence/skillHeatComputation";

export async function GET(request: Request): Promise<Response> {
  if (!(await verifyAdminAuth(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const event = await startPipelineEvent(
    "skill_heat_computation",
    "Skill Heat Computation"
  );

  try {
    const result = await computeSkillMarketState();

    await event.complete({
      itemsProcessed: result.skills_updated,
      itemsSucceeded: result.skills_updated,
      summary: {
        rising: result.rising,
        emerging: result.emerging,
        declining: result.declining,
      },
    });

    return Response.json({ ok: true, ...result });
  } catch (error) {
    await event.fail(error);
    console.error("[intelligence/skill-heat] error:", error);
    return Response.json(
      { ok: false, error: String(error) },
      { status: 500 }
    );
  }
}
