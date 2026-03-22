import { createClient as createAdminClient } from "@/lib/supabase/admin";

export interface MissionPathProjection {
  id: string;
  missionBriefId: string;
  learningPathId: string;
  projectorVersion: string;
  projectionStatus: "active" | "superseded" | "failed";
  projectedAt: string;
  supersededAt: string | null;
  createdAt: string;
}

function mapRow(row: Record<string, unknown>): MissionPathProjection {
  return {
    id: row.id as string,
    missionBriefId: row.mission_brief_id as string,
    learningPathId: row.learning_path_id as string,
    projectorVersion: row.projector_version as string,
    projectionStatus: row.projection_status as MissionPathProjection["projectionStatus"],
    projectedAt: row.projected_at as string,
    supersededAt: (row.superseded_at as string) ?? null,
    createdAt: row.created_at as string,
  };
}

/** Create a mission-brief-to-learning-path projection row. */
export async function createMissionPathProjection(
  projection: Omit<MissionPathProjection, "projectedAt" | "createdAt"> & {
    projectedAt?: string;
    createdAt?: string;
  },
): Promise<MissionPathProjection> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("fp_mission_path_projections")
    .upsert({
      id: projection.id,
      mission_brief_id: projection.missionBriefId,
      learning_path_id: projection.learningPathId,
      projector_version: projection.projectorVersion,
      projection_status: projection.projectionStatus,
      projected_at: projection.projectedAt ?? new Date().toISOString(),
      superseded_at: projection.supersededAt,
      created_at: projection.createdAt ?? new Date().toISOString(),
    }, { onConflict: "mission_brief_id" })
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `[missions/missionPathProjectionRepo] create failed: ${error.message}`,
    );
  }

  return mapRow(data as Record<string, unknown>);
}

/** Fetch a projection by mission brief id. */
export async function getMissionPathProjectionByMissionBriefId(
  missionBriefId: string,
): Promise<MissionPathProjection | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("fp_mission_path_projections")
    .select("*")
    .eq("mission_brief_id", missionBriefId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `[missions/missionPathProjectionRepo] brief lookup failed: ${error.message}`,
    );
  }

  return data ? mapRow(data as Record<string, unknown>) : null;
}

/** Fetch a projection by learning path id. */
export async function getMissionPathProjectionByLearningPathId(
  learningPathId: string,
): Promise<MissionPathProjection | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("fp_mission_path_projections")
    .select("*")
    .eq("learning_path_id", learningPathId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `[missions/missionPathProjectionRepo] path lookup failed: ${error.message}`,
    );
  }

  return data ? mapRow(data as Record<string, unknown>) : null;
}

/** Mark a projection row as superseded. */
export async function supersedeMissionPathProjection(
  projectionId: string,
): Promise<MissionPathProjection> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("fp_mission_path_projections")
    .update({
      projection_status: "superseded",
      superseded_at: new Date().toISOString(),
    })
    .eq("id", projectionId)
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `[missions/missionPathProjectionRepo] supersede failed: ${error.message}`,
    );
  }

  return mapRow(data as Record<string, unknown>);
}
