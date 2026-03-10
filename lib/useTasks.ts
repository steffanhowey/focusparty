"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { createClient } from "./supabase/client";
import { useCurrentUser } from "./useCurrentUser";
import type { TaskRecord, TaskStatus, TaskPriority } from "./types";
import {
  listTasks,
  createTask,
  updateTask as updateTaskApi,
  deleteTask as deleteTaskApi,
  reorderTasks as reorderTasksApi,
} from "./tasks";

const MIGRATION_KEY = "focusparty-tasks-migrated";
const OLD_TASKS_KEY = "focusparty-tasks";
const ACTIVE_TASK_KEY = "focusparty-active-task";

/* ─── localStorage → Supabase migration ─────────────────────── */

interface OldTask {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  completedAt: number | null;
}

async function migrateLocalStorageTasks(userId: string) {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(MIGRATION_KEY)) return;

  try {
    const raw = localStorage.getItem(OLD_TASKS_KEY);
    if (!raw) {
      localStorage.setItem(MIGRATION_KEY, "true");
      return;
    }
    const oldTasks: OldTask[] = JSON.parse(raw);
    if (!oldTasks.length) {
      localStorage.setItem(MIGRATION_KEY, "true");
      return;
    }

    // Batch insert old tasks
    for (let i = 0; i < oldTasks.length; i++) {
      const t = oldTasks[i];
      await createTask({
        user_id: userId,
        title: t.text,
        status: t.completed ? "done" : "todo",
        position: i,
      });
    }

    localStorage.setItem(MIGRATION_KEY, "true");
    localStorage.removeItem(OLD_TASKS_KEY);
    localStorage.removeItem(ACTIVE_TASK_KEY);
  } catch {
    // Fail gracefully — new tasks still work
    console.warn("Task migration from localStorage failed");
  }
}

/* ─── Hook ────────────────────────────────────────────────── */

