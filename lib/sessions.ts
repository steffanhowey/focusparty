import { createClient } from "./supabase/client";
import type {
  SessionRow,
  SessionSprint,
  SessionGoal,
  ActivityEvent,
  ActivityEventType,
  SessionPhase,
  SessionMood,
  ProductivityRating,
  UserSessionStats,
  UserStreakStats,
  DailySessionCount,
  FavoritePartyStat,
  PartySummaryStats,
} from "./types";

// ─── Session Queries ──────────────────────────────────────────

/** Get the user's currently active session (if any). */
export async function getActiveSession(
  userId: string
): Promise<SessionRow | null> {
  const { data, error } = await createClient()
    .from("fp_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** Get the user's active session in a specific party (if any). */
export async function getActiveSessionForParty(
  userId: string,
  partyId: string
): Promise<SessionRow | null> {
  const { data, error } = await createClient()
    .from("fp_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("party_id", partyId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** List past sessions for a user, newest first. */
export async function listSessions(
  userId: string,
  limit = 50
): Promise<SessionRow[]> {
  const { data, error } = await createClient()
    .from("fp_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

// ─── Session Mutations ────────────────────────────────────────

export async function createSession(input: {
  user_id: string;
  party_id?: string | null;
  task_id?: string | null;
  character?: string | null;
  goal_text?: string | null;
  planned_duration_sec: number;
}): Promise<SessionRow> {
  const { data, error } = await createClient()
    .from("fp_sessions")
    .insert({
      user_id: input.user_id,
      party_id: input.party_id ?? null,
      task_id: input.task_id ?? null,
      character: input.character ?? null,
      goal_text: input.goal_text ?? null,
      planned_duration_sec: input.planned_duration_sec,
      phase: "sprint" as SessionPhase,
      status: "active",
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function updateSession(
  sessionId: string,
  updates: Partial<
    Pick<
      SessionRow,
      | "phase"
      | "status"
      | "actual_duration_sec"
      | "reflection_mood"
      | "reflection_productivity"
      | "ended_at"
      | "metadata"
    >
  >
): Promise<void> {
  const { error } = await createClient()
    .from("fp_sessions")
    .update(updates)
    .eq("id", sessionId);

  if (error) throw error;
}

// ─── Sprint Queries ───────────────────────────────────────────

/** Get all sprints for a session, ordered by sprint number. */
export async function listSprints(
  sessionId: string
): Promise<SessionSprint[]> {
  const { data, error } = await createClient()
    .from("fp_session_sprints")
    .select("*")
    .eq("session_id", sessionId)
    .order("sprint_number", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// ─── Sprint Mutations ─────────────────────────────────────────

export async function createSprint(input: {
  session_id: string;
  sprint_number: number;
  duration_sec: number;
}): Promise<SessionSprint> {
  const { data, error } = await createClient()
    .from("fp_session_sprints")
    .insert({
      session_id: input.session_id,
      sprint_number: input.sprint_number,
      duration_sec: input.duration_sec,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function completeSprint(
  sprintId: string,
  endedAt: string
): Promise<void> {
  const { error } = await createClient()
    .from("fp_session_sprints")
    .update({ completed: true, ended_at: endedAt })
    .eq("id", sprintId);

  if (error) throw error;
}

// ─── Goal Queries ─────────────────────────────────────────────

export async function listGoals(
  sessionId: string
): Promise<SessionGoal[]> {
  const { data, error } = await createClient()
    .from("fp_session_goals")
    .select("*")
    .eq("session_id", sessionId)
    .order("declared_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// ─── Goal Mutations ───────────────────────────────────────────

export async function createGoal(input: {
  session_id: string;
  sprint_id?: string | null;
  user_id: string;
  task_id?: string | null;
  body: string;
}): Promise<SessionGoal> {
  const { data, error } = await createClient()
    .from("fp_session_goals")
    .insert({
      session_id: input.session_id,
      sprint_id: input.sprint_id ?? null,
      user_id: input.user_id,
      task_id: input.task_id ?? null,
      body: input.body,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function completeGoal(goalId: string): Promise<void> {
  const { error } = await createClient()
    .from("fp_session_goals")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", goalId);

  if (error) throw error;
}

// ─── Activity Events ──────────────────────────────────────────

export async function logEvent(input: {
  party_id?: string | null;
  session_id?: string | null;
  user_id: string;
  event_type: ActivityEventType;
  body?: string | null;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await createClient()
    .from("fp_activity_events")
    .insert({
      party_id: input.party_id ?? null,
      session_id: input.session_id ?? null,
      user_id: input.user_id,
      actor_type: "user",
      event_type: input.event_type,
      body: input.body ?? null,
      payload: input.payload ?? {},
    });

  if (error) throw error;
}

export async function listPartyEvents(
  partyId: string,
  limit = 50
): Promise<ActivityEvent[]> {
  const { data, error } = await createClient()
    .from("fp_activity_events")
    .select("*")
    .eq("party_id", partyId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function listUserEvents(
  userId: string,
  limit = 50
): Promise<ActivityEvent[]> {
  const { data, error } = await createClient()
    .from("fp_activity_events")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

// ─── Progress / Stats Queries ────────────────────────────────

/** Aggregate session stats for a user. */
export async function getUserSessionStats(
  userId: string
): Promise<UserSessionStats> {
  const client = createClient();

  // Completed sessions + total focus seconds
  const { data: sessions, error: sessErr } = await client
    .from("fp_sessions")
    .select("actual_duration_sec, planned_duration_sec, started_at")
    .eq("user_id", userId)
    .eq("status", "completed");

  if (sessErr) throw sessErr;

  const completedSessions = sessions ?? [];
  const totalCompletedSessions = completedSessions.length;

  // Focus minutes: prefer actual_duration_sec, fall back to planned_duration_sec
  const totalFocusSeconds = completedSessions.reduce((sum, s) => {
    return sum + (s.actual_duration_sec ?? s.planned_duration_sec ?? 0);
  }, 0);
  const totalFocusMinutes = Math.round(totalFocusSeconds / 60);

  // Sessions this week (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sessionsThisWeek = completedSessions.filter(
    (s) => new Date(s.started_at) >= sevenDaysAgo
  ).length;

  // Completed sprints: count across all user's sessions
  const { count: sprintCount, error: sprintErr } = await client
    .from("fp_session_sprints")
    .select("id", { count: "exact", head: true })
    .eq("completed", true)
    .in(
      "session_id",
      completedSessions.length > 0
        ? (await client
            .from("fp_sessions")
            .select("id")
            .eq("user_id", userId)
          ).data?.map((s) => s.id) ?? []
        : ["__none__"]
    );

  if (sprintErr) throw sprintErr;

  return {
    totalCompletedSessions,
    totalFocusMinutes,
    totalCompletedSprints: sprintCount ?? 0,
    sessionsThisWeek,
  };
}

/**
 * Compute streak stats from completed sessions.
 *
 * Streak rule (strict today-based):
 * - A "streak day" is any calendar day with at least one completed session.
 * - Current streak counts backward from today. If no session today, currentStreak = 0.
 * - Best streak is the longest consecutive run of streak days ever.
 * - All dates normalized to UTC day boundaries.
 */
export async function getUserStreak(
  userId: string
): Promise<UserStreakStats> {
  const { data, error } = await createClient()
    .from("fp_sessions")
    .select("started_at")
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("started_at", { ascending: false });

  if (error) throw error;

  const sessions = data ?? [];
  if (sessions.length === 0) {
    return { currentStreak: 0, bestStreak: 0, activeDays: [] };
  }

  // Collect unique active days (YYYY-MM-DD in UTC)
  const daySet = new Set<string>();
  for (const s of sessions) {
    daySet.add(s.started_at.slice(0, 10));
  }

  // Sort descending (most recent first)
  const activeDays = Array.from(daySet).sort().reverse();

  // Compute streaks
  const todayStr = new Date().toISOString().slice(0, 10);

  // Current streak: starts from today, counts consecutive days backward
  let currentStreak = 0;
  if (activeDays[0] === todayStr) {
    currentStreak = 1;
    for (let i = 1; i < activeDays.length; i++) {
      const expected = new Date(todayStr);
      expected.setUTCDate(expected.getUTCDate() - i);
      const expectedStr = expected.toISOString().slice(0, 10);
      if (activeDays[i] === expectedStr) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Best streak: find longest consecutive run in sorted ascending order
  const ascending = [...activeDays].reverse();
  let bestStreak = 1;
  let run = 1;
  for (let i = 1; i < ascending.length; i++) {
    const prev = new Date(ascending[i - 1]);
    const curr = new Date(ascending[i]);
    const diffMs = curr.getTime() - prev.getTime();
    if (diffMs === 86400000) {
      run++;
      if (run > bestStreak) bestStreak = run;
    } else {
      run = 1;
    }
  }

  return { currentStreak, bestStreak, activeDays };
}

/** Get daily completed session counts over the last N days (gap-filled). */
export async function getDailySessionCounts(
  userId: string,
  days: 7 | 30 = 7
): Promise<DailySessionCount[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await createClient()
    .from("fp_sessions")
    .select("started_at")
    .eq("user_id", userId)
    .eq("status", "completed")
    .gte("started_at", since.toISOString())
    .order("started_at", { ascending: true });

  if (error) throw error;

  // Count sessions per day
  const countMap = new Map<string, number>();
  for (const s of data ?? []) {
    const day = s.started_at.slice(0, 10);
    countMap.set(day, (countMap.get(day) ?? 0) + 1);
  }

  // Fill gaps so the chart has a continuous range
  const result: DailySessionCount[] = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() - days + 1);
  for (let i = 0; i < days; i++) {
    const dayStr = cursor.toISOString().slice(0, 10);
    result.push({ day: dayStr, sessions: countMap.get(dayStr) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}

/** Get the user's favorite parties (by session count). */
export async function getFavoriteParties(
  userId: string,
  limit = 3
): Promise<FavoritePartyStat[]> {
  const { data, error } = await createClient()
    .from("fp_sessions")
    .select("party_id, fp_parties(id, name, character)")
    .eq("user_id", userId)
    .eq("status", "completed")
    .not("party_id", "is", null);

  if (error) throw error;

  // Group by party_id and count
  const partyMap = new Map<
    string,
    { partyId: string; partyName: string; character: string | null; count: number }
  >();

  for (const row of data ?? []) {
    const pid = row.party_id as string;
    const partyInfo = row.fp_parties as unknown as {
      id: string;
      name: string;
      character: string | null;
    } | null;

    if (!pid || !partyInfo) continue;

    const existing = partyMap.get(pid);
    if (existing) {
      existing.count++;
    } else {
      partyMap.set(pid, {
        partyId: pid,
        partyName: partyInfo.name,
        character: partyInfo.character,
        count: 1,
      });
    }
  }

  // Sort by count desc and take top N
  return Array.from(partyMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((p) => ({
      partyId: p.partyId,
      partyName: p.partyName,
      sessionCount: p.count,
      character: p.character,
    }));
}

/** Get recent user activity events. */
export async function getUserRecentActivity(
  userId: string,
  limit = 20
): Promise<ActivityEvent[]> {
  return listUserEvents(userId, limit);
}

/** Lightweight summary stats for a party (today only). */
export async function getPartySummaryStats(
  partyId: string
): Promise<PartySummaryStats> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  const client = createClient();

  // Sessions started today in this party
  const { count: sessionsToday, error: sessErr } = await client
    .from("fp_sessions")
    .select("id", { count: "exact", head: true })
    .eq("party_id", partyId)
    .gte("started_at", todayIso);

  if (sessErr) throw sessErr;

  // Completed sprints today in this party (join through sessions)
  const { data: todaySessions, error: tsErr } = await client
    .from("fp_sessions")
    .select("id")
    .eq("party_id", partyId)
    .gte("started_at", todayIso);

  if (tsErr) throw tsErr;

  let completedSprintsToday = 0;
  const sessionIds = (todaySessions ?? []).map((s) => s.id);
  if (sessionIds.length > 0) {
    const { count, error: spErr } = await client
      .from("fp_session_sprints")
      .select("id", { count: "exact", head: true })
      .eq("completed", true)
      .in("session_id", sessionIds);

    if (spErr) throw spErr;
    completedSprintsToday = count ?? 0;
  }

  return {
    sessionsToday: sessionsToday ?? 0,
    completedSprintsToday,
  };
}
