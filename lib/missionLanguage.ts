import type { LearningPath } from "@/lib/types";
import { getMissionPrimaryArea } from "@/lib/missionPresentation";

interface MissionBuildsLineOptions {
  includeDomain?: boolean;
}

/**
 * Formats a mission count for user-facing capability surfaces.
 */
export function formatMissionUnit(count: number): string {
  return `${count} mission${count === 1 ? "" : "s"}`;
}

/**
 * Formats a step count for user-facing mission progress surfaces.
 */
export function formatStepUnit(count: number): string {
  return `${count} step${count === 1 ? "" : "s"}`;
}

/**
 * Returns a quiet capability line for mission-first surfaces.
 */
export function getMissionBuildsLine(
  path: LearningPath,
  options: MissionBuildsLineOptions = {},
): string | null {
  const { includeDomain = true } = options;
  const area = getMissionPrimaryArea(path);

  if (!area.label) return null;

  if (includeDomain && area.detail) {
    return `Builds: ${area.label} · ${area.detail}`;
  }

  return `Builds: ${area.label}`;
}

/**
 * Returns a quiet recommendation explainer without changing the mission-first hierarchy.
 */
export function getWhyThisNextLine(reasonText: string): string {
  return `Why this next: ${reasonText}`;
}
