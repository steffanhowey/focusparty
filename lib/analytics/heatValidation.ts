// ─── Heat Score Validation ──────────────────────────────────
// Validates whether high-heat topics actually produce rooms
// that perform well. Identifies false positives (high heat,
// low performance) and missed opportunities (low heat, high perf).

import { createClient } from "@/lib/supabase/admin";
import { pearsonCorrelation } from "./scoreCalibration";
import type { ScoreCalibration, CalibrationRecommendation } from "@/lib/types";

// Current heat weights (mirrored from lib/topics/heatEngine.ts)
const CURRENT_HEAT_WEIGHTS: Record<string, number> = {
  signalCount: 0.25,
  velocity: 0.30,
  sourceDiversity: 0.25,
  contentCount: 0.20,
};

const MIN_SAMPLE_SIZE = 10;

// ─── Core validation ────────────────────────────────────────

/**
 * Validate heat scores by correlating topic heat at room generation
 * with actual room performance metrics.
 */
export async function validateHeatScores(): Promise<ScoreCalibration> {
  const supabase = createClient();

  // Get blueprints with heat scores that have been provisioned as rooms
  const { data: blueprints } = await supabase
    .from("fp_room_blueprints")
    .select("id, topic_slug, heat_score_at_generation")
    .not("heat_score_at_generation", "is", null)
    .eq("status", "provisioned");

  if (!blueprints || blueprints.length === 0) {
    return saveResult(0, 0, []);
  }

  // Get room performance for provisioned blueprints
  // Blueprint ID = room ID after provisioning
  const blueprintIds = blueprints.map((b) => b.id);
  const { data: perfData } = await supabase
    .from("fp_room_performance")
    .select("room_id, total_sessions, unique_participants, retention_rate, break_completion_rate")
    .in("room_id", blueprintIds);

  if (!perfData || perfData.length === 0) {
    return saveResult(0, 0, [{ dimension: "sample_size", currentWeight: 0, recommendedWeight: 0, reason: "No room performance data available yet" }]);
  }

  // Aggregate performance per room
  const roomPerf = new Map<string, { sessions: number; participants: number; avgRetention: number; avgBreakCompletion: number; days: number }>();
  for (const p of perfData) {
    const existing = roomPerf.get(p.room_id) ?? { sessions: 0, participants: 0, avgRetention: 0, avgBreakCompletion: 0, days: 0 };
    existing.sessions += p.total_sessions ?? 0;
    existing.participants = Math.max(existing.participants, p.unique_participants ?? 0);
    existing.avgRetention += Number(p.retention_rate ?? 0);
    existing.avgBreakCompletion += Number(p.break_completion_rate ?? 0);
    existing.days++;
    roomPerf.set(p.room_id, existing);
  }

  // Build pairs: heat_score vs composite performance
  const pairs: Array<{ heat: number; performance: number; topicSlug: string }> = [];
  for (const bp of blueprints) {
    const perf = roomPerf.get(bp.id);
    if (!perf || perf.days === 0) continue;

    // Composite performance: weighted average of session activity + retention
    const avgRetention = perf.avgRetention / perf.days;
    const avgBreakCompletion = perf.avgBreakCompletion / perf.days;
    const sessionScore = Math.min(1, perf.sessions / (perf.days * 3)); // Normalize: 3 sessions/day = 1.0
    const compositePerf = 0.4 * sessionScore + 0.3 * avgRetention + 0.3 * avgBreakCompletion;

    pairs.push({
      heat: bp.heat_score_at_generation,
      performance: compositePerf,
      topicSlug: bp.topic_slug,
    });
  }

  if (pairs.length < MIN_SAMPLE_SIZE) {
    return saveResult(pairs.length, 0, [{ dimension: "sample_size", currentWeight: 0, recommendedWeight: 0, reason: `Insufficient data: ${pairs.length} rooms (need ${MIN_SAMPLE_SIZE})` }]);
  }

  const heats = pairs.map((p) => p.heat);
  const perfs = pairs.map((p) => p.performance);
  const correlation = pearsonCorrelation(heats, perfs);

  const recommendations: CalibrationRecommendation[] = [];
  if (Math.abs(correlation) < 0.3) {
    recommendations.push({
      dimension: "heat_accuracy",
      currentWeight: correlation,
      recommendedWeight: 0,
      reason: `Weak correlation (${correlation.toFixed(3)}) between topic heat and room performance — heat scores may not predict room success`,
    });
  }

  return saveResult(pairs.length, correlation, recommendations);
}

