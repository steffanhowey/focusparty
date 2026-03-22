import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { MISSION_ROLLOUT_CONFIG } from "@/lib/missions/config/rollout";
import { getEligibleMissionFamiliesForLane } from "@/lib/missions/config/familyCoverage";
import type {
  FluencyLevel,
  MissionFamily,
  ProfessionalFunction,
} from "@/lib/missions/types/common";
import { projectMissionBriefToHiddenLearningPath } from "@/lib/missions/services/legacyPathProjector";
import { resolveShadowProjectionCandidates } from "@/lib/missions/services/missionCacheService";

interface ProjectedLearningPathRow {
  id: string;
  is_cached: boolean | null;
  is_discoverable: boolean | null;
  view_count: number | null;
}

const MIN_VISIBLE_QUERY_SEARCH_VIEW_COUNT = 2;

export interface PromoteVisibleControlLaneInput {
  topicSlug: string;
  professionalFunction: ProfessionalFunction;
  fluencyLevel: FluencyLevel;
  allowedFamilies: MissionFamily[];
}

export interface VisibleControlLaneProjection {
  stableKey: string;
  missionBriefId: string;
  learningPathId: string;
  projectionAction: "created" | "reused";
  visibilityAction: "promoted" | "already_visible";
  hiddenPathIds: string[];
}

export interface PromoteVisibleControlLaneResult {
  promoted: VisibleControlLaneProjection[];
  promotedCount: number;
  alreadyVisibleCount: number;
  hiddenCount: number;
}

function assertVisibleProjectionAllowed(
  input: PromoteVisibleControlLaneInput,
): void {
  if (!MISSION_ROLLOUT_CONFIG.enableVisibleProjection) {
    throw new Error(
      "[missions/controlLaneVisibilityService] visible projection is disabled",
    );
  }

  if (!MISSION_ROLLOUT_CONFIG.allowlistedTopics.includes(input.topicSlug)) {
    throw new Error(
      `[missions/controlLaneVisibilityService] topic "${input.topicSlug}" is not allowlisted for visible projection`,
    );
  }

  if (
    !MISSION_ROLLOUT_CONFIG.allowlistedFunctions.includes(
      input.professionalFunction,
    )
  ) {
    throw new Error(
      `[missions/controlLaneVisibilityService] function "${input.professionalFunction}" is not allowlisted for visible projection`,
    );
  }

  if (
    !MISSION_ROLLOUT_CONFIG.allowlistedFluencies.includes(input.fluencyLevel)
  ) {
    throw new Error(
      `[missions/controlLaneVisibilityService] fluency "${input.fluencyLevel}" is not allowlisted for visible projection`,
    );
  }

  const disallowedFamilies = input.allowedFamilies.filter(
    (family) => !MISSION_ROLLOUT_CONFIG.allowlistedFamilies.includes(family),
  );

  if (disallowedFamilies.length > 0) {
    throw new Error(
      `[missions/controlLaneVisibilityService] family scope contains non-allowlisted values: ${disallowedFamilies.join(", ")}`,
    );
  }
}

async function listProjectedLearningPathsForStableKey(
  stableKey: string,
): Promise<ProjectedLearningPathRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("fp_learning_paths")
    .select("id, is_cached, is_discoverable, view_count")
    .eq("generation_engine", "mission_projection")
    .eq("canonical_stable_key", stableKey)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(
      `[missions/controlLaneVisibilityService] stable-key path lookup failed: ${error.message}`,
    );
  }

  return ((data as ProjectedLearningPathRow[] | null) ?? []);
}

async function setPathVisibility(
  pathId: string,
  isCached: boolean,
  viewCountFloor?: number,
): Promise<void> {
  const admin = createAdminClient();
  const payload: Record<string, unknown> = {
    is_cached: isCached,
    is_discoverable: false,
  };

  if (typeof viewCountFloor === "number") {
    payload.view_count = viewCountFloor;
  }

  const { error } = await admin
    .from("fp_learning_paths")
    .update(payload)
    .eq("id", pathId);

  if (error) {
    throw new Error(
      `[missions/controlLaneVisibilityService] path visibility update failed: ${error.message}`,
    );
  }
}

/** Promote only the latest projected path per stable key for the control lane. */
export async function promoteVisibleControlLanePaths(
  input: PromoteVisibleControlLaneInput,
): Promise<PromoteVisibleControlLaneResult> {
  assertVisibleProjectionAllowed(input);
  const eligibleFamilies = getEligibleMissionFamiliesForLane({
    topicSlug: input.topicSlug,
    professionalFunction: input.professionalFunction,
    fluencyLevel: input.fluencyLevel,
    candidateFamilies: input.allowedFamilies,
  });

  if (eligibleFamilies.length === 0) {
    throw new Error(
      `[missions/controlLaneVisibilityService] no eligible families remain for topic "${input.topicSlug}" in this lane`,
    );
  }

  const candidates = await resolveShadowProjectionCandidates({
    topicSlug: input.topicSlug,
    professionalFunction: input.professionalFunction,
    fluencyLevel: input.fluencyLevel,
    allowedFamilies: eligibleFamilies,
  });

  const promoted: VisibleControlLaneProjection[] = [];

  for (const candidate of candidates) {
    const projection = await projectMissionBriefToHiddenLearningPath(
      candidate.brief,
    );
    const projectedRows = await listProjectedLearningPathsForStableKey(
      candidate.brief.stableKey,
    );
    const targetPathId = projection.learningPath.id;
    const targetRow = projectedRows.find((row) => row.id === targetPathId);
    const hiddenPathIds = projectedRows
      .filter((row) => row.id !== targetPathId && row.is_cached !== false)
      .map((row) => row.id);

    for (const hiddenPathId of hiddenPathIds) {
      await setPathVisibility(hiddenPathId, false);
    }

    const visibilityAction =
      targetRow?.is_cached === true && targetRow?.is_discoverable === false
        ? "already_visible"
        : "promoted";

    if (
      targetRow?.is_cached !== true ||
      targetRow?.is_discoverable !== false ||
      (targetRow?.view_count ?? 0) < MIN_VISIBLE_QUERY_SEARCH_VIEW_COUNT
    ) {
      await setPathVisibility(
        targetPathId,
        true,
        Math.max(targetRow?.view_count ?? 0, MIN_VISIBLE_QUERY_SEARCH_VIEW_COUNT),
      );
    }

    promoted.push({
      stableKey: candidate.brief.stableKey,
      missionBriefId: candidate.brief.missionId,
      learningPathId: targetPathId,
      projectionAction: projection.created ? "created" : "reused",
      visibilityAction,
      hiddenPathIds,
    });
  }

  const promotedCount = promoted.filter(
    (row) => row.visibilityAction === "promoted",
  ).length;
  const alreadyVisibleCount = promoted.length - promotedCount;
  const hiddenCount = promoted.reduce(
    (sum, row) => sum + row.hiddenPathIds.length,
    0,
  );

  return {
    promoted,
    promotedCount,
    alreadyVisibleCount,
    hiddenCount,
  };
}

export const __testing = {
  assertVisibleProjectionAllowed,
  MIN_VISIBLE_QUERY_SEARCH_VIEW_COUNT,
};
