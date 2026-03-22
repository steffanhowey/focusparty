import type {
  ArtifactType,
  LaunchDomainKey,
  LaunchRoomKey,
  MissionFamily,
} from "@/lib/missions/types/common";

export interface MissionBenchmarkCase {
  id: string;
  label: string;
  topicSlug: string;
  missionFamily: MissionFamily;
  expectedArtifactType: ArtifactType;
  expectedLaunchDomain: LaunchDomainKey;
  expectedBestRoomKey: LaunchRoomKey;
  requiredUseCaseTerms: string[];
  requiredFramingTerms: string[];
  notes: string[];
}

export const DEFAULT_BENCHMARK_VERSION = "benchmark_v1";

export const MISSION_BENCHMARK_CASES: MissionBenchmarkCase[] = [
  {
    id: "prompt-engineering-research-synthesis",
    label: "Prompt Engineering Research Synthesis",
    topicSlug: "prompt-engineering",
    missionFamily: "research-synthesis",
    expectedArtifactType: "audience-brief",
    expectedLaunchDomain: "research-insight",
    expectedBestRoomKey: "research-room",
    requiredUseCaseTerms: ["research", "insight", "prompt"],
    requiredFramingTerms: ["marketer", "marketing", "workflow"],
    notes: [
      "The brief should focus on one named workflow, such as content-brief drafting, not prompt engineering in general.",
      "A strong pass documents two prompt structures, two failure modes, and one recommended workflow change backed by source evidence.",
    ],
  },
  {
    id: "claude-code-research-synthesis",
    label: "Claude Code Research Synthesis",
    topicSlug: "claude-code",
    missionFamily: "research-synthesis",
    expectedArtifactType: "audience-brief",
    expectedLaunchDomain: "research-insight",
    expectedBestRoomKey: "research-room",
    requiredUseCaseTerms: ["source", "synthesis", "workflow"],
    requiredFramingTerms: ["marketing", "research", "evidence"],
    notes: [
      "The mission should clearly lean on source-backed workflow synthesis and not drift into open-ended education.",
      "The deliverable should be immediately useful to a marketing workflow.",
    ],
  },
  {
    id: "prompt-engineering-messaging-translation",
    label: "Prompt Engineering Messaging Translation",
    topicSlug: "prompt-engineering",
    missionFamily: "messaging-translation",
    expectedArtifactType: "message-matrix",
    expectedLaunchDomain: "positioning-messaging",
    expectedBestRoomKey: "messaging-lab",
    requiredUseCaseTerms: ["message", "positioning", "prompt"],
    requiredFramingTerms: ["marketing", "message", "audience"],
    notes: [
      "The mission should translate a technical capability into marketer-ready language choices.",
      "A strong pass should feel like a practical positioning rep, not a vague brainstorm.",
    ],
  },
  {
    id: "claude-code-messaging-translation",
    label: "Claude Code Messaging Translation",
    topicSlug: "claude-code",
    missionFamily: "messaging-translation",
    expectedArtifactType: "message-matrix",
    expectedLaunchDomain: "positioning-messaging",
    expectedBestRoomKey: "messaging-lab",
    requiredUseCaseTerms: ["message", "positioning", "workflow"],
    requiredFramingTerms: ["marketing", "messaging", "brand"],
    notes: [
      "The mission should anchor itself in one concrete communication scenario, such as a product marketer briefing a marketing ops lead on a pilot.",
      "The artifact should include an audience, pain point, value claim, proof set, objection, and non-fit boundary before it explains Claude Code at all.",
    ],
  },
];

/** Return the benchmark cases relevant to the current prototype family scope. */
export function getBenchmarkCasesForFamilyScope(
  familyScope: MissionFamily[],
): MissionBenchmarkCase[] {
  const allowed = new Set(familyScope);
  return MISSION_BENCHMARK_CASES.filter((item) => allowed.has(item.missionFamily));
}

/** Validate that the benchmark case set is complete enough for the prototype slice. */
export function validateBenchmarkCaseSet(
  cases: MissionBenchmarkCase[],
): void {
  if (cases.length < 4) {
    throw new Error(
      "Benchmark calibration requires at least four cases in the prototype slice.",
    );
  }

  const counts = cases.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item.missionFamily] = (accumulator[item.missionFamily] ?? 0) + 1;
    return accumulator;
  }, {});

  for (const family of ["research-synthesis", "messaging-translation"] as const) {
    if ((counts[family] ?? 0) < 2) {
      throw new Error(
        `Benchmark calibration requires at least two cases for ${family}.`,
      );
    }
  }
}
