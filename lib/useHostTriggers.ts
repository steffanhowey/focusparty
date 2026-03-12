"use client";

import { useRef, useCallback, useEffect } from "react";
import { useTimerDisplay, type Timer } from "./useTimer";
import type { HostTriggerType } from "./types";

interface LinkedResourceContext {
  provider: string;
  title: string;
  url: string | null;
  resourceType: string;
}

interface UseHostTriggersInput {
  partyId: string | null;
  sessionId: string | null;
  sprintId: string | null;
  userId: string | null;
  goalSummary: string | null;
  participantCount: number;
  sprintNumber: number | null;
  sprintDurationSec: number | null;
  timer: Timer;
  /** Only fire triggers during the sprint phase. */
  phase: string;
  /** Linked external resource for the active task (set after useTasks resolves). */
  linkedResource?: LinkedResourceContext | null;
}

/**
 * Fires host trigger calls at key session lifecycle moments.
 * All calls are fire-and-forget — errors are logged, never thrown.
 */
export function useHostTriggers(input: UseHostTriggersInput) {
  const {
    partyId,
    sessionId,
    sprintId,
    userId,
    goalSummary,
    participantCount,
    sprintNumber,
    sprintDurationSec,
    timer,
    phase,
    linkedResource,
  } = input;

  // Use a ref so fireOnce always reads the latest value without recomputing
  const linkedResourceRef = useRef(linkedResource ?? null);
  linkedResourceRef.current = linkedResource ?? null;

  // Track which triggers have fired this sprint to avoid duplicates
  const firedRef = useRef(new Set<HostTriggerType>());
  const prevSprintIdRef = useRef<string | null>(null);

  // Reset fired set when sprint changes
  useEffect(() => {
    if (sprintId !== prevSprintIdRef.current) {
      firedRef.current.clear();
      prevSprintIdRef.current = sprintId;
    }
  }, [sprintId]);

  const fireOnce = useCallback(
    (triggerType: HostTriggerType, elapsedSec?: number) => {
      if (!partyId) return;
      if (firedRef.current.has(triggerType)) return;
      firedRef.current.add(triggerType);

      fetch("/api/host/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          triggerType,
          partyId,
          sessionId,
          sprintId,
          userId,
          context: {
            goalSummary,
            participantCount,
            sprintNumber,
            sprintDurationSec,
            sprintElapsedSec: elapsedSec ?? null,
            linkedResource: linkedResourceRef.current,
          },
        }),
      }).catch((err) =>
        console.error(`[useHostTriggers] ${triggerType} failed:`, err)
      );
    },
    [partyId, sessionId, sprintId, userId, goalSummary, participantCount, sprintNumber, sprintDurationSec]
  );

  // Timer-based triggers (midpoint + near end)
  const { seconds } = useTimerDisplay(timer);

  useEffect(() => {
    if (phase !== "sprint" || !sprintDurationSec || sprintDurationSec <= 0) return;

    const elapsed = sprintDurationSec - seconds;
    const midpoint = Math.floor(sprintDurationSec / 2);

    // Midpoint: fire once when we cross the halfway mark
    if (elapsed >= midpoint && midpoint > 0) {
      fireOnce("sprint_midpoint", elapsed);
    }

    // Near end: fire once when 5 minutes or less remain (and sprint is > 10 min)
    if (seconds <= 300 && seconds > 0 && sprintDurationSec > 600) {
      fireOnce("sprint_near_end", elapsed);
    }
  }, [seconds, phase, sprintDurationSec, fireOnce]);

  // Expose imperative triggers for lifecycle events called from handlers
  const triggerSessionStarted = useCallback(() => {
    fireOnce("session_started", 0);
  }, [fireOnce]);

  const triggerSprintStarted = useCallback(() => {
    // Clear fired set for the new sprint (imperative triggers like sprint_started
    // fire before the sprintId ref updates, so we clear explicitly here)
    firedRef.current.clear();
    fireOnce("sprint_started", 0);
  }, [fireOnce]);

  const triggerReviewEntered = useCallback(() => {
    const elapsed = sprintDurationSec ? sprintDurationSec - seconds : undefined;
    fireOnce("review_entered", elapsed);
  }, [fireOnce, sprintDurationSec, seconds]);

  const triggerSessionCompleted = useCallback(() => {
    fireOnce("session_completed");
  }, [fireOnce]);

  // Allow late-binding of linkedResource (set after useTasks resolves)
  const setLinkedResource = useCallback((lr: LinkedResourceContext | null) => {
    linkedResourceRef.current = lr;
  }, []);

  return {
    triggerSessionStarted,
    triggerSprintStarted,
    triggerReviewEntered,
    triggerSessionCompleted,
    setLinkedResource,
  };
}