/**
 * Get a heat accuracy report with false positives and missed opportunities.
 */
export async function getHeatAccuracyReport(): Promise<{
  topicsMeasured: number;
  avgCorrelation: number;
  topPerformers: Array<{ topicSlug: string; heatScore: number; performance: number }>;
  falsePositives: Array<{ topicSlug: string; heatScore: number; performance: number }>;
}> {
  const supabase = createClient();

  const { data: blueprints } = await supabase
    .from("fp_room_blueprints")
    .select("id, topic_slug, heat_score_at_generation")
    .not("heat_score_at_generation", "is", null)
    .eq("status", "provisioned");

  if (!blueprints || blueprints.length === 0) {
    return { topicsMeasured: 0, avgCorrelation: 0, topPerformers: [], falsePositives: [] };
  }

  const blueprintIds = blueprints.map((b) => b.id);
  const { data: perfData } = await supabase
    .from("fp_room_performance")
    .select("room_id, total_sessions, retention_rate, break_completion_rate")
    .in("room_id", blueprintIds);

  if (!perfData || perfData.length === 0) {
    return { topicsMeasured: 0, avgCorrelation: 0, topPerformers: [], falsePositives: [] };
  }

  // Aggregate performance per room
  const roomPerf = new Map<string, { sessions: number; avgRetention: number; days: number }>();
  for (const p of perfData) {
    const existing = roomPerf.get(p.room_id) ?? { sessions: 0, avgRetention: 0, days: 0 };
    existing.sessions += p.total_sessions ?? 0;
    existing.avgRetention += Number(p.retention_rate ?? 0);
    existing.days++;
    roomPerf.set(p.room_id, existing);
  }

  const entries: Array<{ topicSlug: string; heatScore: number; performance: number }> = [];
  for (const bp of blueprints) {
    const perf = roomPerf.get(bp.id);
    if (!perf || perf.days === 0) continue;
    const sessionScore = Math.min(1, perf.sessions / (perf.days * 3));
    const retentionScore = perf.avgRetention / perf.days;
    const performance = 0.6 * sessionScore + 0.4 * retentionScore;
    entries.push({ topicSlug: bp.topic_slug, heatScore: bp.heat_score_at_generation, performance });
  }

  const heats = entries.map((e) => e.heatScore);
  const perfs = entries.map((e) => e.performance);
  const avgCorrelation = entries.length >= 2 ? pearsonCorrelation(heats, perfs) : 0;

  // False positives: high heat (>0.7) but low performance (<0.3)
  const falsePositives = entries
    .filter((e) => e.heatScore > 0.7 && e.performance < 0.3)
    .sort((a, b) => b.heatScore - a.heatScore);

  // Top performers: highest actual performance
  const topPerformers = [...entries]
    .sort((a, b) => b.performance - a.performance)
    .slice(0, 5);

  return {
    topicsMeasured: entries.length,
    avgCorrelation: Math.round(avgCorrelation * 10000) / 10000,
    topPerformers,
    falsePositives,
  };
}

// ─── Persistence ────────────────────────────────────────────

async function saveResult(
  sampleSize: number,
  correlation: number,
  recommendations: CalibrationRecommendation[]
): Promise<ScoreCalibration> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("fp_score_calibrations")
    .insert({
      calibration_type: "heat_score",
      sample_size: sampleSize,
      correlation: Math.round(correlation * 10000) / 10000,
      current_weights: CURRENT_HEAT_WEIGHTS,
      recommended_weights: null,
      recommendations,
      auto_applied: false,
    })
    .select("id, run_at")
    .single();

  if (error) {
    console.error("[analytics/heatValidation] save error:", error);
  }

  return {
    id: data?.id ?? "error",
    calibrationType: "heat_score",
    runAt: data?.run_at ?? new Date().toISOString(),
    sampleSize,
    correlation: Math.round(correlation * 10000) / 10000,
    currentWeights: CURRENT_HEAT_WEIGHTS,
    recommendedWeights: null,
    recommendations,
    autoApplied: false,
    reviewedBy: null,
    reviewedAt: null,
  };
}
