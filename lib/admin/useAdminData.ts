"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseAdminDataResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  mutate: (updater: (prev: T | null) => T | null) => void;
  lastUpdated: Date | null;
}

/**
 * Polling data hook for admin views. Fetches JSON from the given URL
 * with credentials, supports auto-refresh and optimistic updates.
 */
export function useAdminData<T>(
  url: string,
  options?: { refreshInterval?: number; initialData?: T }
): UseAdminDataResult<T> {
  const [data, setData] = useState<T | null>(options?.initialData ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      if (mountedRef.current) {
        setData(json);
        setError(null);
        setLastUpdated(new Date());
        setLoading(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      }
    }
  }, [url]);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    fetchData();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchData]);

  // Polling
  useEffect(() => {
    if (!options?.refreshInterval) return;
    const id = setInterval(fetchData, options.refreshInterval);
    return () => clearInterval(id);
  }, [fetchData, options?.refreshInterval]);

  const mutate = useCallback(
    (updater: (prev: T | null) => T | null) => {
      setData(updater);
    },
    []
  );

  return { data, loading, error, refresh: fetchData, mutate, lastUpdated };
}
