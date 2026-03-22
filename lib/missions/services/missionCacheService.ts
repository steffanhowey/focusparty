import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { MissionBriefSchema } from "@/lib/missions/schema/missionBriefSchema";
import type { MissionBriefV2 } from "@/lib/missions/types/missionBriefV2";
import {
  getMissionPathProjectionByMissionBriefId,
  type MissionPathProjection,
} from "@/lib/missions/repositories/missionPathProjectionRepo";

interface LearningPathShadowRow {
  id: string;
  source_mission_brief_id: string | null;
  canonical_stable_key: string | null;
  is_cached: boolean | null;
  generation_engine: string | null;
}

export interface ShadowProjectionCandidate {
  brief: MissionBriefV2;
  existingProjection: MissionPathProjection | null;
  existingLearningPathId: string | null;
}

export interface LatestPassingBriefFilters {
  topicSlug: string;
  professionalFunction?: MissionBriefV2["identity"]["professionalFunction"];
  fluencyLevel?: MissionBriefV2["identity"]["fluencyLevel"];
  allowedFamilies?: MissionBriefV2["identity"]["missionFamily"][];
}

/** Fetch the latest passing canonical brief for one exact stable key. */
export async function getLatestPassingMissionBriefForStableKey(
  stableKey: string,
): Promise<MissionBriefV2 | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("fp_mission_briefs")
    .select("brief")
    .eq("stable_key", stableKey)
    .eq("gate_decision", "pass")
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `[missions/missionCacheService] stable key lookup failed: ${error.message}`,
    );
  }

  return data ? MissionBriefSchema.parse(data.brief) : null;
}

/** List the latest passing canonical brief per stable key for a narrow shadow scope. */
export async function listLatestPassingMissionBriefsByStableKey(
  filters: LatestPassingBriefFilters,
): Promise<MissionBriefV2[]> {
  const admin = createAdminClient();
  let query = admin
    .from("fp_mission_briefs")
    .select("brief, stable_key, generated_at")
    .eq("topic_slug", filters.topicSlug)
    .eq("gate_decision", "pass")
    .order("generated_at", { ascending: false });

  if (filters.professionalFunction) {
    query = query.eq("professional_function", filters.professionalFunction);
  }

  if (filters.fluencyLevel) {
    query = query.eq("fluency_level", filters.fluencyLevel);
  }

  if (filters.allowedFamilies && filters.allowedFamilies.length > 0) {
    query = query.in("mission_family", filters.allowedFamilies);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(
      `[missions/missionCacheService] latest passing lookup failed: ${error.message}`,
    );
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const seenStableKeys = new Set<string>();
  const briefs: MissionBriefV2[] = [];

  for (const row of rows) {
    const stableKey = row.stable_key as string;
    if (!stableKey || seenStableKeys.has(stableKey)) {
      continue;
    }

    const brief = MissionBriefSchema.parse(row.brief);
    briefs.push(brief);
    seenStableKeys.add(stableKey);
  }

  return briefs;
}

/** Find any existing hidden learning path row already linked to this canonical brief. */
export async function getExistingLearningPathForMissionBrief(
  missionBriefId: string,
): Promise<LearningPathShadowRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("fp_learning_paths")
    .select("id, source_mission_brief_id, canonical_stable_key, is_cached, generation_engine")
    .eq("source_mission_brief_id", missionBriefId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `[missions/missionCacheService] existing path lookup failed: ${error.message}`,
    );
  }

  return (data as LearningPathShadowRow | null) ?? null;
}

/** Resolve duplicate-safe shadow candidates for a given narrow topic lane. */
export async function resolveShadowProjectionCandidates(
  filters: LatestPassingBriefFilters,
): Promise<ShadowProjectionCandidate[]> {
  const briefs = await listLatestPassingMissionBriefsByStableKey(filters);
  const candidates: ShadowProjectionCandidate[] = [];

  for (const brief of briefs) {
    const [existingProjection, existingLearningPath] = await Promise.all([
      getMissionPathProjectionByMissionBriefId(brief.missionId),
      getExistingLearningPathForMissionBrief(brief.missionId),
    ]);

    candidates.push({
      brief,
      existingProjection,
      existingLearningPathId: existingLearningPath?.id ?? null,
    });
  }

  return candidates;
}
