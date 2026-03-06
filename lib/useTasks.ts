"use client";

import { useState, useCallback, useMemo } from "react";
import type { Task } from "@/lib/types";

const TASKS_KEY = "focusparty-tasks";
const ACTIVE_TASK_KEY = "focusparty-active-task";

/* ─── localStorage helpers ────────────────────────────────── */

function loadTasks(): Task[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function persistTasks(tasks: Task[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

function loadActiveTaskId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_TASK_KEY);
}

function persistActiveTaskId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(ACTIVE_TASK_KEY, id);
  else localStorage.removeItem(ACTIVE_TASK_KEY);
}

/* ─── Hook ────────────────────────────────────────────────── */

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(loadActiveTaskId);

  const addTask = useCallback((text: string): Task => {
    const task: Task = {
      id: crypto.randomUUID(),
      text: text.trim(),
      completed: false,
      createdAt: Date.now(),
      completedAt: null,
    };
    setTasks((prev) => {
      const next = [task, ...prev];
      persistTasks(next);
      return next;
    });
    return task;
  }, []);

  const completeTask = useCallback((taskId: string) => {
    setTasks((prev) => {
      const next = prev.map((t) =>
        t.id === taskId ? { ...t, completed: true, completedAt: Date.now() } : t
      );
      persistTasks(next);
      return next;
    });
  }, []);

  const deleteTask = useCallback((taskId: string) => {
    setTasks((prev) => {
      const next = prev.filter((t) => t.id !== taskId);
      persistTasks(next);
      return next;
    });
    setActiveTaskId((prev) => {
      if (prev === taskId) {
        persistActiveTaskId(null);
        return null;
      }
      return prev;
    });
  }, []);

  const selectTask = useCallback((taskId: string | null) => {
    setActiveTaskId(taskId);
    persistActiveTaskId(taskId);
  }, []);

  const activeTask = useMemo(
    () => tasks.find((t) => t.id === activeTaskId) ?? null,
    [tasks, activeTaskId]
  );

  const activeTasks = useMemo(
    () => tasks.filter((t) => !t.completed).sort((a, b) => b.createdAt - a.createdAt),
    [tasks]
  );

  const completedTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.completed)
        .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)),
    [tasks]
  );

  return {
    tasks,
    activeTasks,
    completedTasks,
    activeTask,
    activeTaskId,
    addTask,
    completeTask,
    deleteTask,
    selectTask,
  };
}