export function useTasks() {
  const { userId } = useCurrentUser();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const migrated = useRef(false);

  // Fetch tasks on mount & after migration
  const fetchTasks = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await listTasks();
      setTasks(data);
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Initial load + one-time migration
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const init = async () => {
      if (!migrated.current) {
        migrated.current = true;
        await migrateLocalStorageTasks(userId);
      }
      await fetchTasks();
    };
    init();
  }, [userId, fetchTasks]);

  // Realtime subscription — apply incremental updates instead of full refetch
  useEffect(() => {
    if (!userId) return;

    const client = createClient();
    const channel = client
      .channel(`tasks-realtime-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "fp_tasks",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newTask = payload.new as TaskRecord;
          setTasks((prev) => {
            // Skip if we already have this task (optimistic insert)
            if (prev.some((t) => t.id === newTask.id)) return prev;
            return [newTask, ...prev];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "fp_tasks",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as TaskRecord;
          setTasks((prev) =>
            prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t))
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "fp_tasks",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const deletedId = (payload.old as { id: string }).id;
          setTasks((prev) => prev.filter((t) => t.id !== deletedId));
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [userId]);

  // ─── Derived lists ──────────────────────────────────────────

  const activeTasks = useMemo(
    () => tasks.filter((t) => t.status !== "done"),
    [tasks]
  );

  const completedTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.status === "done")
        .sort(
          (a, b) =>
            new Date(b.completed_at ?? b.updated_at).getTime() -
            new Date(a.completed_at ?? a.updated_at).getTime()
        ),
    [tasks]
  );

  const todoTasks = useMemo(
    () => tasks.filter((t) => t.status === "todo"),
    [tasks]
  );

  const inProgressTasks = useMemo(
    () => tasks.filter((t) => t.status === "in_progress"),
    [tasks]
  );

  const doneTasks = completedTasks;

  const activeTask = useMemo(
    () => tasks.find((t) => t.id === activeTaskId) ?? null,
    [tasks, activeTaskId]
  );

  // ─── Mutations ──────────────────────────────────────────────

  const addTask = useCallback(
    async (
      titleOrInput: string | {
        title: string;
        status?: TaskStatus;
        priority?: TaskPriority;
        project_id?: string | null;
        goal_id?: string | null;
        description?: string | null;
        ai_generated?: boolean;
      }
    ): Promise<string | null> => {
      if (!userId) return null;

      const input = typeof titleOrInput === "string"
        ? { title: titleOrInput }
        : titleOrInput;
      const trimmed = input.title.trim();
      if (!trimmed) return null;

      const status = input.status ?? "todo";
      const priority = input.priority ?? "none";
      const project_id = input.project_id ?? null;
      const goal_id = input.goal_id ?? null;
      const description = input.description ?? null;
      const ai_generated = input.ai_generated ?? false;

      // Optimistic: add to front
      const optimistic: TaskRecord = {
        id: crypto.randomUUID(),
        user_id: userId,
        project_id,
        goal_id,
        title: trimmed,
        description,
        status,
        priority,
        ai_generated,
        position: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: status === "done" ? new Date().toISOString() : null,
      };
      setTasks((prev) => [optimistic, ...prev]);

      try {
        const created = await createTask({
          user_id: userId,
          title: trimmed,
          status,
          priority,
          project_id,
          goal_id,
          description,
          ai_generated,
        });
        // Replace optimistic with real
        setTasks((prev) =>
          prev.map((t) => (t.id === optimistic.id ? created : t))
        );
        return created.id;
      } catch (err) {
        console.error("Failed to create task:", err);
        // Revert optimistic
        setTasks((prev) => prev.filter((t) => t.id !== optimistic.id));
        return null;
      }
    },
    [userId]
  );

  const completeTask = useCallback(
    async (taskId: string) => {
      const now = new Date().toISOString();
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status: "done" as TaskStatus, completed_at: now }
            : t
        )
      );
      if (activeTaskId === taskId) setActiveTaskId(null);

      try {
        await updateTaskApi(taskId, { status: "done", completed_at: now });
      } catch {
        fetchTasks(); // revert
      }
    },
    [activeTaskId, fetchTasks]
  );

  const uncompleteTask = useCallback(
    async (taskId: string) => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status: "todo" as TaskStatus, completed_at: null }
            : t
        )
      );

      try {
        await updateTaskApi(taskId, { status: "todo", completed_at: null });
      } catch {
        fetchTasks();
      }
    },
    [fetchTasks]
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      if (activeTaskId === taskId) setActiveTaskId(null);

      try {
        await deleteTaskApi(taskId);
      } catch {
        fetchTasks();
      }
    },
    [activeTaskId, fetchTasks]
  );

  const editTask = useCallback(
    async (taskId: string, newTitle: string) => {
      const trimmed = newTitle.trim();
      if (!trimmed) return;

      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, title: trimmed } : t))
      );

      try {
        await updateTaskApi(taskId, { title: trimmed });
      } catch {
        fetchTasks();
      }
    },
    [fetchTasks]
  );

  const updateTaskFull = useCallback(
    async (
      taskId: string,
      updates: Partial<
        Pick<TaskRecord, "title" | "description" | "status" | "priority" | "project_id" | "goal_id" | "position" | "completed_at">
      >
    ) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
      );

      try {
        await updateTaskApi(taskId, updates);
      } catch {
        fetchTasks();
      }
    },
    [fetchTasks]
  );

  const selectTask = useCallback(
    async (taskId: string | null) => {
      setActiveTaskId(taskId);
      // Auto-move to in_progress when selected for a session
      if (taskId) {
        const task = tasks.find((t) => t.id === taskId);
        if (task && task.status === "todo") {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === taskId ? { ...t, status: "in_progress" as TaskStatus } : t
            )
          );
          try {
            await updateTaskApi(taskId, { status: "in_progress" });
          } catch {
            fetchTasks();
          }
        }
      }
    },
    [tasks, fetchTasks]
  );

  const reorderTasks = useCallback(
    async (activeId: string, overId: string) => {
      setTasks((prev) => {
        const oldIndex = prev.findIndex((t) => t.id === activeId);
        const newIndex = prev.findIndex((t) => t.id === overId);
        if (oldIndex === -1 || newIndex === -1) return prev;
        const next = [...prev];
        const [removed] = next.splice(oldIndex, 1);
        next.splice(newIndex, 0, removed);
        return next;
      });
      // Fire-and-forget: let realtime handle sync
    },
    []
  );

  const reorderTasksByStatus = useCallback(
    async (taskIds: string[], status: TaskStatus) => {
      try {
        await reorderTasksApi(taskIds, status);
      } catch {
        fetchTasks();
      }
    },
    [fetchTasks]
  );

  return {
    // Backward-compatible
    activeTasks,
    completedTasks,
    activeTask,
    addTask,
    completeTask,
    uncompleteTask,
    deleteTask,
    editTask,
    selectTask,
    reorderTasks,
    // New
    todoTasks,
    inProgressTasks,
    doneTasks,
    loading,
    tasks,
    updateTask: updateTaskFull,
    reorderTasksByStatus,
    fetchTasks,
  };
}
