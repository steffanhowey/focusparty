import { buildAndPersistPrototypeReviewReport } from "@/lib/missions/prototype/buildPrototypeReviewReport";
import {
  getBenchmarkCasesForFamilyScope,
  MISSION_BENCHMARK_CASES,
  type MissionBenchmarkCase,
} from "@/lib/missions/prototype/benchmarkSet";
import {
  buildDefaultMissionPrototypeConfig,
  type MissionPrototypeConfig,
  validateMissionPrototypeConfig,
} from "@/lib/missions/prototype/prototypeConfig";
import { resolveTopicCandidates } from "@/lib/missions/services/topicCandidateResolver";
import type {
  TopicCandidate,
} from "@/lib/missions/types/sourcePacket";
import { runPrototypeMissionFlow } from "@/lib/missions/orchestrators/runPrototypeMissionFlow";

export interface PrototypeSliceResult {
  prototypeKey: string;
  sourcePacketIds: string[];
  editorialDecisionIds: string[];
  missionBriefIds: string[];
  runIds: string[];
  reviewReportId: string;
}

/** Execute the full Phase 1 benchmark + prototype slice and stop at the review report gate. */
export async function runPrototypeSlice(
  config: MissionPrototypeConfig = buildDefaultMissionPrototypeConfig(),
): Promise<PrototypeSliceResult> {
  validateMissionPrototypeConfig(config);

  const benchmarkCases = selectBenchmarkCases(config);
  const benchmarkCandidates = await resolveBenchmarkCandidates(benchmarkCases);

  const sourcePacketIds = new Set<string>();
  const editorialDecisionIds = new Set<string>();
  const missionBriefIds = new Set<string>();
  const runIds = new Set<string>();

  for (const benchmarkCase of benchmarkCases) {
    const candidate = benchmarkCandidates.get(benchmarkCase.topicSlug);
    if (!candidate) {
      throw new Error(
        `Benchmark topic "${benchmarkCase.topicSlug}" could not be resolved from the taxonomy.`,
      );
    }

    const result = await runPrototypeMissionFlow({
      prototypeKey: config.prototypeKey,
      evaluationMode: "benchmark",
      topicCandidate: candidate,
      professionalFunction: config.professionalFunction,
      fluencyLevel: config.fluencyLevel,
      familyScope: [benchmarkCase.missionFamily],
      benchmarkVersion: config.benchmarkVersion,
      benchmarkCase,
    });
    collectArtifacts(result, sourcePacketIds, editorialDecisionIds, missionBriefIds, runIds);
  }

  const prototypeCandidates = await selectPrototypeCandidates(config, benchmarkCases);
  if (prototypeCandidates.length === 0) {
    throw new Error("Prototype slice did not resolve any eligible live topics.");
  }

  for (const candidate of prototypeCandidates) {
    const result = await runPrototypeMissionFlow({
      prototypeKey: config.prototypeKey,
      evaluationMode: "prototype",
      topicCandidate: candidate,
      professionalFunction: config.professionalFunction,
      fluencyLevel: config.fluencyLevel,
      familyScope: config.familyScope,
      benchmarkVersion: config.benchmarkVersion,
      prototypeCalibrationTopicSlugs: config.prototypeTopicSlugs,
    });
    collectArtifacts(result, sourcePacketIds, editorialDecisionIds, missionBriefIds, runIds);
  }

  const reviewReport = await buildAndPersistPrototypeReviewReport({
    prototypeKey: config.prototypeKey,
    audienceFunction: config.professionalFunction,
    fluencyLevel: config.fluencyLevel,
    topicSlugs: prototypeCandidates.map((candidate) => candidate.topicSlug),
    familyScope: config.familyScope,
    benchmarkVersion: config.benchmarkVersion,
  });

  return {
    prototypeKey: config.prototypeKey,
    sourcePacketIds: [...sourcePacketIds],
    editorialDecisionIds: [...editorialDecisionIds],
    missionBriefIds: [...missionBriefIds],
    runIds: [...runIds],
    reviewReportId: reviewReport.id,
  };
}

