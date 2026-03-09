"use client";

import { useState, useEffect, useMemo } from "react";
import type { ActivityEvent, PresencePayload } from "./types";

export interface RoomSprintInfo {
  /** Whether there's an active sprint happening in this room */
  hasActiveSprint: boolean;
  /** Seconds remaining in the current sprint (0 if none) */
  remainingSeconds: number;
  /** Number of participants currently in sprint phase */
  focusingCount: number;
  /** When the current sprint approximately ends (ISO string, null if none) */
  endsAt: string | null;
}

/**
 * Compute the room's "current sprint" timing from activity events and presence.
 * Ticks every second to keep the countdown live.
 */
export function useRoomSprint(
  events: ActivityEvent[],
  participants: PresencePayload[]
): RoomSprintInfo {
  const focusingCount = useMemo(
    () => participants.filter((p) => p.status === "focused").length,
    [participants]
  );

  // Find the most recent sprint_started event with duration_sec in payload
  const latestSprint = useMemo(() => {
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (
        e.event_type === "sprint_started" &&
        e.payload &&
        typeof e.payload.duration_sec === "number"
      ) {
        return {
          startedAt: new Date(e.created_at).getTime(),
          durationSec: e.payload.duration_sec as number,
        };
      }
    }
    return null;
  }, [events]);

  const computeRemaining = () => {
    if (!latestSprint || focusingCount === 0) return 0;
    const elapsed = Math.floor((Date.now() - latestSprint.startedAt) / 1000);
    return Math.max(0, latestSprint.durationSec - elapsed);
  };

  const [remainingSeconds, setRemainingSeconds] = useState(computeRemaining);

  // Tick every second while there's an active sprint
  useEffect(() => {
    const remaining = computeRemaining();
    setRemainingSeconds(remaining);

    if (remaining <= 0) return;

    const id = setInterval(() => {
      const r = computeRemaining();
      setRemainingSeconds(r);
      if (r <= 0) clearInterval(id);
    }, 1000);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestSprint, focusingCount]);

  const hasActiveSprint = remainingSeconds > 0 && focusingCount > 0;

  const endsAt = useMemo(() => {
    if (!hasActiveSprint || !latestSprint) return null;
    return new Date(
      latestSprint.startedAt + latestSprint.durationSec * 1000
    ).toISOString();
  }, [hasActiveSprint, latestSprint]);

  return { hasActiveSprint, remainingSeconds, focusingCount, endsAt };
}
