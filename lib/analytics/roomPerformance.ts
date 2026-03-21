// ─── Room Performance Aggregator ─────────────────────────────
// Rolls up daily session/sprint metrics per room into
// fp_room_performance for analytics and calibration.

import { createClient } from "@/lib/supabase/admin";
import { getPartyRuntimeWorldKey } from "@/lib/worlds";
import type { RoomPerformance } from "@/lib/types";

// ─── Aggregation ────────────────────────────────────────────

/**
 * Aggregate room performance metrics for a specific date.
 * Queries sessions, sprints, and participants for each active room.
 */
export async function aggregateRoomPerformance(
  date?: Date
): Promise<{ processed: number; inserted: number }> {
  const supabase = createClient();
  const targetDate = date ?? new Date(Date.now() - 86400000);
  const dateStr = targetDate.toISOString().split("T")[0];
  const dayStart = `${dateStr}T00:00:00.000Z`;
  const dayEnd = `${dateStr}T23:59:59.999Z`;

  // Get all completed sessions for the target date
  const { data: sessions, error } = await supabase
    .from("fp_sessions")
    .select("id, party_id, user_id, actual_duration_sec, status")
    .not("party_id", "is", null)
    .gte("started_at", dayStart)
    .lte("started_at", dayEnd);

  if (error) {
    console.error("[analytics/roomPerformance] sessions query error:", error);
    return { processed: 0, inserted: 0 };
  }

  if (!sessions || sessions.length === 0) {
    return { processed: 0, inserted: 0 };
  }

  // Group sessions by party_id (room)
  const roomMap = new Map<
    string,
    {
      sessionIds: string[];
      userIds: Set<string>;
      totalDurationSec: number;
      sessionCount: number;
    }
  >();

  for (const s of sessions) {
    const roomId = s.party_id;
    if (!roomId) continue;
    const bucket = roomMap.get(roomId) ?? {
      sessionIds: [],
      userIds: new Set(),
      totalDurationSec: 0,
      sessionCount: 0,
    };
    bucket.sessionIds.push(s.id);
    bucket.userIds.add(s.user_id);
    bucket.totalDurationSec += s.actual_duration_sec ?? 0;
    bucket.sessionCount++;
    roomMap.set(roomId, bucket);
  }

  // For each room, count sprints and compute break completion rate
  let inserted = 0;
  for (const [roomId, data] of roomMap) {
    // Count completed sprints
    const { count: sprintCount } = await supabase
      .from("fp_session_sprints")
      .select("*", { count: "exact", head: true })
      .in("session_id", data.sessionIds)
      .eq("completed", true);

    // Compute break completion rate from the room's content items
    const breakCompletionRate = await computeBreakCompletionForRoom(roomId, dayStart, dayEnd);

    // Retention: check how many of today's users also had sessions in the prior 7 days
    const retentionRate = await computeRetentionRate(roomId, data.userIds, targetDate);

    const avgSessionMinutes = data.sessionCount > 0
      ? (data.totalDurationSec / data.sessionCount) / 60
      : 0;

    const { error: upsertError } = await supabase
      .from("fp_room_performance")
      .upsert(
        {
          room_id: roomId,
          period_date: dateStr,
          unique_participants: data.userIds.size,
          total_sessions: data.sessionCount,
          total_sprints: sprintCount ?? 0,
          avg_session_minutes: Math.round(avgSessionMinutes * 100) / 100,
          retention_rate: Math.round(retentionRate * 10000) / 10000,
          break_completion_rate: Math.round(breakCompletionRate * 10000) / 10000,
        },
        { onConflict: "room_id,period_date" }
      );

    if (upsertError) {
      console.error("[analytics/roomPerformance] upsert error:", upsertError);
    } else {
      inserted++;
    }
  }

  return { processed: roomMap.size, inserted };
}

// ─── Query helpers ──────────────────────────────────────────

/**
 * Get aggregated performance summary for a specific room across all dates.
 */
export async function getRoomPerformanceSummary(
  roomId: string
): Promise<{
  totalSessions: number;
  totalSprints: number;
  uniqueParticipants: number;
  avgSessionMinutes: number;
  avgRetentionRate: number;
}> {
  const supabase = createClient();
  const { data } = await supabase
    .from("fp_room_performance")
    .select("unique_participants, total_sessions, total_sprints, avg_session_minutes, retention_rate")
    .eq("room_id", roomId);

  const rows = data ?? [];
  if (rows.length === 0) {
    return { totalSessions: 0, totalSprints: 0, uniqueParticipants: 0, avgSessionMinutes: 0, avgRetentionRate: 0 };
  }

  const totalSessions = rows.reduce((s, r) => s + (r.total_sessions ?? 0), 0);
  const totalSprints = rows.reduce((s, r) => s + (r.total_sprints ?? 0), 0);
  // Unique participants across all days (approximation — uses max single-day count)
  const uniqueParticipants = Math.max(...rows.map((r) => r.unique_participants ?? 0));
  const avgSessionMinutes = rows.reduce((s, r) => s + Number(r.avg_session_minutes ?? 0), 0) / rows.length;
  const avgRetentionRate = rows.reduce((s, r) => s + Number(r.retention_rate ?? 0), 0) / rows.length;

  return {
    totalSessions,
    totalSprints,
    uniqueParticipants,
    avgSessionMinutes: Math.round(avgSessionMinutes * 100) / 100,
    avgRetentionRate: Math.round(avgRetentionRate * 10000) / 10000,
  };
}

