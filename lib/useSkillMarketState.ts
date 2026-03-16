"use client";

/**
 * Hook for fetching skill market state data.
 * Returns a map of skill_slug → SkillMarketState.
 */

import { useState, useEffect } from "react";
import type { SkillMarketState } from "@/lib/types/intelligence";

interface UseSkillMarketStateResult {
  states: Map<string, SkillMarketState>;
  trending: SkillMarketState[];
  isLoading: boolean;
}

export function useSkillMarketState(): UseSkillMarketStateResult {
  const [states, setStates] = useState<Map<string, SkillMarketState>>(
    new Map()
  );
  const [trending, setTrending] = useState<SkillMarketState[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const res = await fetch("/api/intelligence/market-state");
        if (!res.ok) return;
        const json = (await res.json()) as { states: SkillMarketState[] };
        if (cancelled) return;

        const map = new Map<string, SkillMarketState>();
        for (const s of json.states ?? []) {
          map.set(s.skill_slug, s);
        }
        setStates(map);

        // Extract trending
        setTrending(
          (json.states ?? [])
            .filter(
              (s) => s.direction === "rising" || s.direction === "emerging"
            )
            .sort((a, b) => b.velocity - a.velocity)
            .slice(0, 6)
        );
      } catch {
        // Silent fail — market state is supplementary
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { states, trending, isLoading };
}
