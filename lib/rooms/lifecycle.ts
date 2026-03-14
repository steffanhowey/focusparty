// ─── Room Lifecycle Management ───────────────────────────────
// Manages auto-generated rooms after provisioning: activation,
// archiving, trending status updates. Runs daily via cron.

import { createClient } from "@/lib/supabase/admin";

// ─── Types ──────────────────────────────────────────────────

export interface LifecycleCheckResult {
  roomsChecked: number;
  roomsArchived: number;
  roomsActivated: number;
  roomsDetended: number;
  details: {
    partyId: string;
    roomName: string;
    action: "archived" | "activated" | "detrended" | "no_action";
    reason: string;
  }[];
  durationMs: number;
}

export interface LifecycleStats {
  totalAutoRooms: number;
  activeRooms: number;
  waitingRooms: number;
  archivedRooms: number;
  trendingRooms: number;
  roomsByTopic: { topicSlug: string; count: number }[];
}

// ─── Constants ──────────────────────────────────────────────

const ARCHIVE_INACTIVE_DAYS = 7;
const WAITING_EXPIRY_DAYS = 14;
const DETREND_HEAT_THRESHOLD = 0.5;

// ─── Core ───────────────────────────────────────────────────

/**
 * Run lifecycle checks on all auto-generated rooms.
 * Archives stale rooms, activates waiting rooms with participants,
 * and updates trending status.
 */
