import type { LearningPath } from "@/lib/types";
import type { FluencyLevel, MissionFamily, ProfessionalFunction } from "@/lib/missions/types/common";
import { MISSION_ROLLOUT_CONFIG } from "@/lib/missions/config/rollout";
import {
  getPrimaryMissionFamilyForLane,
  isMissionFamilySupportedForLane,
} from "@/lib/missions/config/familyCoverage";
import { findTopicMatch } from "@/lib/topics/taxonomy";
import { buildStableKey } from "@/lib/missions/keys/stableKey";
import { getLatestPassingMissionBriefForStableKey } from "@/lib/missions/services/missionCacheService";
import { projectMissionBriefToHiddenLearningPath } from "@/lib/missions/services/legacyPathProjector";

const MESSAGING_INTENT_PATTERNS = [
  /\bmessage matrix\b/i,
  /\bmessaging\b/i,
  /\bpositioning\b/i,
  /\btagline\b/i,
  /\bcopy\b/i,
] as const;

export interface ControlLanePathResolverInput {
  query: string;
  userFunction?: ProfessionalFunction;
  userFluency?: FluencyLevel;
}

export interface ControlLaneSeamDiagnostics {
  flagState: {
    enablePathGeneratorSwitch: boolean;
    enableShadowProjection: boolean;
  };
  resolvedTopicSlug: string | null;
  resolvedFamily: MissionFamily | null;
  projectionBranchMatched: boolean;
  projectionAction: "created" | "reused" | null;
  fallbackReason: string | null;
  stableKey: string | null;
}

export interface ControlLanePathResolverResult {
  learningPath: LearningPath | null;
  diagnostics: ControlLaneSeamDiagnostics;
}

function buildInitialDiagnostics(): ControlLaneSeamDiagnostics {
  return {
    flagState: {
      enablePathGeneratorSwitch: MISSION_ROLLOUT_CONFIG.enablePathGeneratorSwitch,
      enableShadowProjection: MISSION_ROLLOUT_CONFIG.enableShadowProjection,
    },
    resolvedTopicSlug: null,
    resolvedFamily: null,
    projectionBranchMatched: false,
    projectionAction: null,
    fallbackReason: null,
    stableKey: null,
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Resolve an exact allowlisted topic phrase before broader taxonomy matching. */
export function resolveAllowlistedTopicSlug(query: string): string | null {
  const normalized = query.trim().toLowerCase();
  const candidates = [...MISSION_ROLLOUT_CONFIG.allowlistedTopics]
    .map((topicSlug) => ({
      topicSlug,
      phrase: topicSlug.replace(/-/g, " "),
    }))
    .sort((left, right) => right.phrase.length - left.phrase.length);

  for (const candidate of candidates) {
    const pattern = new RegExp(`(?:^|\\b)${escapeRegExp(candidate.phrase)}(?:$|\\b)`, "i");
    if (pattern.test(normalized)) {
      return candidate.topicSlug;
    }
  }

  return null;
}

/** Resolve the conservative control-lane family from the request query. */
export function resolveControlLaneFamily(query: string): MissionFamily {
  const normalized = query.trim().toLowerCase();
  const hasMessagingIntent = MESSAGING_INTENT_PATTERNS.some((pattern) =>
    pattern.test(normalized),
  );

  return hasMessagingIntent
    ? "messaging-translation"
    : "research-synthesis";
}

/** Attempt the narrow control-lane seam for the allowlisted proven topic lanes only. */
export async function maybeResolveControlLanePath(
  input: ControlLanePathResolverInput,
): Promise<ControlLanePathResolverResult> {
  const diagnostics = buildInitialDiagnostics();

  if (!MISSION_ROLLOUT_CONFIG.enablePathGeneratorSwitch) {
    diagnostics.fallbackReason = "path_generator_switch_disabled";
    return { learningPath: null, diagnostics };
  }

  if (!MISSION_ROLLOUT_CONFIG.enableShadowProjection) {
    diagnostics.fallbackReason = "shadow_projection_disabled";
    return { learningPath: null, diagnostics };
  }

  if (!input.userFunction) {
    diagnostics.fallbackReason = "missing_user_function";
    return { learningPath: null, diagnostics };
  }

  if (!input.userFluency) {
    diagnostics.fallbackReason = "missing_user_fluency";
    return { learningPath: null, diagnostics };
  }

  if (
    !MISSION_ROLLOUT_CONFIG.allowlistedFunctions.includes(input.userFunction)
  ) {
    diagnostics.fallbackReason = "function_not_allowlisted";
    return { learningPath: null, diagnostics };
  }

  if (
    !MISSION_ROLLOUT_CONFIG.allowlistedFluencies.includes(input.userFluency)
  ) {
    diagnostics.fallbackReason = "fluency_not_allowlisted";
    return { learningPath: null, diagnostics };
  }

  const allowlistedTopicSlug = resolveAllowlistedTopicSlug(input.query);
  const topic = allowlistedTopicSlug
    ? { slug: allowlistedTopicSlug }
    : await findTopicMatch(input.query);
  diagnostics.resolvedTopicSlug = topic?.slug ?? null;

  if (!topic) {
    diagnostics.fallbackReason = "topic_not_resolved";
    return { learningPath: null, diagnostics };
  }

  if (!MISSION_ROLLOUT_CONFIG.allowlistedTopics.includes(topic.slug)) {
    diagnostics.fallbackReason = "topic_not_allowlisted";
    return { learningPath: null, diagnostics };
  }

  const requestedFamily = resolveControlLaneFamily(input.query);
  const primaryFamily = getPrimaryMissionFamilyForLane({
    topicSlug: topic.slug,
    professionalFunction: input.userFunction,
    fluencyLevel: input.userFluency,
  });
  const family =
    requestedFamily === "messaging-translation"
      ? requestedFamily
      : (primaryFamily ?? requestedFamily);
  diagnostics.resolvedFamily = family;

  if (!MISSION_ROLLOUT_CONFIG.allowlistedFamilies.includes(family)) {
    diagnostics.fallbackReason = "family_not_allowlisted";
    return { learningPath: null, diagnostics };
  }

  if (
    !isMissionFamilySupportedForLane(
      {
        topicSlug: topic.slug,
        professionalFunction: input.userFunction,
        fluencyLevel: input.userFluency,
      },
      family,
    )
  ) {
    diagnostics.fallbackReason = "family_coverage_unsupported";
    return { learningPath: null, diagnostics };
  }

  const stableKey = buildStableKey({
    topicSlug: topic.slug,
    professionalFunction: input.userFunction,
    fluencyLevel: input.userFluency,
    missionFamily: family,
  });
  diagnostics.stableKey = stableKey;

  const brief = await getLatestPassingMissionBriefForStableKey(stableKey);
  if (!brief) {
    diagnostics.fallbackReason = "no_passing_brief_for_stable_key";
    return { learningPath: null, diagnostics };
  }

  try {
    const projection = await projectMissionBriefToHiddenLearningPath(brief);
    diagnostics.projectionBranchMatched = true;
    diagnostics.projectionAction = projection.created ? "created" : "reused";

    return {
      learningPath: projection.learningPath,
      diagnostics,
    };
  } catch (error) {
    diagnostics.fallbackReason =
      error instanceof Error ? `projection_error:${error.message}` : "projection_error";

    return {
      learningPath: null,
      diagnostics,
    };
  }
}

export const __testing = {
  MESSAGING_INTENT_PATTERNS,
  resolveControlLaneFamily,
  resolveAllowlistedTopicSlug,
};
