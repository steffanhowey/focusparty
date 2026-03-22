import type {
  FluencyLevel,
  MissionFamily,
  ProfessionalFunction,
} from "@/lib/missions/types/common";

export type MissionFamilyCoverageState =
  | "primary"
  | "secondary"
  | "unsupported";

export type MissionFamilyCoverageConfidence =
  | "high"
  | "medium"
  | "provisional";

export interface MissionFamilyCoverageEntry {
  topicSlug: string;
  professionalFunction: ProfessionalFunction;
  fluencyLevel: FluencyLevel;
  missionFamily: MissionFamily;
  coverageState: MissionFamilyCoverageState;
  coverageConfidence?: MissionFamilyCoverageConfidence;
  reason: string;
}

export interface MissionFamilyCoverageLookup {
  topicSlug: string;
  professionalFunction: ProfessionalFunction;
  fluencyLevel: FluencyLevel;
}

export interface EligibleMissionFamiliesInput extends MissionFamilyCoverageLookup {
  candidateFamilies: MissionFamily[];
}

export const MISSION_FAMILY_COVERAGE_REGISTRY: MissionFamilyCoverageEntry[] = [
  {
    topicSlug: "prompt-engineering",
    professionalFunction: "marketing",
    fluencyLevel: "practicing",
    missionFamily: "research-synthesis",
    coverageState: "primary",
    coverageConfidence: "high",
    reason:
      "Prompt engineering is proven as a research/operator lane for marketers.",
  },
  {
    topicSlug: "prompt-engineering",
    professionalFunction: "marketing",
    fluencyLevel: "practicing",
    missionFamily: "messaging-translation",
    coverageState: "secondary",
    coverageConfidence: "high",
    reason:
      "Prompt engineering also supports messaging prep when intent is explicit.",
  },
  {
    topicSlug: "claude-code",
    professionalFunction: "marketing",
    fluencyLevel: "practicing",
    missionFamily: "research-synthesis",
    coverageState: "primary",
    coverageConfidence: "high",
    reason:
      "Claude Code is proven as a research/workflow lane for marketers.",
  },
  {
    topicSlug: "claude-code",
    professionalFunction: "marketing",
    fluencyLevel: "practicing",
    missionFamily: "messaging-translation",
    coverageState: "secondary",
    coverageConfidence: "high",
    reason:
      "Claude Code messaging work is supported, but should stay intent-driven.",
  },
  {
    topicSlug: "github-copilot",
    professionalFunction: "marketing",
    fluencyLevel: "practicing",
    missionFamily: "research-synthesis",
    coverageState: "primary",
    coverageConfidence: "medium",
    reason:
      "GitHub Copilot has a proven research-synthesis lane for marketers.",
  },
  {
    topicSlug: "github-copilot",
    professionalFunction: "marketing",
    fluencyLevel: "practicing",
    missionFamily: "messaging-translation",
    coverageState: "unsupported",
    coverageConfidence: "high",
    reason:
      "GitHub Copilot messaging-translation is blocked by one-session fit and should stay off the canonical lane.",
  },
];

function matchesLane(
  entry: MissionFamilyCoverageEntry,
  lookup: MissionFamilyCoverageLookup,
): boolean {
  return (
    entry.topicSlug === lookup.topicSlug &&
    entry.professionalFunction === lookup.professionalFunction &&
    entry.fluencyLevel === lookup.fluencyLevel
  );
}

export function listMissionFamilyCoverageForLane(
  lookup: MissionFamilyCoverageLookup,
): MissionFamilyCoverageEntry[] {
  return MISSION_FAMILY_COVERAGE_REGISTRY.filter((entry) =>
    matchesLane(entry, lookup),
  );
}

export function getMissionFamilyCoverage(
  lookup: MissionFamilyCoverageLookup,
  missionFamily: MissionFamily,
): MissionFamilyCoverageEntry | null {
  return (
    listMissionFamilyCoverageForLane(lookup).find(
      (entry) => entry.missionFamily === missionFamily,
    ) ?? null
  );
}

export function getPrimaryMissionFamilyForLane(
  lookup: MissionFamilyCoverageLookup,
): MissionFamily | null {
  return (
    listMissionFamilyCoverageForLane(lookup).find(
      (entry) => entry.coverageState === "primary",
    )?.missionFamily ?? null
  );
}

export function getEligibleMissionFamiliesForLane(
  input: EligibleMissionFamiliesInput,
): MissionFamily[] {
  const laneCoverage = listMissionFamilyCoverageForLane(input);

  if (laneCoverage.length === 0) {
    return input.candidateFamilies;
  }

  const eligibleFamilies = new Set(
    laneCoverage
      .filter((entry) => entry.coverageState !== "unsupported")
      .map((entry) => entry.missionFamily),
  );

  return input.candidateFamilies.filter((family) =>
    eligibleFamilies.has(family),
  );
}

export function isMissionFamilySupportedForLane(
  lookup: MissionFamilyCoverageLookup,
  missionFamily: MissionFamily,
): boolean {
  const coverage = getMissionFamilyCoverage(lookup, missionFamily);
  if (!coverage) {
    return listMissionFamilyCoverageForLane(lookup).length === 0;
  }

  return coverage.coverageState !== "unsupported";
}

