"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  AchievementSummary,
  LearningPath,
  LearningProgress,
  ItemState,
  SkillReceipt,
} from "./types";

// ─── Types ──────────────────────────────────────────────────

interface UseLearnProgressReturn {
  path: LearningPath | null;
  progress: LearningProgress | null;
  achievement: AchievementSummary | null;
  currentItemIndex: number;
  isLoading: boolean;
  error: string | null;
  completeItem: (contentId: string, stateData?: Partial<ItemState>) => Promise<void>;
  advanceToItem: (index: number) => Promise<void>;
  isCompleted: boolean;
  percentComplete: number;
  skillReceipt: SkillReceipt | null;
}

// ─── Hook ───────────────────────────────────────────────────

/**
 * Manages learning path progress state.
 * Fetches path + progress on mount, provides mutation functions.
 */
export function useLearnProgress(pathId: string): UseLearnProgressReturn {
  const [path, setPath] = useState<LearningPath | null>(null);
  const [progress, setProgress] = useState<LearningProgress | null>(null);
  const [achievement, setAchievement] = useState<AchievementSummary | null>(null);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skillReceipt, setSkillReceipt] = useState<SkillReceipt | null>(null);
  const timeAccum = useRef(0);
  const timeInterval = useRef<ReturnType<typeof setInterval>>(undefined);

  // Fetch path and progress on mount
  useEffect(() => {
    let isActive = true;

    async function loadPath(): Promise<void> {
      setIsLoading(true);
      setError(null);
      setPath(null);
      setProgress(null);
      setAchievement(null);
      setSkillReceipt(null);
      setCurrentItemIndex(0);

      try {
        const res = await fetch(`/api/learn/paths/${pathId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        if (!isActive) return;

        setPath(data.path);
        setAchievement(data.achievement ?? null);

        if (data.progress) {
          setProgress(data.progress);
          setCurrentItemIndex(data.progress.current_item_index);

          // Fetch skill receipt for completed paths (for page refreshes)
          if (data.progress.status === "completed") {
            fetch(`/api/learn/skill-receipt/${pathId}`)
              .then((r) => r.json())
              .then((d) => {
                if (isActive && d.skill_receipt) {
                  setSkillReceipt(d.skill_receipt);
                }
              })
              .catch(() => {}); // Silent fail — receipt is enhancement, not critical
          }
        }
      } catch (err) {
        if (isActive) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    void loadPath();

    return () => {
      isActive = false;
    };
  }, [pathId]);

  // Time tracking: accumulate every second, flush every 30s (only when authenticated with progress)
  const progressRef = useRef<LearningProgress | null>(progress);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    timeInterval.current = setInterval(() => {
      timeAccum.current += 1;
      if (timeAccum.current >= 30 && progressRef.current) {
        const delta = timeAccum.current;
        timeAccum.current = 0;
        fetch(`/api/learn/paths/${pathId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ time_delta_seconds: delta }),
        }).catch(() => {});
      }
    }, 1000);

    return () => {
      if (timeInterval.current) clearInterval(timeInterval.current);
      // Flush remaining time on unmount
      if (timeAccum.current > 0 && progressRef.current) {
        const delta = timeAccum.current;
        timeAccum.current = 0;
        fetch(`/api/learn/paths/${pathId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ time_delta_seconds: delta }),
        }).catch(() => {});
      }
    };
  }, [pathId]);

  // Initialize progress if authenticated user has none
  useEffect(() => {
    if (!path || progress || isLoading) return;
    // Create initial progress record
    fetch(`/api/learn/paths/${pathId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_index: 0 }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.progress) setProgress(data.progress);
      })
      .catch(() => {});
  }, [path, progress, isLoading, pathId]);

  const completeItem = useCallback(
    async (contentId: string, stateData?: Partial<ItemState>) => {
      // Optimistic update so transition card works even without auth
      setProgress((prev) => {
        const itemStates = { ...(prev?.item_states ?? {}) };
        const existing = itemStates[contentId] ?? {};
        itemStates[contentId] = {
          ...existing,
          ...stateData,
          completed: true,
          completed_at: new Date().toISOString(),
        };
        const itemsCompleted = Object.values(itemStates).filter(
          (s) => s.completed
        ).length;
        const itemsTotal = path?.items.length ?? prev?.items_total ?? 0;
        return {
          id: prev?.id ?? "local",
          user_id: prev?.user_id ?? "anonymous",
          path_id: pathId,
          started_at: prev?.started_at ?? new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
          completed_at:
            itemsCompleted >= itemsTotal
              ? new Date().toISOString()
              : prev?.completed_at ?? null,
          current_item_index: prev?.current_item_index ?? currentItemIndex,
          items_completed: itemsCompleted,
          items_total: itemsTotal,
          time_invested_seconds: prev?.time_invested_seconds ?? 0,
          item_states: itemStates,
          status:
            itemsCompleted >= itemsTotal ? "completed" : "in_progress",
        };
      });

      // Persist to server
      try {
        const res = await fetch(`/api/learn/paths/${pathId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item_completed: contentId, item_state: stateData }),
        });
        const data = await res.json();
        if (data.progress) setProgress(data.progress);
        if (data.achievement) setAchievement(data.achievement);
        if (data.skill_receipt) setSkillReceipt(data.skill_receipt);
      } catch {
        // Optimistic update already applied
      }
    },
    [pathId, path, currentItemIndex]
  );

  const advanceToItem = useCallback(
    async (index: number) => {
      setCurrentItemIndex(index);
      try {
        const res = await fetch(`/api/learn/paths/${pathId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item_index: index }),
        });
        const data = await res.json();
        if (data.progress) setProgress(data.progress);
      } catch (err) {
        console.error("[useLearnProgress] advanceToItem failed:", err);
      }
    },
    [pathId]
  );

  const itemsTotal = path?.items.length ?? 0;
  const itemsCompleted = progress?.items_completed ?? 0;

  return {
    path,
    progress,
    achievement,
    currentItemIndex,
    isLoading,
    error,
    completeItem,
    advanceToItem,
    isCompleted: progress?.status === "completed",
    percentComplete:
      itemsTotal > 0 ? Math.round((itemsCompleted / itemsTotal) * 100) : 0,
    skillReceipt,
  };
}
