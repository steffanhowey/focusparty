import { PROTOTYPE_MISSION_FAMILIES } from "@/lib/missions/config/missionFamilies";
import type { MissionFamily } from "@/lib/missions/types/common";
import {
  DEFAULT_BENCHMARK_VERSION,
  getBenchmarkCasesForFamilyScope,
  validateBenchmarkCaseSet,
} from "./benchmarkSet";

export interface MissionPrototypeConfig {
  prototypeKey: string;
  professionalFunction: "marketing";
  fluencyLevel: "practicing";
  familyScope: MissionFamily[];
  benchmarkVersion: string;
  benchmarkCaseIds: string[];
  prototypeTopicSlugs: string[];
  prototypeTopicLimit: number;
  prototypeMinHeatScore: number;
  projectionMode: "none";
}

export const PROTOTYPE_TOPIC_SELECTION_RULES: string[] = [
  "Use manual topic slugs first when they are provided.",
  "Otherwise select the hottest canonical topics above the minimum heat score.",
  "Default prototype topics should prefer the approved narrower capability/workflow topics for this slice.",
  "Exclude benchmark topics from the live prototype slice unless they were manually requested.",
  "Exclude role topics and prefer tools, techniques, concepts, or platforms.",
  "Every candidate topic must pass generic source preflight before it can assemble a packet.",
  "Prefer unique clusters before taking a second topic from the same cluster.",
  "Cap the live prototype slice at three topics.",
  "Do not widen to weaker or broader fallback topics just to hit quota.",
];

/** Build the default narrow prototype configuration for Phase 1. */
export function buildDefaultMissionPrototypeConfig(
  overrides: Partial<MissionPrototypeConfig> = {},
): MissionPrototypeConfig {
  const familyScope = overrides.familyScope ?? PROTOTYPE_MISSION_FAMILIES;
  const benchmarkCases = getBenchmarkCasesForFamilyScope(familyScope);
  validateBenchmarkCaseSet(benchmarkCases);

  return {
    prototypeKey:
      overrides.prototypeKey ??
      `mission-prototype-${new Date().toISOString().slice(0, 10)}`,
    professionalFunction: "marketing",
    fluencyLevel: "practicing",
    familyScope,
    benchmarkVersion: overrides.benchmarkVersion ?? DEFAULT_BENCHMARK_VERSION,
    benchmarkCaseIds:
      overrides.benchmarkCaseIds ?? benchmarkCases.map((item) => item.id),
    prototypeTopicSlugs:
      overrides.prototypeTopicSlugs ??
      ["prompt-engineering", "claude-code", "model-context-protocol"],
    prototypeTopicLimit: Math.min(
      3,
      Math.max(1, overrides.prototypeTopicLimit ?? 3),
    ),
    prototypeMinHeatScore: overrides.prototypeMinHeatScore ?? 0.2,
    projectionMode: "none",
  };
}

/** Validate the runtime prototype config before execution. */
export function validateMissionPrototypeConfig(
  config: MissionPrototypeConfig,
): void {
  if (config.familyScope.length === 0) {
    throw new Error("Prototype config requires at least one mission family.");
  }

  if (config.prototypeTopicLimit < 1 || config.prototypeTopicLimit > 3) {
    throw new Error("Prototype topic limit must stay between 1 and 3.");
  }

  const benchmarkCases = getBenchmarkCasesForFamilyScope(config.familyScope).filter((item) =>
    config.benchmarkCaseIds.includes(item.id),
  );
  validateBenchmarkCaseSet(benchmarkCases);
}
