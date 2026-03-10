"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  createSession,
  updateSession,
  getActiveSession,
  getActiveSessionForParty,
  createSprint,
  completeSprint as completeSprintDb,
  createGoal,
  completeGoal as completeGoalDb,
  logEvent,
  listSprints,
} from "./sessions";
import type {
  SessionRow,
  SessionSprint,
  SessionGoal,
  SessionPhase,
  SessionMood,
  ProductivityRating,
  ActivityEventType,
} from "./types";

interface UseSessionPersistenceReturn {
  /** The persisted session row, or null if none active. */
  sessionRow: SessionRow | null;
  /** The current sprint record, or null. */
  currentSprint: SessionSprint | null;
  /** True while hydrating from DB on mount. */
  isHydrating: boolean;
  /** True if a previous active session was found and restored. */
  wasRestored: boolean;

  /** Create a new session row + log session_started event. Returns the session. */
  startSession: (input: {
    user_id: string;
    party_id?: string | null;
    task_id?: string | null;
    character?: string | null;
    goal_text?: string | null;
    planned_duration_sec: number;
  }) => Promise<SessionRow>;

  /** Update the session phase in the DB. */
  updatePhase: (phase: SessionPhase) => Promise<void>;

  /** Create a new sprint row + log sprint_started event. Returns the sprint. */
  startSprint: (input: {
    session_id: string;
    sprint_number: number;
    duration_sec: number;
  }) => Promise<SessionSprint>;

  /** Mark the current sprint as completed + log sprint_completed event. */
  completeSprint: () => Promise<void>;

  /** Declare a goal for the session + log goal_declared event. Returns the goal. */
  declareGoal: (input: {
    user_id: string;
    task_id?: string | null;
    body: string;
  }) => Promise<SessionGoal | null>;

  /** Mark a goal as completed + log goal_completed event. */
  completeGoal: (goalId: string) => Promise<void>;

  /** Persist reflection (mood, productivity, duration) + log reflection_submitted. */
  submitReflection: (input: {
    mood: SessionMood | null;
    productivity: ProductivityRating | null;
    actual_duration_sec: number;
  }) => Promise<void>;

  /** End the session (completed or abandoned) + log session_completed. */
  endSession: (outcome: "completed" | "abandoned") => Promise<void>;
}

/**
 * Adapter between SessionPage's React state machine and the database.
 *
 * Shadows writes to Supabase — does NOT drive the UI.
 * All writes are fire-and-forget (optimistic). Errors are logged, not thrown.
 */
