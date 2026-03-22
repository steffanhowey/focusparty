import type { TimelinessClass } from "@/lib/missions/types/common";

export const MISSION_QUALITY_THRESHOLDS = {
  overallPassScore: 80,
  minCriticalDimension: 4,
  minSourceReferences: 2,
  minSteps: 3,
  maxSteps: 6,
  minSuccessCriteria: 3,
  minTimeboxMinutes: 25,
  maxTimeboxMinutes: 60,
  maxHardCapMinutes: 75,
  maxRequiredInputs: 4,
} as const;

/** Get the minimum novel-user-value threshold by timeliness class. */
export function getNovelUserValueThreshold(
  timelinessClass: TimelinessClass,
): number {
  return timelinessClass === "evergreen-foundation" ? 3 : 4;
}