/**
 * Compare auto-generated rooms vs manually-created rooms.
 */
export async function compareAutoVsManualRooms(
  daysBack = 30
): Promise<{
  auto: { rooms: number; avgSessions: number; avgRetention: number; avgBreakCompletion: number };
  manual: { rooms: number; avgSessions: number; avgRetention: number; avgBreakCompletion: number };
}> {
  const supabase = createClient();
  const cutoff = new Date(Date.now() - daysBack * 86400000).toISOString().split("T")[0];

  // Get auto-generated room IDs from blueprints
  const { data: autoBlueprints } = await supabase
    .from("fp_room_blueprints")
    .select("id")
    .eq("generation_source", "auto");

  const autoRoomIds = (autoBlueprints ?? []).map((b) => b.id);

  // Get all room performance in the window
  const { data: allPerf } = await supabase
    .from("fp_room_performance")
    .select("room_id, total_sessions, retention_rate, break_completion_rate")
    .gte("period_date", cutoff);

  const rows = allPerf ?? [];

  const autoRows = rows.filter((r) => autoRoomIds.includes(r.room_id));
  const manualRows = rows.filter((r) => !autoRoomIds.includes(r.room_id));

  const aggregate = (subset: typeof rows) => {
    if (subset.length === 0) return { rooms: 0, avgSessions: 0, avgRetention: 0, avgBreakCompletion: 0 };
    const roomIds = new Set(subset.map((r) => r.room_id));
    return {
      rooms: roomIds.size,
      avgSessions: subset.reduce((s, r) => s + (r.total_sessions ?? 0), 0) / subset.length,
      avgRetention: subset.reduce((s, r) => s + Number(r.retention_rate ?? 0), 0) / subset.length,
      avgBreakCompletion: subset.reduce((s, r) => s + Number(r.break_completion_rate ?? 0), 0) / subset.length,
    };
  };

  return { auto: aggregate(autoRows), manual: aggregate(manualRows) };
}

// ─── Internal helpers ───────────────────────────────────────

async function computeBreakCompletionForRoom(
  roomId: string,
  dayStart: string,
  dayEnd: string
): Promise<number> {
  const supabase = createClient();

  // Get world_key for this room
  const { data: room } = await supabase
    .from("fp_parties")
    .select("world_key, runtime_profile_key")
    .eq("id", roomId)
    .single();

  if (!room) return 0;
  const runtimeWorldKey = getPartyRuntimeWorldKey(room);

  // Get content item IDs for this world
  const { data: items } = await supabase
    .from("fp_break_content_items")
    .select("id")
    .eq("room_world_key", runtimeWorldKey)
    .eq("status", "active");

  if (!items || items.length === 0) return 0;

  const itemIds = items.map((i) => i.id);

  // Count starts and completions for these items on this day
  const { data: events } = await supabase
    .from("fp_break_engagement")
    .select("event_type")
    .in("content_item_id", itemIds)
    .gte("created_at", dayStart)
    .lte("created_at", dayEnd);

  if (!events || events.length === 0) return 0;

  const starts = events.filter((e) => e.event_type === "started").length;
  const completions = events.filter((e) => e.event_type === "completed").length;

  return starts > 0 ? completions / starts : 0;
}

async function computeRetentionRate(
  roomId: string,
  todayUsers: Set<string>,
  targetDate: Date
): Promise<number> {
  if (todayUsers.size === 0) return 0;

  const supabase = createClient();
  const sevenDaysAgo = new Date(targetDate.getTime() - 7 * 86400000).toISOString();
  const dayStart = targetDate.toISOString().split("T")[0] + "T00:00:00.000Z";

  // Find users who had sessions in this room in the prior 7 days
  const { data: priorSessions } = await supabase
    .from("fp_sessions")
    .select("user_id")
    .eq("party_id", roomId)
    .gte("started_at", sevenDaysAgo)
    .lt("started_at", dayStart);

  if (!priorSessions || priorSessions.length === 0) return 0;

  const priorUsers = new Set(priorSessions.map((s) => s.user_id));
  let returning = 0;
  for (const userId of todayUsers) {
    if (priorUsers.has(userId)) returning++;
  }

  return todayUsers.size > 0 ? returning / todayUsers.size : 0;
}

/** Map a database row to a RoomPerformance object. */
export function mapRoomPerformanceRow(row: Record<string, unknown>): RoomPerformance {
  return {
    id: row.id as string,
    roomId: row.room_id as string,
    periodDate: row.period_date as string,
    uniqueParticipants: (row.unique_participants as number) ?? 0,
    totalSessions: (row.total_sessions as number) ?? 0,
    totalSprints: (row.total_sprints as number) ?? 0,
    avgSessionMinutes: Number(row.avg_session_minutes ?? 0),
    retentionRate: Number(row.retention_rate ?? 0),
    breakCompletionRate: Number(row.break_completion_rate ?? 0),
  };
}
