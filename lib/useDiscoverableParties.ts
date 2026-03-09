"use client";

import { useState, useEffect } from "react";
import { listDiscoverableParties, type PartyWithCount } from "./parties";

export interface UseDiscoverablePartiesResult {
  parties: PartyWithCount[];
  loading: boolean;
  error: string | null;
}

/**
 * Fetches discoverable parties (waiting + active) on mount.
 * No realtime subscription — that will be added alongside
 * presence channels in a future phase.
 */
export function useDiscoverableParties(): UseDiscoverablePartiesResult {
  const [parties, setParties] = useState<PartyWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await listDiscoverableParties();
        if (cancelled) return;
        setParties(result);
      } catch (err) {
        console.error("[useDiscoverableParties] load error:", err);
        if (!cancelled) setError("Failed to load rooms");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { parties, loading, error };
}