export function useSessionPersistence(
  userId: string | null
): UseSessionPersistenceReturn {
  const [sessionRow, setSessionRow] = useState<SessionRow | null>(null);
  const [currentSprint, setCurrentSprint] = useState<SessionSprint | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [wasRestored, setWasRestored] = useState(false);

  // Refs to avoid stale closures in fire-and-forget callbacks
  const sessionRef = useRef(sessionRow);
  const sprintRef = useRef(currentSprint);
  sessionRef.current = sessionRow;
  sprintRef.current = currentSprint;

  // ── Hydration: check for active session on mount ──
  //
  // IMPORTANT: When userId is null (auth still loading), we intentionally
  // keep isHydrating=true (its initial value). This prevents page-level
  // hydration effects from firing prematurely and marking themselves as
  // "applied" before we've actually checked the database. Once userId
  // arrives, we fetch the active session and only then set isHydrating=false.
  useEffect(() => {
    if (!userId) return;

    // (Re-)enter hydrating state — critical when userId transitions
    // from null → real value after auth loads.
    setIsHydrating(true);

    let cancelled = false;

    async function hydrate() {
      try {
        const active = await getActiveSession(userId!);
        if (cancelled) return;

        if (active) {
          setSessionRow(active);
          setWasRestored(true);

          // Also fetch the latest sprint for this session
          const sprints = await listSprints(active.id);
          if (!cancelled && sprints.length > 0) {
            setCurrentSprint(sprints[sprints.length - 1]);
          }
        }
      } catch (err) {
        console.error("[useSessionPersistence] hydration error:", err);
      } finally {
        if (!cancelled) setIsHydrating(false);
      }
    }

    hydrate();
    return () => { cancelled = true; };
  }, [userId]);

  // ── Helper: safe fire-and-forget logging ──
  const safeLog = useCallback(
    (eventType: ActivityEventType, body?: string, payload?: Record<string, unknown>) => {
      if (!userId) return;
      logEvent({
        party_id: sessionRef.current?.party_id,
        session_id: sessionRef.current?.id,
        user_id: userId,
        event_type: eventType,
        body,
        payload,
      }).catch((err) =>
        console.error(`[useSessionPersistence] logEvent(${eventType}) failed:`, err)
      );
    },
    [userId]
  );

  // ── startSession ──
  const startSessionFn = useCallback(
    async (input: {
      user_id: string;
      party_id?: string | null;
      task_id?: string | null;
      character?: string | null;
      goal_text?: string | null;
      planned_duration_sec: number;
    }): Promise<SessionRow> => {
      // Duplicate guard: if starting in a party, check for existing active session
      if (input.party_id) {
        const existing = await getActiveSessionForParty(input.user_id, input.party_id);
        if (existing) {
          setSessionRow(existing);
          setWasRestored(true);
          // Fetch latest sprint too
          const sprints = await listSprints(existing.id);
          if (sprints.length > 0) setCurrentSprint(sprints[sprints.length - 1]);
          return existing;
        }
      }

      const session = await createSession(input);
      setSessionRow(session);
      setWasRestored(false);

      // Log event (fire-and-forget after session is set)
      logEvent({
        party_id: input.party_id ?? null,
        session_id: session.id,
        user_id: input.user_id,
        event_type: "session_started",
        body: input.goal_text ?? undefined,
        payload: {
          character: input.character,
          planned_duration_sec: input.planned_duration_sec,
        },
      }).catch((err) =>
        console.error("[useSessionPersistence] logEvent(session_started) failed:", err)
      );

      return session;
    },
    []
  );

  // ── updatePhase ──
  const updatePhaseFn = useCallback(
    async (phase: SessionPhase): Promise<void> => {
      const s = sessionRef.current;
      if (!s) return;
      try {
        await updateSession(s.id, { phase });
        setSessionRow((prev) => (prev ? { ...prev, phase } : null));
      } catch (err) {
        console.error("[useSessionPersistence] updatePhase failed:", err);
      }
    },
    []
  );

  // ── startSprint ──
  const startSprintFn = useCallback(
    async (input: {
      session_id: string;
      sprint_number: number;
      duration_sec: number;
    }): Promise<SessionSprint> => {
      const sprint = await createSprint(input);
      setCurrentSprint(sprint);

      safeLog("sprint_started", undefined, {
        sprint_number: input.sprint_number,
        duration_sec: input.duration_sec,
      });

      return sprint;
    },
    [safeLog]
  );

  // ── completeSprint ──
  const completeSprintFn = useCallback(async (): Promise<void> => {
    const sprint = sprintRef.current;
    if (!sprint) return;
    try {
      const endedAt = new Date().toISOString();
      await completeSprintDb(sprint.id, endedAt);
      setCurrentSprint((prev) =>
        prev ? { ...prev, completed: true, ended_at: endedAt } : null
      );
      safeLog("sprint_completed", undefined, {
        sprint_number: sprint.sprint_number,
        duration_sec: sprint.duration_sec,
      });
    } catch (err) {
      console.error("[useSessionPersistence] completeSprint failed:", err);
    }
  }, [safeLog]);

  // ── declareGoal ──
  const declareGoalFn = useCallback(
    async (input: {
      user_id: string;
      task_id?: string | null;
      body: string;
    }): Promise<SessionGoal | null> => {
      const s = sessionRef.current;
      if (!s) return null;
      try {
        const goal = await createGoal({
          session_id: s.id,
          sprint_id: sprintRef.current?.id ?? null,
          user_id: input.user_id,
          task_id: input.task_id ?? null,
          body: input.body,
        });
        safeLog("goal_declared", input.body);
        return goal;
      } catch (err) {
        console.error("[useSessionPersistence] declareGoal failed:", err);
        return null;
      }
    },
    [safeLog]
  );

  // ── completeGoal ──
  const completeGoalFn = useCallback(
    async (goalId: string): Promise<void> => {
      try {
        await completeGoalDb(goalId);
        safeLog("goal_completed");
      } catch (err) {
        console.error("[useSessionPersistence] completeGoal failed:", err);
      }
    },
    [safeLog]
  );

  // ── submitReflection ──
  const submitReflectionFn = useCallback(
    async (input: {
      mood: SessionMood | null;
      productivity: ProductivityRating | null;
      actual_duration_sec: number;
    }): Promise<void> => {
      const s = sessionRef.current;
      if (!s) return;
      try {
        await updateSession(s.id, {
          reflection_mood: input.mood,
          reflection_productivity: input.productivity,
          actual_duration_sec: input.actual_duration_sec,
        });
        setSessionRow((prev) =>
          prev
            ? {
                ...prev,
                reflection_mood: input.mood,
                reflection_productivity: input.productivity,
                actual_duration_sec: input.actual_duration_sec,
              }
            : null
        );
        safeLog("reflection_submitted", undefined, {
          mood: input.mood,
          productivity: input.productivity,
          actual_duration_sec: input.actual_duration_sec,
        });
      } catch (err) {
        console.error("[useSessionPersistence] submitReflection failed:", err);
      }
    },
    [safeLog]
  );

  // ── endSession ──
  const endSessionFn = useCallback(
    async (outcome: "completed" | "abandoned"): Promise<void> => {
      const s = sessionRef.current;
      if (!s) return;
      try {
        const endedAt = new Date().toISOString();
        await updateSession(s.id, {
          status: outcome,
          ended_at: endedAt,
        });
        setSessionRow((prev) =>
          prev ? { ...prev, status: outcome, ended_at: endedAt } : null
        );
        safeLog("session_completed", undefined, { outcome });

        // Clear local state after ending
        setSessionRow(null);
        setCurrentSprint(null);
      } catch (err) {
        console.error("[useSessionPersistence] endSession failed:", err);
      }
    },
    [safeLog]
  );

  return {
    sessionRow,
    currentSprint,
    isHydrating,
    wasRestored,
    startSession: startSessionFn,
    updatePhase: updatePhaseFn,
    startSprint: startSprintFn,
    completeSprint: completeSprintFn,
    declareGoal: declareGoalFn,
    completeGoal: completeGoalFn,
    submitReflection: submitReflectionFn,
    endSession: endSessionFn,
  };
}