export async function runLifecycleChecks(): Promise<LifecycleCheckResult> {
  const startTime = Date.now();
  const supabase = createClient();
  const details: LifecycleCheckResult["details"] = [];
  let archived = 0;
  let activated = 0;
  let detrended = 0;

  // Fetch all auto-generated rooms that are still live
  const { data: rooms } = await supabase
    .from("fp_parties")
    .select("id, name, status, topic_slug, is_trending, created_at")
    .eq("generation_source", "auto")
    .eq("persistent", true)
    .in("status", ["waiting", "active"]);

  if (!rooms || rooms.length === 0) {
    return {
      roomsChecked: 0,
      roomsArchived: 0,
      roomsActivated: 0,
      roomsDetended: 0,
      details: [],
      durationMs: Date.now() - startTime,
    };
  }

  for (const room of rooms) {
    try {
      // Check participant count
      const { count: participantCount } = await supabase
        .from("fp_party_participants")
        .select("id", { count: "exact", head: true })
        .eq("party_id", room.id);

      // Check recent sessions (last N days)
      const cutoffDate = new Date(
        Date.now() - ARCHIVE_INACTIVE_DAYS * 24 * 60 * 60 * 1000
      ).toISOString();

      const { count: recentSessionCount } = await supabase
        .from("fp_sessions")
        .select("id", { count: "exact", head: true })
        .eq("party_id", room.id)
        .gte("created_at", cutoffDate);

      const participants = participantCount ?? 0;
      const recentSessions = recentSessionCount ?? 0;

      // Rule 1: Activate waiting rooms with participants
      if (room.status === "waiting" && participants > 0) {
        await supabase
          .from("fp_parties")
          .update({ status: "active" })
          .eq("id", room.id);

        activated++;
        details.push({
          partyId: room.id,
          roomName: room.name,
          action: "activated",
          reason: `${participants} participants joined`,
        });
        continue;
      }

      // Rule 2: Archive active rooms with no sessions in N days
      if (room.status === "active" && recentSessions === 0) {
        await supabase
          .from("fp_parties")
          .update({ status: "completed" })
          .eq("id", room.id);

        archived++;
        details.push({
          partyId: room.id,
          roomName: room.name,
          action: "archived",
          reason: `No sessions in ${ARCHIVE_INACTIVE_DAYS} days`,
        });
        continue;
      }

      // Rule 3: Expire waiting rooms that never got traction
      if (room.status === "waiting") {
        const createdAt = new Date(room.created_at).getTime();
        const ageMs = Date.now() - createdAt;
        const ageDays = ageMs / (1000 * 60 * 60 * 24);

        if (ageDays > WAITING_EXPIRY_DAYS && recentSessions === 0) {
          await supabase
            .from("fp_parties")
            .update({ status: "completed" })
            .eq("id", room.id);

          archived++;
          details.push({
            partyId: room.id,
            roomName: room.name,
            action: "archived",
            reason: `Waiting for ${Math.round(ageDays)} days with no sessions`,
          });
          continue;
        }
      }

      // Rule 4: Detrend rooms where topic has cooled
      if (room.is_trending && room.topic_slug) {
        const { data: cluster } = await supabase
          .from("fp_topic_clusters")
          .select("heat_score")
          .eq(
            "topic_id",
            supabase
              .from("fp_topic_taxonomy")
              .select("id")
              .eq("slug", room.topic_slug)
              .single()
          );

        // Simpler approach: query topic then cluster
        const { data: topic } = await supabase
          .from("fp_topic_taxonomy")
          .select("id")
          .eq("slug", room.topic_slug)
          .single();

        if (topic) {
          const { data: topicCluster } = await supabase
            .from("fp_topic_clusters")
            .select("heat_score")
            .eq("topic_id", topic.id)
            .single();

          if (topicCluster && (topicCluster.heat_score ?? 0) < DETREND_HEAT_THRESHOLD) {
            await supabase
              .from("fp_parties")
              .update({ is_trending: false })
              .eq("id", room.id);

            detrended++;
            details.push({
              partyId: room.id,
              roomName: room.name,
              action: "detrended",
              reason: `Topic heat dropped to ${(topicCluster.heat_score ?? 0).toFixed(3)}`,
            });
            continue;
          }
        }
      }

      details.push({
        partyId: room.id,
        roomName: room.name,
        action: "no_action",
        reason: "Room is healthy",
      });
    } catch (err) {
      console.error(`[rooms/lifecycle] Error checking room ${room.id}:`, err);
      details.push({
        partyId: room.id,
        roomName: room.name,
        action: "no_action",
        reason: `Error: ${err instanceof Error ? err.message : "unknown"}`,
      });
    }
  }

  return {
    roomsChecked: rooms.length,
    roomsArchived: archived,
    roomsActivated: activated,
    roomsDetended: detrended,
    details,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Get aggregate lifecycle stats for the admin dashboard.
 */
export async function getLifecycleStats(): Promise<LifecycleStats> {
  const supabase = createClient();

  // Count auto rooms by status
  const { count: totalCount } = await supabase
    .from("fp_parties")
    .select("id", { count: "exact", head: true })
    .eq("generation_source", "auto");

  const { count: activeCount } = await supabase
    .from("fp_parties")
    .select("id", { count: "exact", head: true })
    .eq("generation_source", "auto")
    .eq("status", "active");

  const { count: waitingCount } = await supabase
    .from("fp_parties")
    .select("id", { count: "exact", head: true })
    .eq("generation_source", "auto")
    .eq("status", "waiting");

  const { count: archivedCount } = await supabase
    .from("fp_parties")
    .select("id", { count: "exact", head: true })
    .eq("generation_source", "auto")
    .eq("status", "completed");

  const { count: trendingCount } = await supabase
    .from("fp_parties")
    .select("id", { count: "exact", head: true })
    .eq("generation_source", "auto")
    .eq("is_trending", true)
    .in("status", ["waiting", "active"]);

  // Rooms by topic
  const { data: topicRooms } = await supabase
    .from("fp_parties")
    .select("topic_slug")
    .eq("generation_source", "auto")
    .not("topic_slug", "is", null)
    .in("status", ["waiting", "active"]);

  const topicCounts = new Map<string, number>();
  for (const room of topicRooms ?? []) {
    const slug = room.topic_slug as string;
    topicCounts.set(slug, (topicCounts.get(slug) ?? 0) + 1);
  }

  const roomsByTopic = [...topicCounts.entries()]
    .map(([topicSlug, count]) => ({ topicSlug, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalAutoRooms: totalCount ?? 0,
    activeRooms: activeCount ?? 0,
    waitingRooms: waitingCount ?? 0,
    archivedRooms: archivedCount ?? 0,
    trendingRooms: trendingCount ?? 0,
    roomsByTopic,
  };
}
