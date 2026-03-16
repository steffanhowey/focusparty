/**
 * Skill assessment — determines skill fluency level from accumulated data.
 *
 * Fluency progression thresholds:
 *   exploring:  0-1 paths, any score
 *   practicing: 2+ paths, avg score >= 50
 *   proficient: 4+ paths, avg score >= 70
 *   advanced:   6+ paths, avg score >= 80
 */

import type { SkillFluency } from "@/lib/types/skills";

interface SkillProgress {
  paths_completed: number;
  avg_score: number | null;
}

/** Determine fluency level from accumulated progress data. */
export function assessFluencyLevel(progress: SkillProgress): SkillFluency {
  const { paths_completed, avg_score } = progress;
  const score = avg_score ?? 0;

  if (paths_completed >= 6 && score >= 80) return "advanced";
  if (paths_completed >= 4 && score >= 70) return "proficient";
  if (paths_completed >= 2 && score >= 50) return "practicing";
  return "exploring";
}

/** Human-readable label for a fluency level. */
export function fluencyLabel(level: SkillFluency): string {
  const labels: Record<SkillFluency, string> = {
    exploring: "Exploring",
    practicing: "Practicing",
    proficient: "Proficient",
    advanced: "Advanced",
  };
  return labels[level];
}

/** Numeric index for comparing fluency levels (higher = more fluent). */
export function fluencyIndex(level: SkillFluency): number {
  const order: Record<SkillFluency, number> = {
    exploring: 0,
    practicing: 1,
    proficient: 2,
    advanced: 3,
  };
  return order[level];
}

/**
 * Calculate updated average score using weighted cumulative method.
 * Avoids needing to re-query all historical evaluations.
 */
export function recalculateAvgScore(
  currentAvg: number | null,
  currentCount: number,
  newScores: number[],
): { avg_score: number; total_count: number } {
  if (newScores.length === 0) {
    return { avg_score: currentAvg ?? 0, total_count: currentCount };
  }

  const oldSum = (currentAvg ?? 0) * currentCount;
  const newSum = newScores.reduce((a, b) => a + b, 0);
  const totalCount = currentCount + newScores.length;
  const newAvg = (oldSum + newSum) / totalCount;

  return {
    avg_score: Math.round(newAvg * 100) / 100,
    total_count: totalCount,
  };
}
