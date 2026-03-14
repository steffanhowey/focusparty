// ─── Score Calibration Cron ──────────────────────────────────
// Weekly Sunday 3am UTC: runs taste score calibration, heat
// validation, and creator performance analysis.

import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { startPipelineEvent } from "@/lib/pipeline/logger";
import { calibrateTasteScores } from "@/lib/analytics/scoreCalibration";
import { validateHeatScores } from "@/lib/analytics/heatValidation";
import { analyzeCreatorPerformance } from "@/lib/analytics/creatorPerformance";

/**
 * GET /api/analytics/calibrate
 * Cron-triggered weekly calibration of scoring systems.
 */
export async function GET(request: Request): Promise<Response> {
  if (!(await verifyAdminAuth(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const event = await startPipelineEvent("score_calibration", "Score Calibration");

  try {
    const [tasteResult, heatResult, creatorResult] = await Promise.all([
      calibrateTasteScores(),
      validateHeatScores(),
      analyzeCreatorPerformance(),
    ]);

    await event.complete({
      itemsProcessed: 3,
      itemsSucceeded: 3,
      summary: {
        tasteCalibration: {
          sampleSize: tasteResult.sampleSize,
          correlation: tasteResult.correlation,
          recommendations: tasteResult.recommendations.length,
        },
        heatValidation: {
          sampleSize: heatResult.sampleSize,
          correlation: heatResult.correlation,
          recommendations: heatResult.recommendations.length,
        },
        creatorPerformance: creatorResult,
      },
    });

    return Response.json({
      ok: true,
      taste: {
        sampleSize: tasteResult.sampleSize,
        correlation: tasteResult.correlation,
        recommendations: tasteResult.recommendations.length,
      },
      heat: {
        sampleSize: heatResult.sampleSize,
        correlation: heatResult.correlation,
      },
      creators: creatorResult,
    });
  } catch (error) {
    await event.fail(error);
    console.error("[analytics/calibrate] error:", error);
    return Response.json(
      { ok: false, error: String(error) },
      { status: 500 }
    );
  }
}
