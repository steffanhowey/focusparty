"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { createClient } from "./supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import type { GoalRecord, GoalSystemStatus } from "./types";
import {
  listGoals,
  createGoal as createGoalApi,
  updateGoal as updateGoalApi,
  deleteGoal as deleteGoalApi,
  reorderGoals as reorderGoalsApi,
} from "./goals";

export function useGoals() {
  const { userId } = useCurrentUser();
  const [goals, setGoals] = useState<GoalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGoals = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await listGoals();
      setGoals(data);
    } catch (err) {
      console.error("Failed to fetch goals:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Initial load
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    fetchGoals();
  }, [userId, fetchGoals]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;

    const client = createClient();
    const channel = client
      .channel("goals-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fp_goals",
          filter: `user_id=eq.${userId}`,
        },
        () => fetchGoals()
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [userId, fetchGoals]);

  // ─── Derived ──────────────────────────────────────────────

  const activeGoals = useMemo(
    () => goals.filter((g) => g.status === "active"),
    [goals]
  );

  const inProgressGoals = useMemo(
    () => goals.filter((g) => g.status === "in_progress"),
    [goals]
  );

  const completedGoals = useMemo(
    () => goals.filter((g) => g.status === "completed"),
    [goals]
  );

  // ─── Mutations ────────────────────────────────────────────

  const createGoal = useCallback(
    async (input: {
      title: string;
      description?: string | null;
      target_date?: string | null;
    }) => {
      if (!userId) return null;

      const optimistic: GoalRecord = {
        id: crypto.randomUUID(),
        user_id: userId,
        title: input.title,
        description: input.description ?? null,
        status: "active",
        position: goals.length,
        ai_generated: false,
        target_date: input.target_date ?? null,
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setGoals((prev) => [...prev, optimistic]);

      try {
        const created = await createGoalApi({
          user_id: userId,
          title: input.title,
          description: input.description ?? null,
          target_date: input.target_date ?? null,
          position: goals.length,
        });
        setGoals((prev) =>
          prev.map((g) => (g.id === optimistic.id ? created : g))
        );
        return created;
      } catch (err) {
        console.error("Failed to create goal:", err);
        setGoals((prev) => prev.filter((g) => g.id !== optimistic.id));
        return null;
      }
    },
    [userId, goals.length]
  );

  const updateGoal = useCallback(
    async (
      goalId: string,
      updates: Partial<
        Pick<GoalRecord, "title" | "description" | "status" | "position" | "target_date" | "completed_at">
      >
    ) => {
      setGoals((prev) =>
        prev.map((g) => (g.id === goalId ? { ...g, ...updates } : g))
      );
      try {
        await updateGoalApi(goalId, updates);
      } catch {
        fetchGoals();
      }
    },
    [fetchGoals]
  );

  const completeGoal = useCallback(
    async (goalId: string) => {
      const now = new Date().toISOString();
      setGoals((prev) =>
        prev.map((g) =>
          g.id === goalId
            ? { ...g, status: "completed" as GoalSystemStatus, completed_at: now }
            : g
        )
      );
      try {
        await updateGoalApi(goalId, { status: "completed", completed_at: now });
      } catch {
        fetchGoals();
      }
    },
    [fetchGoals]
  );

  const archiveGoal = useCallback(
    async (goalId: string) => {
      setGoals((prev) =>
        prev.map((g) =>
          g.id === goalId
            ? { ...g, status: "archived" as GoalSystemStatus }
            : g
        )
      );
      try {
        await updateGoalApi(goalId, { status: "archived" });
      } catch {
        fetchGoals();
      }
    },
    [fetchGoals]
  );

  const deleteGoal = useCallback(
    async (goalId: string) => {
      setGoals((prev) => prev.filter((g) => g.id !== goalId));
      try {
        await deleteGoalApi(goalId);
      } catch {
        fetchGoals();
      }
    },
    [fetchGoals]
  );

  const moveGoalToStatus = useCallback(
    async (goalId: string, newStatus: GoalSystemStatus) => {
      const now = new Date().toISOString();
      setGoals((prev) =>
        prev.map((g) => {
          if (g.id !== goalId) return g;
          return {
            ...g,
            status: newStatus,
            completed_at: newStatus === "completed" ? now : (g.status === "completed" ? null : g.completed_at),
          };
        })
      );
      try {
        const updates: Parameters<typeof updateGoalApi>[1] = { status: newStatus };
        if (newStatus === "completed") {
          updates.completed_at = now;
        } else {
          updates.completed_at = undefined;
        }
        await updateGoalApi(goalId, updates);
      } catch {
        fetchGoals();
      }
    },
    [fetchGoals]
  );

  const reorderGoalsByStatus = useCallback(
    async (goalIds: string[], status: GoalSystemStatus) => {
      // Optimistic position update
      setGoals((prev) =>
        prev.map((g) => {
          const idx = goalIds.indexOf(g.id);
          if (idx === -1) return g;
          return { ...g, position: idx, status };
        })
      );
      try {
        await reorderGoalsApi(goalIds, status);
      } catch {
        fetchGoals();
      }
    },
    [fetchGoals]
  );

  return {
    goals,
    activeGoals,
    inProgressGoals,
    completedGoals,
    loading,
    createGoal,
    updateGoal,
    completeGoal,
    archiveGoal,
    deleteGoal,
    moveGoalToStatus,
    reorderGoalsByStatus,
    fetchGoals,
  };
}
