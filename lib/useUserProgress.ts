"use client";

import { useState, useEffect } from "react";
import {
  getUserSessionStats,
  getUserStreak,
  getDailySessionCounts,
  getUserRecentActivity,
  getFavoriteParties,
} from "./sessions";
import type {
  UserSessionStats,
  UserStreakStats,
  DailySessionCount,
  ActivityEvent,
  FavoritePartyStat,
} from "./types";

export interface UseUserProgressResult {
  stats: UserSessionStats | null;
  streak: UserStreakStats | null;
  chart7d: DailySessionCount[];
  chart30d: DailySessionCount[];
  recentActivity: ActivityEvent[];
  favoriteParties: FavoritePartyStat[];
  loading: boolean;
  error: string | null;
}

/**
 * Fetches all progress data for the current user.
 * Runs all queries in parallel on mount.
 */
export function useUserProgress(userId: string | null): UseUserProgressResult {
  const [stats, setStats] = useState<UserSessionStats | null>(null);
  const [streak, setStreak] = useState<UserStreakStats | null>(null);
  const [chart7d, setChart7d] = useState<DailySessionCount[]>([]);
  const [chart30d, setChart30d] = useState<DailySessionCount[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityEvent[]>([]);
  const [favoriteParties, setFavoriteParties] = useState<FavoritePartyStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const [s, sk, c7, c30, ra, fp] = await Promise.all([
          getUserSessionStats(userId!),
          getUserStreak(userId!),
          getDailySessionCounts(userId!, 7),
          getDailySessionCounts(userId!, 30),
          getUserRecentActivity(userId!, 20),
          getFavoriteParties(userId!, 3),
        ]);

        if (cancelled) return;
        setStats(s);
        setStreak(sk);
        setChart7d(c7);
        setChart30d(c30);
        setRecentActivity(ra);
        setFavoriteParties(fp);
      } catch (err) {
        console.error("[useUserProgress] load error:", err);
        if (!cancelled) setError("Failed to load progress data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { stats, streak, chart7d, chart30d, recentActivity, favoriteParties, loading, error };
}
