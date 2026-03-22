import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { GenerationRunSchema } from "@/lib/missions/schema/generationRunSchema";
import type { MissionGenerationRun } from "@/lib/missions/types/generationRun";

function mapRowToGenerationRun(row: Record<string, unknown>): MissionGenerationRun {
  return GenerationRunSchema.parse({
    id: row.id,
    evaluationMode: row.evaluation_mode,
    topicSlug: row.topic_slug,
    sourcePacketId: row.source_packet_id ?? null,
    editorialDecisionId: row.editorial_decision_id ?? null,
    missionBriefId: row.mission_brief_id ?? null,
    editorialKey: row.editorial_key,
    stableKey: (row.stable_key as string) ?? null,
    professionalFunction: row.professional_function,
    fluencyLevel: row.fluency_level,
    currentStage: row.current_stage,
    status: row.status,
    inputConfig: (row.input_config as Record<string, unknown>) ?? {},
    stageResults: (row.stage_results as Record<string, unknown>) ?? {},
    outputSummary: (row.output_summary as Record<string, unknown>) ?? {},
    rejectReasons: (row.reject_reasons as string[]) ?? [],
    error: (row.error as Record<string, unknown>) ?? null,
    startedAt: row.started_at,
    completedAt: (row.completed_at as string) ?? null,
  });
}

function toRow(run: MissionGenerationRun): Record<string, unknown> {
  return {
    id: run.id,
    evaluation_mode: run.evaluationMode,
    topic_slug: run.topicSlug,
    source_packet_id: run.sourcePacketId,
    editorial_decision_id: run.editorialDecisionId,
    mission_brief_id: run.missionBriefId,
    editorial_key: run.editorialKey,
    stable_key: run.stableKey,
    professional_function: run.professionalFunction,
    fluency_level: run.fluencyLevel,
    current_stage: run.currentStage,
    status: run.status,
    input_config: run.inputConfig as unknown,
    stage_results: run.stageResults as unknown,
    output_summary: run.outputSummary as unknown,
    reject_reasons: run.rejectReasons,
    error: run.error as unknown,
    started_at: run.startedAt,
    completed_at: run.completedAt,
  };
}

/** Persist a new mission generation run row. */
export async function createMissionGenerationRun(
  run: MissionGenerationRun,
): Promise<MissionGenerationRun> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("fp_mission_generation_runs")
    .insert(toRow(run))
    .select("*")
    .single();

  if (error) {
    throw new Error(`[missions/generationRunRepo] create failed: ${error.message}`);
  }

  return mapRowToGenerationRun(data as Record<string, unknown>);
}

/** Update a mission generation run with a partial patch. */
export async function updateMissionGenerationRun(
  runId: string,
  patch: Partial<MissionGenerationRun>,
): Promise<MissionGenerationRun> {
  const admin = createAdminClient();
  const updateData: Record<string, unknown> = {};

  if (patch.evaluationMode) updateData.evaluation_mode = patch.evaluationMode;
  if (patch.topicSlug) updateData.topic_slug = patch.topicSlug;
  if (patch.sourcePacketId !== undefined) updateData.source_packet_id = patch.sourcePacketId;
  if (patch.editorialDecisionId !== undefined) updateData.editorial_decision_id = patch.editorialDecisionId;
  if (patch.missionBriefId !== undefined) updateData.mission_brief_id = patch.missionBriefId;
  if (patch.editorialKey) updateData.editorial_key = patch.editorialKey;
  if (patch.stableKey !== undefined) updateData.stable_key = patch.stableKey;
  if (patch.professionalFunction) updateData.professional_function = patch.professionalFunction;
  if (patch.fluencyLevel) updateData.fluency_level = patch.fluencyLevel;
  if (patch.currentStage) updateData.current_stage = patch.currentStage;
  if (patch.status) updateData.status = patch.status;
  if (patch.inputConfig) updateData.input_config = patch.inputConfig as unknown;
  if (patch.stageResults) updateData.stage_results = patch.stageResults as unknown;
  if (patch.outputSummary) updateData.output_summary = patch.outputSummary as unknown;
  if (patch.rejectReasons) updateData.reject_reasons = patch.rejectReasons;
  if (patch.error !== undefined) updateData.error = patch.error as unknown;
  if (patch.completedAt !== undefined) updateData.completed_at = patch.completedAt;

  const { data, error } = await admin
    .from("fp_mission_generation_runs")
    .update(updateData)
    .eq("id", runId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`[missions/generationRunRepo] update failed: ${error.message}`);
  }

  return mapRowToGenerationRun(data as Record<string, unknown>);
}

/** List mission generation runs by prototype key stored in input_config. */
export async function listMissionGenerationRunsByPrototypeKey(
  prototypeKey: string,
  evaluationMode?: MissionGenerationRun["evaluationMode"],
): Promise<MissionGenerationRun[]> {
  const admin = createAdminClient();
  let query = admin
    .from("fp_mission_generation_runs")
    .select("*")
    .contains("input_config", { prototype_key: prototypeKey })
    .order("started_at", { ascending: true });

  if (evaluationMode) {
    query = query.eq("evaluation_mode", evaluationMode);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(
      `[missions/generationRunRepo] prototype lookup failed: ${error.message}`,
    );
  }

  return (data ?? []).map((row) => mapRowToGenerationRun(row as Record<string, unknown>));
}
