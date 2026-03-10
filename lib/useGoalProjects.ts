"use client";

import { useState, useCallback, useEffect } from "react";
import { useCurrentUser } from "./useCurrentUser";
import { createClient } from "./supabase/client";
import {
  listGoalProjectsBatch,
  setGoalProjects as setGoalProjectsApi,
} from "./goalProjects";

/**
 * Hook to manage goal ↔ project associations.
 * Returns a Map<goalId, projectId[]> and a setter.
 */
export function useGoalProjects(goalIds: string[]) {
  const { userId } = useCurrentUser();
  const [map, setMap] = useState<Map<string, string[]>>(new Map());

  const fetch = useCallback(async () => {
    if (!userId || goalIds.length === 0) return;
    try {
      const data = await listGoalProjectsBatch(goalIds);
      setMap(data);
    } catch (err) {
      console.error("Failed to fetch goal projects:", err);
    }
  }, [userId, goalIds.join(",")]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Realtime subscription for the join table
  useEffect(() => {
    if (!userId) return;

    const client = createClient();
    const channel = client
      .channel("goal-projects-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fp_goal_projects",
        },
        () => fetch()
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [userId, fetch]);

  const setGoalProjects = useCallback(
    async (goalId: string, projectIds: string[]) => {
      // Optimistic update
      setMap((prev) => {
        const next = new Map(prev);
        next.set(goalId, projectIds);
        return next;
      });

      try {
        await setGoalProjectsApi(goalId, projectIds);
      } catch {
        fetch();
      }
    },
    [fetch]
  );

  return { goalProjectsMap: map, setGoalProjects };
}
