import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { MissionBriefSchema } from "@/lib/missions/schema/missionBriefSchema";
import type { MissionBriefV2 } from "@/lib/missions/types/missionBriefV2";

function mapRowToMissionBrief(row: Record<string, unknown>): MissionBriefV2 {
  return MissionBriefSchema.parse(row.brief);
}

function toRow(brief: MissionBriefV2): Record<string, unknown> {
  return {
    id: brief.missionId,
    stable_key: brief.stableKey,
    source_packet_id: brief.topic.sourcePacketId,
    topic_slug: brief.topic.topicSlug,
    topic_name: brief.topic.topicName,
    professional_function: brief.identity.professionalFunction,
    fluency_level: brief.identity.fluencyLevel,
    mission_family: brief.identity.missionFamily,
    artifact_type: brief.artifact.artifactType,
    launch_domain: brief.identity.launchDomain,
    best_room_key: brief.bestRoom.roomKey,
    schema_version: brief.schemaVersion,
    brief_version: brief.lifecycleCore.briefVersion,
    status: brief.status,
    cache_fingerprint: brief.lifecyclePlus?.cacheTags?.find((tag) => tag.startsWith("cache:"))?.slice(6),
    source_packet_hash: brief.topic.sourcePacketHash,
    source_packet_readiness_state: brief.topic.sourcePacketReadinessState,
    family_template_version: brief.lifecyclePlus?.familyTemplateVersion ?? "prototype_v1",
    benchmark_version: brief.lifecyclePlus?.benchmarkVersion ?? "benchmark_v1",
    title: brief.identity.title,
    short_title: brief.identity.shortTitle,
    summary: brief.identity.summary,
    why_this_matters_now: brief.framing.whyThisMattersNow,
    why_this_matters_for_marketing: brief.framing.whyThisMattersForMarketing,
    marketer_use_case: brief.framing.marketerUseCase,
    output_description: brief.artifact.outputDescription,
    audience: brief.artifact.audience,
    format: brief.artifact.format,
    timebox_minutes: brief.execution.timeboxMinutes,
    hard_cap_minutes: brief.execution.hardCapMinutes,
    quality_score: brief.quality.score,
    gate_decision: brief.quality.gateDecision,
    reject_reasons: brief.quality.rejectReasons,
    brief: brief as unknown,
    generated_at: brief.lifecycleCore.generatedAt,
    expires_at: brief.lifecycleCore.expiresAt,
    supersedes_mission_brief_id: brief.lifecyclePlus?.supersedesMissionId ?? null,
  };
}

/** Persist a canonical mission brief. */
export async function createMissionBrief(
  brief: MissionBriefV2,
  editorialDecisionId: string,
  cacheFingerprint: string,
): Promise<MissionBriefV2> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("fp_mission_briefs")
    .insert({
      ...toRow(brief),
      editorial_decision_id: editorialDecisionId,
      cache_fingerprint: cacheFingerprint,
    })
    .select("brief")
    .single();

  if (error) {
    throw new Error(`[missions/missionBriefRepo] create failed: ${error.message}`);
  }

  return mapRowToMissionBrief(data as Record<string, unknown>);
}

/** Fetch the active brief for a stable key, if one exists. */
export async function getActiveMissionBriefByStableKey(
  stableKey: string,
): Promise<MissionBriefV2 | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("fp_mission_briefs")
    .select("brief")
    .eq("stable_key", stableKey)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new Error(
      `[missions/missionBriefRepo] active lookup failed: ${error.message}`,
    );
  }

  return data ? mapRowToMissionBrief(data as Record<string, unknown>) : null;
}

/** List active mission briefs for an editorial key prefix. */
export async function listActiveMissionBriefsByEditorialKey(
  editorialKey: string,
): Promise<MissionBriefV2[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("fp_mission_briefs")
    .select("brief")
    .eq("status", "active")
    .like("stable_key", `${editorialKey}:%`);

  if (error) {
    throw new Error(
      `[missions/missionBriefRepo] editorial prefix lookup failed: ${error.message}`,
    );
  }

  return (data ?? []).map((row) => mapRowToMissionBrief(row as Record<string, unknown>));
}

/** Fetch mission briefs by id list. */
export async function listMissionBriefsByIds(ids: string[]): Promise<MissionBriefV2[]> {
  if (ids.length === 0) return [];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("fp_mission_briefs")
    .select("brief")
    .in("id", ids);

  if (error) {
    throw new Error(`[missions/missionBriefRepo] id lookup failed: ${error.message}`);
  }

  return (data ?? []).map((row) => mapRowToMissionBrief(row as Record<string, unknown>));
}

/** Get the next brief version number for a stable key. */
export async function getNextMissionBriefVersion(
  stableKey: string,
): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("fp_mission_briefs")
    .select("brief_version")
    .eq("stable_key", stableKey)
    .order("brief_version", { ascending: false })
    .limit(1)
    .maybeSingle<{ brief_version: number }>();

  if (error) {
    throw new Error(
      `[missions/missionBriefRepo] version lookup failed: ${error.message}`,
    );
  }

  return (data?.brief_version ?? 0) + 1;
}

/** Mark any currently active brief rows for a stable key as superseded. */
export async function supersedeActiveMissionBriefsByStableKey(
  stableKey: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("fp_mission_briefs")
    .update({
      status: "superseded",
      updated_at: new Date().toISOString(),
    })
    .eq("stable_key", stableKey)
    .eq("status", "active");

  if (error) {
    throw new Error(
      `[missions/missionBriefRepo] supersede active failed: ${error.message}`,
    );
  }
}
