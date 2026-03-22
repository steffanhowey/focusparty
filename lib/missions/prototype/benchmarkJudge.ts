import type { MissionBriefV2 } from "@/lib/missions/types/missionBriefV2";
import type { MissionBenchmarkCase } from "./benchmarkSet";

export interface BenchmarkJudgmentCheck {
  key: string;
  passed: boolean;
  detail: string;
}

export interface BenchmarkJudgment {
  caseId: string;
  caseLabel: string;
  passed: boolean;
  score: number;
  checks: BenchmarkJudgmentCheck[];
  notes: string[];
}

export interface BenchmarkJudgmentInput {
  benchmarkCase: MissionBenchmarkCase;
  brief: MissionBriefV2 | null;
}

/** Judge whether a generated benchmark brief clears the calibration bar. */
export function judgeBenchmarkMission(
  input: BenchmarkJudgmentInput,
): BenchmarkJudgment {
  if (!input.brief) {
    return {
      caseId: input.benchmarkCase.id,
      caseLabel: input.benchmarkCase.label,
      passed: false,
      score: 0,
      checks: [
        {
          key: "brief_generated",
          passed: false,
          detail: "No mission brief was generated for the benchmark case.",
        },
      ],
      notes: ["Benchmark run did not make it through brief generation."],
    };
  }

  const searchText = [
    input.brief.framing.whyThisMattersNow,
    input.brief.framing.whyThisMattersForMarketing,
    input.brief.framing.marketerUseCase,
    input.brief.artifact.outputDescription,
    input.brief.identity.summary,
  ]
    .join(" ")
    .toLowerCase();

  const checks: BenchmarkJudgmentCheck[] = [
    {
      key: "family_match",
      passed: input.brief.identity.missionFamily === input.benchmarkCase.missionFamily,
      detail: `Expected family ${input.benchmarkCase.missionFamily}.`,
    },
    {
      key: "artifact_match",
      passed:
        input.brief.artifact.artifactType ===
        input.benchmarkCase.expectedArtifactType,
      detail: `Expected artifact ${input.benchmarkCase.expectedArtifactType}.`,
    },
    {
      key: "launch_domain_match",
      passed:
        input.brief.identity.launchDomain ===
        input.benchmarkCase.expectedLaunchDomain,
      detail: `Expected launch domain ${input.benchmarkCase.expectedLaunchDomain}.`,
    },
    {
      key: "best_room_match",
      passed: input.brief.bestRoom.roomKey === input.benchmarkCase.expectedBestRoomKey,
      detail: `Expected best room ${input.benchmarkCase.expectedBestRoomKey}.`,
    },
    {
      key: "use_case_anchor",
      passed: input.benchmarkCase.requiredUseCaseTerms.some((term) =>
        searchText.includes(term.toLowerCase()),
      ),
      detail: "Expected the use case framing to contain at least one benchmark anchor term.",
    },
    {
      key: "framing_anchor",
      passed: input.benchmarkCase.requiredFramingTerms.some((term) =>
        searchText.includes(term.toLowerCase()),
      ),
      detail: "Expected the framing to reflect marketer-native benchmark language.",
    },
    {
      key: "proof_shape",
      passed:
        input.brief.execution.steps.length >= 3 &&
        input.brief.execution.steps.length <= 6 &&
        input.brief.sourceReferences.length >= 2,
      detail: "Expected a one-session proof shape with 3-6 steps and 2+ source references.",
    },
    {
      key: "quality_gate",
      passed: input.brief.quality.gateDecision === "pass",
      detail: "Expected the benchmark brief to pass the quality gate.",
    },
  ];

  const passedCount = checks.filter((check) => check.passed).length;
  const score = Math.round((passedCount / checks.length) * 100);
  const criticalKeys = new Set([
    "family_match",
    "launch_domain_match",
    "use_case_anchor",
    "proof_shape",
    "quality_gate",
  ]);
  const passed =
    score >= 75 &&
    checks
      .filter((check) => criticalKeys.has(check.key))
      .every((check) => check.passed);

  return {
    caseId: input.benchmarkCase.id,
    caseLabel: input.benchmarkCase.label,
    passed,
    score,
    checks,
    notes: input.benchmarkCase.notes,
  };
}

