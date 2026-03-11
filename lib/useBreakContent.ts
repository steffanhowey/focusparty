"use client";

import { useState, useEffect, useMemo } from "react";
import type { BreakContentItem, BreakDuration } from "./types";

// ─── Clip type ──────────────────────────────────────────────

export interface BreakClip {
  clipId: string;
  label: string;
  duration: BreakDuration;
  startSeconds: number;
  sourceItem: BreakContentItem;
}

// ─── Transform items → clips ────────────────────────────────

/**
 * Each item produces ONE clip at its best_duration.
 * Items without best_duration fall back to a heuristic based on video length.
 */
function itemsToClips(items: BreakContentItem[]): BreakClip[] {
  const clips: BreakClip[] = [];

  for (const item of items) {
    const duration = (item.best_duration ?? durationFromLength(item.duration_seconds)) as BreakDuration;
    const segment = item.segments?.find((s) => s.duration === duration);

    clips.push({
      clipId: item.id,
      label: segment?.label ?? item.title,
      duration,
      startSeconds: segment?.start ?? 0,
      sourceItem: item,
    });
  }

  return clips;
}

function durationFromLength(seconds: number | null): number {
  if (!seconds) return 5;
  if (seconds < 480) return 3;   // < 8 min → 3-min clip
  if (seconds < 720) return 5;   // 8-12 min → 5-min clip
  return 10;                      // 12+ min → 10-min clip
}

// ─── Hook ───────────────────────────────────────────────────

interface UseBreakContentReturn {
  items: BreakContentItem[];
  clips: BreakClip[];
  loading: boolean;
  error: string | null;
}

/**
 * Fetches curated break content for a given world + category.
 * Returns both raw items and exploded clips (one per segment per item).
 */
export function useBreakContent(
  roomWorldKey: string | null,
  category?: string
): UseBreakContentReturn {
  const [items, setItems] = useState<BreakContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomWorldKey) return;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ room_world_key: roomWorldKey });
    if (category) params.set("category", category);

    fetch(`/api/breaks/content?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setItems(data.items ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [roomWorldKey, category]);

  const clips = useMemo(() => itemsToClips(items), [items]);

  return { items, clips, loading, error };
}
