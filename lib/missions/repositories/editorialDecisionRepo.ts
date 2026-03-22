import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { EditorialDecisionSchema } from "@/lib/missions/schema/editorialDecisionSchema";
import type { MissionEditorialDecision } from "@/lib/missions/types/editorialDecision";

function mapRowToEditorialDecision(
  row: Record<string, unknown>,
): MissionEditorialDecision {
  return EditorialDecisionSchema.parse({
    id: row.id,
    sourcePacketId: row.source_packet_id,
    editorialKey: row.editorial_key,
    professionalFunction: row.professional_function,
    fluencyLevel: row.fluency_level,
    decision: row.decision,
    editorialPriority: row.editorial_priority,
    recommendedLaunchDomains: row.recommended_launch_domains ?? [],
    recommendedFamilyScope: row.recommended_family_scope ?? [],
    blockedByMissionBriefId: row.blocked_by_mission_brief_id ?? null,
    supersedeMissionBriefId: row.supersede_mission_brief_id ?? null,
    rationale: row.rationale,
    decisionContext: row.decision_context ?? {},
    decidedAt: row.decided_at,
    expiresAt: row.expires_at ?? null,
  });
}

/** Persist a new editorial decision. */
export async function createMissionEditorialDecision(
  decision: MissionEditorialDecision,
): Promise<MissionEditorialDecision> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("fp_mission_editorial_decisions")
    .insert({
      id: decision.id,
      source_packet_id: decision.sourcePacketId,
      editorial_key: decision.editorialKey,
      professional_function: decision.professionalFunction,
      fluency_level: decision.fluencyLevel,
      decision: decision.decision,
      editorial_priority: decision.editorialPriority,
      recommended_launch_domains: decision.recommendedLaunchDomains,
      recommended_family_scope: decision.recommendedFamilyScope,
      blocked_by_mission_brief_id: decision.blockedByMissionBriefId,
      supersede_mission_brief_id: decision.supersedeMissionBriefId,
      rationale: decision.rationale,
      decision_context: decision.decisionContext as unknown,
      decided_at: decision.decidedAt,
      expires_at: decision.expiresAt,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `[missions/editorialDecisionRepo] create failed: ${error.message}`,
    );
  }

  return mapRowToEditorialDecision(data as Record<string, unknown>);
}

/** Fetch the latest editorial decision for a given editorial key. */
export async function getLatestMissionEditorialDecision(
  editorialKey: string,
): Promise<MissionEditorialDecision | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("fp_mission_editorial_decisions")
    .select("*")
    .eq("editorial_key", editorialKey)
    .order("decided_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `[missions/editorialDecisionRepo] latest lookup failed: ${error.message}`,
    );
  }

  return data ? mapRowToEditorialDecision(data as Record<string, unknown>) : null;
}

/** Fetch the latest editorial decision for a given source packet. */
export async function getLatestMissionEditorialDecisionForPacket(
  sourcePacketId: string,
): Promise<MissionEditorialDecision | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("fp_mission_editorial_decisions")
    .select("*")
    .eq("source_packet_id", sourcePacketId)
    .order("decided_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `[missions/editorialDecisionRepo] packet lookup failed: ${error.message}`,
    );
  }

  return data ? mapRowToEditorialDecision(data as Record<string, unknown>) : null;
}
