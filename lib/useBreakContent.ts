"use client";

import { useState, useEffect } from "react";
import type { BreakContentItem } from "./types";

interface UseBreakContentReturn {
  items: BreakContentItem[];
  loading: boolean;
  error: string | null;
}

/**
 * Fetches curated break content for a given world + category.
 * Simple fetch-on-mount — no realtime needed.
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

  return { items, loading, error };
}
