import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { SourcePacketSchema } from "@/lib/missions/schema/sourcePacketSchema";
import type { SourcePacket } from "@/lib/missions/types/sourcePacket";

function mapRowToSourcePacket(row: Record<string, unknown>): SourcePacket {
  return SourcePacketSchema.parse(row.packet);
}

function toRow(packet: SourcePacket): Record<string, unknown> {
  return {
    id: packet.packetId,
    topic_id: packet.topic.topicId,
    cluster_id: packet.topic.clusterId,
    topic_slug: packet.topic.topicSlug,
    topic_name: packet.topic.topicName,
    topic_category: packet.topic.topicCategory,
    schema_version: packet.schemaVersion,
    packet_hash: packet.packetHash,
    status: packet.status,
    readiness_state: packet.readiness.state,
    timeliness_class: packet.sourceWindow.timelinessClass,
    heat_score_snapshot: packet.topic.heatScoreSnapshot,
    freshness_score: packet.freshness.recencyScore,
    credibility_score: packet.credibility.overallScore,
    completeness_score: packet.quality.completenessScore,
    why_now_summary: packet.whyNow.summary,
    readiness_rationale: packet.readiness.rationale,
    blockers: packet.readiness.blockers as unknown,
    packet: packet as unknown,
    assembled_at: packet.assembledAt,
    expires_at: packet.expiresAt,
  };
}

/** Persist a new canonical source packet. */
export async function createSourcePacket(packet: SourcePacket): Promise<SourcePacket> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("fp_source_packets")
    .insert(toRow(packet))
    .select("packet")
    .single();

  if (error) {
    throw new Error(`[missions/sourcePacketRepo] create failed: ${error.message}`);
  }

  return mapRowToSourcePacket(data as Record<string, unknown>);
}

/** Update an existing source packet in place after readiness validation. */
export async function updateSourcePacket(packet: SourcePacket): Promise<SourcePacket> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("fp_source_packets")
    .update({
      ...toRow(packet),
      updated_at: new Date().toISOString(),
    })
    .eq("id", packet.packetId)
    .select("packet")
    .single();

  if (error) {
    throw new Error(`[missions/sourcePacketRepo] update failed: ${error.message}`);
  }

  return mapRowToSourcePacket(data as Record<string, unknown>);
}

/** Fetch the latest packet for a topic, regardless of readiness state. */
export async function getLatestSourcePacketByTopic(
  topicSlug: string,
): Promise<SourcePacket | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("fp_source_packets")
    .select("packet")
    .eq("topic_slug", topicSlug)
    .order("assembled_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`[missions/sourcePacketRepo] latest lookup failed: ${error.message}`);
  }

  return data ? mapRowToSourcePacket(data as Record<string, unknown>) : null;
}

/** Fetch the latest mission-ready packet for a topic. */
export async function getLatestMissionReadySourcePacketByTopic(
  topicSlug: string,
): Promise<SourcePacket | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("fp_source_packets")
    .select("packet")
    .eq("topic_slug", topicSlug)
    .eq("readiness_state", "mission_ready")
    .order("assembled_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `[missions/sourcePacketRepo] mission-ready lookup failed: ${error.message}`,
    );
  }

  return data ? mapRowToSourcePacket(data as Record<string, unknown>) : null;
}

/** Fetch a packet by topic/hash for dedupe and reuse. */
export async function getSourcePacketByHash(
  topicSlug: string,
  packetHash: string,
): Promise<SourcePacket | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("fp_source_packets")
    .select("packet")
    .eq("topic_slug", topicSlug)
    .eq("packet_hash", packetHash)
    .maybeSingle();

  if (error) {
    throw new Error(`[missions/sourcePacketRepo] hash lookup failed: ${error.message}`);
  }

  return data ? mapRowToSourcePacket(data as Record<string, unknown>) : null;
}

/** Mark an older packet as superseded by a newer packet id. */
export async function markSourcePacketSuperseded(
  packetId: string,
  supersededBy: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("fp_source_packets")
    .update({
      status: "superseded",
      superseded_by: supersededBy,
      updated_at: new Date().toISOString(),
    })
    .eq("id", packetId);

  if (error) {
    throw new Error(`[missions/sourcePacketRepo] supersede failed: ${error.message}`);
  }
}
