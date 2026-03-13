"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useCurrentUser } from "./useCurrentUser";
import {
  getSessionTasks,
  addSessionTask,
  toggleSessionTask,
  deleteSessionTask,
} from "./sessionTasks";
import type { SessionTaskRecord } from "./types";

export function useSessionTasks(sessionId: string | null) {
  const { userId } = useCurrentUser();
  const [tasks, setTasks] = useState<SessionTaskRecord[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Track current sessionId to avoid stale updates
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  // ─── Fetch on sessionId change ─────────────────────────────
  useEffect(() => {
    if (!userId || !sessionId) {
      setTasks([]);
      setIsLoaded(true);
      return;
    }

    let cancelled = false;
    setIsLoaded(false);

    getSessionTasks(sessionId, userId)
      .then((data) => {
        if (cancelled) return;
        setTasks(data);
        setIsLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setIsLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, sessionId]);

  // ─── Add task (optimistic) ─────────────────────────────────
  const addTask = useCallback(
    (text: string) => {
      if (!userId || !sessionId) return;

      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const maxSort =
        tasks.length > 0
          ? Math.max(...tasks.map((t) => t.sort_order))
          : -1;

      const optimistic: SessionTaskRecord = {
        id,
        session_id: sessionId,
        user_id: userId,
        text,
        completed: false,
        sort_order: maxSort + 1,
        created_at: now,
        updated_at: now,
      };

      setTasks((prev) => [...prev, optimistic]);

      addSessionTask({
        id,
        session_id: sessionId,
        user_id: userId,
        text,
        sort_order: maxSort + 1,
      }).catch(() => {
        // Rollback on failure
        if (sessionIdRef.current === sessionId) {
          setTasks((prev) => prev.filter((t) => t.id !== id));
        }
      });
    },
    [userId, sessionId, tasks],
  );

  // ─── Toggle task (optimistic) ──────────────────────────────
  const toggleTask = useCallback(
    (taskId: string) => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, completed: !t.completed, updated_at: new Date().toISOString() }
            : t,
        ),
      );

      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      toggleSessionTask(taskId, !task.completed).catch(() => {
        // Rollback
        if (sessionIdRef.current === sessionId) {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === taskId ? { ...t, completed: task.completed } : t,
            ),
          );
        }
      });
    },
    [tasks, sessionId],
  );

  // ─── Delete task (optimistic) ──────────────────────────────
  const deleteTask = useCallback(
    (taskId: string) => {
      const removed = tasks.find((t) => t.id === taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));

      deleteSessionTask(taskId).catch(() => {
        // Rollback
        if (removed && sessionIdRef.current === sessionId) {
          setTasks((prev) => {
            const sorted = [...prev, removed].sort(
              (a, b) => a.sort_order - b.sort_order,
            );
            return sorted;
          });
        }
      });
    },
    [tasks, sessionId],
  );

  return { tasks, addTask, toggleTask, deleteTask, isLoaded };
}
