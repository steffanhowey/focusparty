import {
  getLaunchMissionLaneKey,
  type LaunchMissionLaneKey,
} from "@/lib/launchMissionContent";
import type { LearningPath } from "@/lib/types";

export const CORE_LAUNCH_PATH_ORDER: LaunchMissionLaneKey[] = [
  "prompt-engineering:research-insight",
  "prompt-engineering:positioning-messaging",
  "claude-code:research-insight",
];

export const EXTENDED_LAUNCH_ORDER: LaunchMissionLaneKey[] = [
  "claude-code:positioning-messaging",
  "github-copilot:research-insight",
];

export interface LaunchFrontDoorStep {
  laneKey: LaunchMissionLaneKey;
  stepLabel: string;
  title: string;
  supportLine: string;
}

export interface LaunchFrontDoorBuckets {
  corePaths: LearningPath[];
  extendedPaths: LearningPath[];
  remainingPaths: LearningPath[];
}

export const CORE_LAUNCH_FRONT_DOOR_STEPS: LaunchFrontDoorStep[] = [
  {
    laneKey: "prompt-engineering:research-insight",
    stepLabel: "Step 1",
    title: "Better AI thinking",
    supportLine:
      "Start by tightening one recurring workflow so AI output becomes more reliable.",
  },
  {
    laneKey: "prompt-engineering:positioning-messaging",
    stepLabel: "Step 2",
    title: "Better marketing output",
    supportLine:
      "Then turn that stronger prompt logic into a sharper message asset you can actually use.",
  },
  {
    laneKey: "claude-code:research-insight",
    stepLabel: "Step 3",
    title: "Better workflow design",
    supportLine:
      "Then step up from outputs into workflow leverage and decide where a tool is worth testing.",
  },
];

export function buildLaunchFrontDoorBuckets(
  paths: LearningPath[],
): LaunchFrontDoorBuckets {
  const dedupedPaths: LearningPath[] = [];
  const seenPathIds = new Set<string>();

  for (const path of paths) {
    if (seenPathIds.has(path.id)) continue;
    seenPathIds.add(path.id);
    dedupedPaths.push(path);
  }

  const byLane = new Map<LaunchMissionLaneKey, LearningPath>();

  for (const path of dedupedPaths) {
    const laneKey = getLaunchMissionLaneKey(path);
    if (!laneKey) continue;
    if (!byLane.has(laneKey)) {
      byLane.set(laneKey, path);
    }
  }

  const corePaths = CORE_LAUNCH_PATH_ORDER.map((laneKey) => byLane.get(laneKey)).filter(
    (path): path is LearningPath => Boolean(path),
  );
  const extendedPaths = EXTENDED_LAUNCH_ORDER.map((laneKey) => byLane.get(laneKey)).filter(
    (path): path is LearningPath => Boolean(path),
  );

  const curatedIds = new Set([
    ...corePaths.map((path) => path.id),
    ...extendedPaths.map((path) => path.id),
  ]);

  return {
    corePaths,
    extendedPaths,
    remainingPaths: dedupedPaths.filter((path) => !curatedIds.has(path.id)),
  };
}
