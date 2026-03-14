"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { Scaffolding } from "./scaffolding/generator";

// ─── Types ──────────────────────────────────────────────────

export interface CurriculumEntry {
  videoId: string;
  title: string;
  creator: string;
  sequencePosition: number;
  learningRationale: string;
  durationSeconds: number;
  tasteScore: number;
  scaffolding: Scaffolding | null;
  scaffoldingStatus: string | null;
  completed: boolean;
  onShelf: boolean;
  shelfItemId: string | null;
}

export interface UseCurriculumReturn {
  curriculum: CurriculumEntry[] | null;
  currentPosition: number;
  totalDurationMinutes: number;
  difficultyProgression: string;
  loading: boolean;
  markCompleted: (videoId: string) => void;
}

// ─── Hook ───────────────────────────────────────────────────

/**
 * Fetch and track curriculum progress for a room.
 * Returns null curriculum for rooms without a blueprint/curriculum.
 */
export function useCurriculum(
  partyId: string | null,
  userId: string | null
): UseCurriculumReturn {
  const [entries, setEntries] = useState<CurriculumEntry[] | null>(null);
  const [totalDurationMinutes, setTotalDurationMinutes] = useState(0);
  const [difficultyProgression, setDifficultyProgression] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!partyId || !userId) return;

    let cancelled = false;
    setLoading(true);

    fetch(`/api/breaks/curriculum?party_id=${encodeURIComponent(partyId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setEntries(data.curriculum ?? null);
        setTotalDurationMinutes(data.totalDurationMinutes ?? 0);
        setDifficultyProgression(data.difficultyProgression ?? "");
      })
      .catch(() => {
        if (!cancelled) setEntries(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [partyId, userId]);

  const currentPosition = useMemo(() => {
    if (!entries) return 0;
    const first = entries.find((e) => !e.completed && e.onShelf);
    return first?.sequencePosition ?? entries.length;
  }, [entries]);

  const markCompleted = useCallback((videoId: string) => {
    setEntries((prev) => {
      if (!prev) return prev;
      return prev.map((e) =>
        e.videoId === videoId ? { ...e, completed: true } : e
      );
    });
  }, []);

  return {
    curriculum: entries,
    currentPosition,
    totalDurationMinutes,
    difficultyProgression,
    loading,
    markCompleted,
  };
}
