"use client";

import { useEffect, useState } from "react";
import type { LearningPath, LearningProgress } from "@/lib/types";

export interface ActiveMissionEntry {
  path: LearningPath;
  progress: LearningProgress;
}

interface UseActiveMissionsReturn {
  missions: ActiveMissionEntry[];
  isLoading: boolean;
}

let cachedActiveMissions: ActiveMissionEntry[] | null = null;
let activeMissionsRequest: Promise<ActiveMissionEntry[]> | null = null;

async function loadActiveMissions(): Promise<ActiveMissionEntry[]> {
  if (cachedActiveMissions) {
    return cachedActiveMissions;
  }

  if (!activeMissionsRequest) {
    activeMissionsRequest = fetch("/api/learn/search")
      .then((response) => (response.ok ? response.json() : { in_progress: [] }))
      .then((data) => {
        const missions = (data.in_progress ?? []) as ActiveMissionEntry[];
        cachedActiveMissions = missions;
        return missions;
      })
      .catch(() => [])
      .finally(() => {
        activeMissionsRequest = null;
      });
  }

  return activeMissionsRequest;
}

/**
 * Lightweight mission source for room-entry flows.
 * Reuses the existing learn search endpoint and reads only the user's
 * in-progress missions.
 */
export function useActiveMissions(enabled = true): UseActiveMissionsReturn {
  const [missions, setMissions] = useState<ActiveMissionEntry[]>(
    () => cachedActiveMissions ?? [],
  );
  const [hasLoaded, setHasLoaded] = useState(() => cachedActiveMissions !== null);

  useEffect(() => {
    if (!enabled || hasLoaded) return;

    let cancelled = false;

    loadActiveMissions()
      .then((loadedMissions) => {
        if (cancelled) return;
        setMissions(loadedMissions);
        setHasLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setMissions([]);
        setHasLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, hasLoaded]);

  return {
    missions: enabled ? missions : [],
    isLoading: enabled ? !hasLoaded : false,
  };
}