function selectBenchmarkCases(config: MissionPrototypeConfig): MissionBenchmarkCase[] {
  const allowedIds = new Set(config.benchmarkCaseIds);
  const cases = getBenchmarkCasesForFamilyScope(config.familyScope).filter((item) =>
    allowedIds.has(item.id),
  );

  if (cases.length === 0) {
    throw new Error("Prototype config did not select any benchmark cases.");
  }

  return cases;
}

async function resolveBenchmarkCandidates(
  benchmarkCases: MissionBenchmarkCase[],
): Promise<Map<string, TopicCandidate>> {
  const topicSlugs = [...new Set(benchmarkCases.map((item) => item.topicSlug))];
  const candidates = await resolveTopicCandidates({ topicSlugs });
  const missing = topicSlugs.filter(
    (topicSlug) => !candidates.some((candidate) => candidate.topicSlug === topicSlug),
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing benchmark topics in canonical taxonomy: ${missing.join(", ")}`,
    );
  }

  return new Map(candidates.map((candidate) => [candidate.topicSlug, candidate]));
}

async function selectPrototypeCandidates(
  config: MissionPrototypeConfig,
  benchmarkCases: MissionBenchmarkCase[],
): Promise<TopicCandidate[]> {
  if (config.prototypeTopicSlugs.length > 0) {
    const candidates = await resolveTopicCandidates({
      topicSlugs: config.prototypeTopicSlugs,
    });
    const missing = config.prototypeTopicSlugs.filter(
      (topicSlug) => !candidates.some((candidate) => candidate.topicSlug === topicSlug),
    );

    if (missing.length > 0) {
      throw new Error(
        `Manual prototype topics could not be resolved: ${missing.join(", ")}`,
      );
    }

    return candidates.slice(0, config.prototypeTopicLimit);
  }

  const excludedBenchmarkTopics = new Set(benchmarkCases.map((item) => item.topicSlug));
  const hotCandidates = await resolveTopicCandidates({
    limit: Math.max(config.prototypeTopicLimit * 2, 6),
    minHeatScore: config.prototypeMinHeatScore,
  });

  const eligible = hotCandidates
    .filter((candidate) => candidate.topicCategory !== "role")
    .filter((candidate) => !excludedBenchmarkTopics.has(candidate.topicSlug))
    .sort(
      (left, right) =>
        (right.heatScoreSnapshot ?? 0) - (left.heatScoreSnapshot ?? 0),
    );

  const selected: TopicCandidate[] = [];
  const seenClusters = new Set<string>();

  for (const candidate of eligible) {
    const clusterKey = candidate.clusterId ?? `topic:${candidate.topicSlug}`;
    if (seenClusters.has(clusterKey)) {
      continue;
    }

    selected.push(candidate);
    seenClusters.add(clusterKey);

    if (selected.length >= config.prototypeTopicLimit) {
      break;
    }
  }

  if (selected.length < config.prototypeTopicLimit) {
    for (const candidate of eligible) {
      if (selected.some((item) => item.topicSlug === candidate.topicSlug)) {
        continue;
      }

      selected.push(candidate);
      if (selected.length >= config.prototypeTopicLimit) {
        break;
      }
    }
  }

  return selected.slice(0, config.prototypeTopicLimit);
}

function collectArtifacts(
  result: Awaited<ReturnType<typeof runPrototypeMissionFlow>>,
  sourcePacketIds: Set<string>,
  editorialDecisionIds: Set<string>,
  missionBriefIds: Set<string>,
  runIds: Set<string>,
): void {
  runIds.add(result.run.id);
  if (result.sourcePacket?.packetId) {
    sourcePacketIds.add(result.sourcePacket.packetId);
  }
  if (result.editorialDecision?.id) {
    editorialDecisionIds.add(result.editorialDecision.id);
  }
  if (result.missionBrief?.missionId) {
    missionBriefIds.add(result.missionBrief.missionId);
  }
}

export { MISSION_BENCHMARK_CASES };
