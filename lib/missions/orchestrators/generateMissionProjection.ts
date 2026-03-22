import { MISSION_ROLLOUT_CONFIG } from "@/lib/missions/config/rollout";
import { getEligibleMissionFamiliesForLane } from "@/lib/missions/config/familyCoverage";
import type {
  FluencyLevel,
  MissionFamily,
  ProfessionalFunction,
} from "@/lib/missions/types/common";
import {
  projectMissionBriefToHiddenLearningPath,
  type MissionShadowProjectionResult,
} from "@/lib/missions/services/legacyPathProjector";
import {
  resolveShadowProjectionCandidates,
  type ShadowProjectionCandidate,
} from "@/lib/missions/services/missionCacheService";

export interface GenerateMissionProjectionInput {
  topicSlug: string;
  professionalFunction: ProfessionalFunction;
  fluencyLevel: FluencyLevel;
  allowedFamilies: MissionFamily[];
}

export interface GeneratedMissionProjection {
  stableKey: string;
  missionBriefId: string;
  learningPathId: string;
  created: boolean;
}

export interface GenerateMissionProjectionResult {
  topicSlug: string;
  projected: GeneratedMissionProjection[];
  reusedCount: number;
  createdCount: number;
}

function assertShadowProjectionAllowed(
  input: GenerateMissionProjectionInput,
): void {
  if (!MISSION_ROLLOUT_CONFIG.enableShadowProjection) {
    throw new Error(
      "[missions/generateMissionProjection] shadow projection is disabled",
    );
  }

  if (!MISSION_ROLLOUT_CONFIG.allowlistedTopics.includes(input.topicSlug)) {
    throw new Error(
      `[missions/generateMissionProjection] topic "${input.topicSlug}" is not allowlisted for shadow projection`,
    );
  }

  if (
    !MISSION_ROLLOUT_CONFIG.allowlistedFunctions.includes(
      input.professionalFunction,
    )
  ) {
    throw new Error(
      `[missions/generateMissionProjection] function "${input.professionalFunction}" is not allowlisted for shadow projection`,
    );
  }

  if (
    !MISSION_ROLLOUT_CONFIG.allowlistedFluencies.includes(input.fluencyLevel)
  ) {
    throw new Error(
      `[missions/generateMissionProjection] fluency "${input.fluencyLevel}" is not allowlisted for shadow projection`,
    );
  }

  const disallowedFamilies = input.allowedFamilies.filter(
    (family) => !MISSION_ROLLOUT_CONFIG.allowlistedFamilies.includes(family),
  );

  if (disallowedFamilies.length > 0) {
    throw new Error(
      `[missions/generateMissionProjection] family scope contains non-allowlisted values: ${disallowedFamilies.join(", ")}`,
    );
  }
}

function toProjectionSummary(
  candidate: ShadowProjectionCandidate,
  result: MissionShadowProjectionResult,
): GeneratedMissionProjection {
  return {
    stableKey: candidate.brief.stableKey,
    missionBriefId: candidate.brief.missionId,
    learningPathId: result.learningPath.id,
    created: result.created,
  };
}

/** Generate hidden compatibility-path projections for the allowlisted control lane only. */
export async function generateMissionProjection(
  input: GenerateMissionProjectionInput,
): Promise<GenerateMissionProjectionResult> {
  assertShadowProjectionAllowed(input);
  const eligibleFamilies = getEligibleMissionFamiliesForLane({
    topicSlug: input.topicSlug,
    professionalFunction: input.professionalFunction,
    fluencyLevel: input.fluencyLevel,
    candidateFamilies: input.allowedFamilies,
  });

  if (eligibleFamilies.length === 0) {
    throw new Error(
      `[missions/generateMissionProjection] no eligible families remain for topic "${input.topicSlug}" in this lane`,
    );
  }

  const candidates = await resolveShadowProjectionCandidates({
    topicSlug: input.topicSlug,
    professionalFunction: input.professionalFunction,
    fluencyLevel: input.fluencyLevel,
    allowedFamilies: eligibleFamilies,
  });

  const projected: GeneratedMissionProjection[] = [];

  for (const candidate of candidates) {
    const result = await projectMissionBriefToHiddenLearningPath(candidate.brief);
    projected.push(toProjectionSummary(candidate, result));
  }

  const createdCount = projected.filter((result) => result.created).length;

  return {
    topicSlug: input.topicSlug,
    projected,
    createdCount,
    reusedCount: projected.length - createdCount,
  };
}

export const __testing = {
  assertShadowProjectionAllowed,
};
