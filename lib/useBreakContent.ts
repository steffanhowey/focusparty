"use client";

import { useState, useEffect, useMemo } from "react";
import type { BreakContentItem, BreakDuration, BreakCategory } from "./types";

// ─── Clip type ──────────────────────────────────────────────

export interface BreakClip {
  clipId: string;
  label: string;
  duration: BreakDuration;
  startSeconds: number;
  sourceItem: BreakContentItem;
}

// ─── Transform items → clips ────────────────────────────────

const VALID_DURATIONS: BreakDuration[] = [3, 5, 10];

/**
 * Each item produces a clip for every valid duration the video can support.
 * If the item has explicit segments, each segment becomes a clip.
 * Otherwise a single clip at best_duration (or heuristic) is produced.
 */
function itemsToClips(items: BreakContentItem[]): BreakClip[] {
  const clips: BreakClip[] = [];
  // Deduplicate: only one clip per video_url + duration
  const seen = new Set<string>();

  for (const item of items) {
    const videoLen = item.duration_seconds ?? 0;
    const videoKey = item.video_url ?? item.id;

    if (item.segments && item.segments.length > 0) {
      // Produce a clip for each segment whose duration the video can support
      for (const seg of item.segments) {
        const d = seg.duration as BreakDuration;
        if (!VALID_DURATIONS.includes(d)) continue;
        if (videoLen > 0 && videoLen < d * 60) continue;
        const dedup = `${videoKey}:${d}`;
        if (seen.has(dedup)) continue;
        seen.add(dedup);
        clips.push({
          clipId: `${item.id}:${d}`,
          label: seg.label ?? item.title,
          duration: d,
          startSeconds: seg.start ?? 0,
          sourceItem: item,
        });
      }
    } else {
      // Fallback: single clip at best_duration or heuristic
      const duration = (item.best_duration ?? durationFromLength(videoLen)) as BreakDuration;
      const dedup = `${videoKey}:${duration}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      clips.push({
        clipId: item.id,
        label: item.title,
        duration,
        startSeconds: 0,
        sourceItem: item,
      });
    }
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
  category?: BreakCategory
): UseBreakContentReturn {
  const [items, setItems] = useState<BreakContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomWorldKey) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ room_world_key: roomWorldKey });
    if (category) params.set("category", category);

    fetch(`/api/breaks/content?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setItems(data.items ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [roomWorldKey, category]);

  const clips = useMemo(() => itemsToClips(items), [items]);

  return { items, clips, loading, error };
}
