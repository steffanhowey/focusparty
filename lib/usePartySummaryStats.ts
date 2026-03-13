"use client";

import { useState, useEffect } from "react";
import { getPartySummaryStats } from "./sessions";
import type { PartySummaryStats } from "./types";

export interface UsePartySummaryStatsResult {
  sessionsToday: number;
  completedSprintsToday: number;
  loading: boolean;
  error: string | null;
}

/**
 * Fetches lightweight party summary stats (sessions + sprints today).
 */
export function usePartySummaryStats(
  partyId: string | null
): UsePartySummaryStatsResult {
  const [stats, setStats] = useState<PartySummaryStats>({
    sessionsToday: 0,
    completedSprintsToday: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!partyId) {
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setError(null);

    async function load() {
      try {
        const result = await getPartySummaryStats(partyId!);
        if (cancelled) return;
        setStats(result);
      } catch (err) {
        console.error("[usePartySummaryStats] load error:", err);
        if (!cancelled) setError("Failed to load party stats");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [partyId]);

  return { ...stats, loading, error };
}
