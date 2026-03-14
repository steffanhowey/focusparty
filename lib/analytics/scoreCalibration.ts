// ─── Score Calibration Module ────────────────────────────────
// Computes Pearson correlation between predicted taste scores
// and actual engagement performance. Generates weight adjustment
// recommendations when correlation is weak. Never auto-applies.

import { createClient } from "@/lib/supabase/admin";
import type { ScoreCalibration, CalibrationRecommendation } from "@/lib/types";

// Current taste score weights (mirrored from lib/breaks/scoring.ts)
const CURRENT_TASTE_WEIGHTS: Record<string, number> = {
  relevance: 0.3,
  engagement: 0.2,
  content_density: 0.2,
  creator_authority: 0.1,
  freshness: 0.1,
  novelty: 0.1,
};

const MIN_SAMPLE_SIZE = 30;

// ─── Core calibration ──────────────────────────────────────

/**
 * Calibrate taste scores against actual content engagement.
 * Joins scores with performance data, computes correlation,
 * and generates weight adjustment recommendations.
 */
export async function calibrateTasteScores(): Promise<ScoreCalibration> {
  const supabase = createClient();

  // Get scored content that also has performance data
  // Join via video_id: candidates.external_id = performance.video_id
  const { data: scores } = await supabase
    .from("fp_break_content_scores")
    .select(`
      candidate_id,
      taste_score,
      relevance_score,
      engagement_score,
      content_density,
      creator_authority,
      freshness_score,
      novelty_score
    `)
    .not("taste_score", "is", null);

  if (!scores || scores.length === 0) {
    return saveCalibration("taste_score", 0, 0, CURRENT_TASTE_WEIGHTS, null, []);
  }

  // Get the candidate external_ids to match with performance data
  const candidateIds = scores.map((s) => s.candidate_id);
  const { data: candidates } = await supabase
    .from("fp_break_content_candidates")
    .select("id, external_id")
    .in("id", candidateIds);

  if (!candidates || candidates.length === 0) {
    return saveCalibration("taste_score", 0, 0, CURRENT_TASTE_WEIGHTS, null, []);
  }

  // Map candidate_id → external_id (video_id)
  const candidateToVideo = new Map<string, string>();
  for (const c of candidates) {
    candidateToVideo.set(c.id, c.external_id);
  }

  // Get performance data for these video IDs
  const videoIds = [...new Set(candidateToVideo.values())];
  const { data: perfData } = await supabase
    .from("fp_content_performance")
    .select("video_id, engagement_score")
    .in("video_id", videoIds)
    .gt("starts", 0);

  if (!perfData || perfData.length === 0) {
    return saveCalibration("taste_score", 0, 0, CURRENT_TASTE_WEIGHTS, null, []);
  }

  // Compute average engagement per video
  const perfMap = new Map<string, number[]>();
  for (const p of perfData) {
    const arr = perfMap.get(p.video_id) ?? [];
    arr.push(Number(p.engagement_score));
    perfMap.set(p.video_id, arr);
  }
  const avgPerf = new Map<string, number>();
  for (const [vid, vals] of perfMap) {
    avgPerf.set(vid, vals.reduce((s, v) => s + v, 0) / vals.length);
  }

  // Build paired data: predicted taste_score vs actual engagement
  const pairs: Array<{
    predicted: number;
    actual: number;
    dimensions: Record<string, number>;
  }> = [];

  for (const score of scores) {
    const videoId = candidateToVideo.get(score.candidate_id);
    if (!videoId) continue;
    const actual = avgPerf.get(videoId);
    if (actual === undefined) continue;

    pairs.push({
      predicted: score.taste_score,
      actual,
      dimensions: {
        relevance: score.relevance_score ?? 0,
        engagement: score.engagement_score ?? 0,
        content_density: score.content_density ?? 0,
        creator_authority: score.creator_authority ?? 0,
        freshness: score.freshness_score ?? 0,
        novelty: score.novelty_score ?? 0,
      },
    });
  }

  if (pairs.length < MIN_SAMPLE_SIZE) {
    return saveCalibration(
      "taste_score",
      pairs.length,
      0,
      CURRENT_TASTE_WEIGHTS,
      null,
      [{ dimension: "sample_size", currentWeight: 0, recommendedWeight: 0, reason: `Insufficient data: ${pairs.length} samples (need ${MIN_SAMPLE_SIZE})` }]
    );
  }

  // Compute overall correlation
  const predicted = pairs.map((p) => p.predicted);
  const actual = pairs.map((p) => p.actual);
  const correlation = pearsonCorrelation(predicted, actual);

  // Generate recommendations if correlation is weak
  const recommendations = generateWeightRecommendations(pairs);

  // Build recommended weights if any recommendations exist
  let recommendedWeights: Record<string, number> | null = null;
  if (recommendations.length > 0) {
    recommendedWeights = { ...CURRENT_TASTE_WEIGHTS };
    for (const rec of recommendations) {
      if (rec.dimension in recommendedWeights) {
        recommendedWeights[rec.dimension] = rec.recommendedWeight;
      }
    }
    // Normalize to sum to 1
    const total = Object.values(recommendedWeights).reduce((s, v) => s + v, 0);
    if (total > 0) {
      for (const key of Object.keys(recommendedWeights)) {
        recommendedWeights[key] = Math.round((recommendedWeights[key] / total) * 100) / 100;
      }
    }
  }

  return saveCalibration(
    "taste_score",
    pairs.length,
    correlation,
    CURRENT_TASTE_WEIGHTS,
    recommendedWeights,
    recommendations
  );
}

// ─── Math helpers ───────────────────────────────────────────

/**
 * Compute Pearson correlation coefficient between two arrays.
 * Returns value in [-1, 1]. Returns 0 for degenerate cases.
 */
export function pearsonCorrelation(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;

  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;

  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    sumXY += dx * dy;
    sumX2 += dx * dx;
    sumY2 += dy * dy;
  }

  const denom = Math.sqrt(sumX2 * sumY2);
  if (denom === 0) return 0;

  return sumXY / denom;
}

/**
 * Generate weight adjustment recommendations based on per-dimension
 * correlation with actual performance.
 */
export function generateWeightRecommendations(
  pairs: Array<{ dimensions: Record<string, number>; actual: number }>
): CalibrationRecommendation[] {
  const recommendations: CalibrationRecommendation[] = [];
  const actuals = pairs.map((p) => p.actual);
  const dimensions = Object.keys(CURRENT_TASTE_WEIGHTS);

  // Compute per-dimension correlation with actual engagement
  const dimCorrelations: Record<string, number> = {};
  for (const dim of dimensions) {
    const dimValues = pairs.map((p) => p.dimensions[dim] ?? 0);
    dimCorrelations[dim] = pearsonCorrelation(dimValues, actuals);
  }

  // Only recommend changes if a dimension's correlation significantly
  // diverges from its weight proportion
  const totalCorr = Object.values(dimCorrelations).reduce(
    (s, v) => s + Math.max(0, v),
    0
  );

  if (totalCorr <= 0) {
    recommendations.push({
      dimension: "overall",
      currentWeight: 0,
      recommendedWeight: 0,
      reason: "No positive correlations found — scoring dimensions may need fundamental rethinking",
    });
    return recommendations;
  }

  for (const dim of dimensions) {
    const currentWeight = CURRENT_TASTE_WEIGHTS[dim];
    const corr = dimCorrelations[dim];
    const idealWeight = Math.max(0, corr) / totalCorr;
    const delta = Math.abs(idealWeight - currentWeight);

    // Only recommend if delta is significant (> 0.05)
    if (delta > 0.05) {
      recommendations.push({
        dimension: dim,
        currentWeight,
        recommendedWeight: Math.round(idealWeight * 100) / 100,
        reason: `Correlation with engagement: ${corr.toFixed(3)}. ${
          idealWeight > currentWeight
            ? `Underweighted — this dimension predicts engagement better than its weight suggests`
            : `Overweighted — this dimension's correlation with engagement doesn't justify its weight`
        }`,
      });
    }
  }

  return recommendations;
}

// ─── Persistence ────────────────────────────────────────────

async function saveCalibration(
  type: ScoreCalibration["calibrationType"],
  sampleSize: number,
  correlation: number,
  currentWeights: Record<string, number>,
  recommendedWeights: Record<string, number> | null,
  recommendations: CalibrationRecommendation[]
): Promise<ScoreCalibration> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("fp_score_calibrations")
    .insert({
      calibration_type: type,
      sample_size: sampleSize,
      correlation: Math.round(correlation * 10000) / 10000,
      current_weights: currentWeights,
      recommended_weights: recommendedWeights,
      recommendations,
      auto_applied: false,
    })
    .select("id, run_at, created_at")
    .single();

  if (error) {
    console.error("[analytics/scoreCalibration] save error:", error);
  }

  return {
    id: data?.id ?? "error",
    calibrationType: type,
    runAt: data?.run_at ?? new Date().toISOString(),
    sampleSize,
    correlation: Math.round(correlation * 10000) / 10000,
    currentWeights,
    recommendedWeights,
    recommendations,
    autoApplied: false,
    reviewedBy: null,
    reviewedAt: null,
  };
}

/**
 * Get the most recent calibration results.
 */
export async function getRecentCalibrations(limit = 10): Promise<ScoreCalibration[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("fp_score_calibrations")
    .select("*")
    .order("run_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map(mapCalibrationRow);
}

/**
 * Mark a calibration as reviewed.
 */
export async function reviewCalibration(
  id: string,
  reviewedBy: string,
  apply: boolean
): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("fp_score_calibrations")
    .update({
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      auto_applied: apply,
    })
    .eq("id", id);
}

function mapCalibrationRow(row: Record<string, unknown>): ScoreCalibration {
  return {
    id: row.id as string,
    calibrationType: row.calibration_type as ScoreCalibration["calibrationType"],
    runAt: row.run_at as string,
    sampleSize: row.sample_size as number,
    correlation: Number(row.correlation ?? 0),
    currentWeights: (row.current_weights as Record<string, number>) ?? {},
    recommendedWeights: (row.recommended_weights as Record<string, number>) ?? null,
    recommendations: (row.recommendations as CalibrationRecommendation[]) ?? [],
    autoApplied: (row.auto_applied as boolean) ?? false,
    reviewedBy: (row.reviewed_by as string) ?? null,
    reviewedAt: (row.reviewed_at as string) ?? null,
  };
}
