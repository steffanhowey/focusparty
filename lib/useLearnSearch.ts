"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { LearningPath, LearningProgress } from "./types";
import { useProfile } from "./useProfile";

// ─── Types ──────────────────────────────────────────────────

interface PathWithProgress {
  path: LearningPath;
  progress: LearningProgress;
}

interface UseLearnSearchReturn {
  query: string;
  setQuery: (q: string) => void;

  // Discovery grid (no-query state)
  discoveryPaths: LearningPath[];
  inProgressPaths: PathWithProgress[];
  /** True only on initial load (no results yet). Use for skeleton grid. */
  isLoading: boolean;

  // Dropdown search (with-query state)
  searchResults: LearningPath[];
  /** True during any search fetch. Use for spinner. */
  isSearching: boolean;
  hasSearched: boolean;
  /** True when cache is thin — UI should show "Build Path" option */
  shouldOfferGeneration: boolean;

  error: string | null;
  message: string | null;
  setQueryFromTopic: (slug: string) => void;
}

const DEBOUNCE_MS = 200;
const DEBOUNCE_INSTANT = 0;

// ─── Hook ───────────────────────────────────────────────────

/**
 * Manages Learn search state.
 * Returns discovery paths for the grid (no query) and
 * search results for the dropdown (with query).
 * Generation is NOT triggered here — see usePathGeneration.
 */
export function useLearnSearch(): UseLearnSearchReturn {
  const { profile } = useProfile();

  // Stabilize profile values to prevent callback/effect churn
  const userFunction = profile?.primary_function ?? null;
  const userFluency = profile?.fluency_level ?? null;
  const userFunctionRef = useRef(userFunction);
  const userFluencyRef = useRef(userFluency);
  userFunctionRef.current = userFunction;
  userFluencyRef.current = userFluency;

  const [query, setQuery] = useState("");
  const [discoveryPaths, setDiscoveryPaths] = useState<LearningPath[]>([]);
  const [searchResults, setSearchResults] = useState<LearningPath[]>([]);
  const [inProgressPaths, setInProgressPaths] = useState<PathWithProgress[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [shouldOfferGeneration, setShouldOfferGeneration] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const searchAbortRef = useRef<AbortController>(undefined);
  // When true, next search fires immediately (0ms debounce)
  const instantRef = useRef(false);

  const setQueryFromTopic = useCallback((slug: string) => {
    const readable = slug.replace(/-/g, " ");
    instantRef.current = true;
    setQuery(readable);
  }, []);

  /** Fetch search results from the API */
  const fetchSearch = useCallback(
    async (q: string, signal: AbortSignal): Promise<void> => {
      const fn = userFunctionRef.current;
      const flu = userFluencyRef.current;

      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (fn) params.set("function", fn);
      if (flu) params.set("fluency", flu);

      const res = await fetch(`/api/learn/search?${params}`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (signal.aborted) return;

      if (q) {
        // With query → populate dropdown search results
        setSearchResults(data.discovery ?? []);
        setShouldOfferGeneration(data.should_generate === true);
        setHasSearched(true);
      } else {
        // No query → populate discovery grid
        setDiscoveryPaths(data.discovery ?? []);
        setSearchResults([]);
        setShouldOfferGeneration(false);
      }

      setInProgressPaths(data.in_progress ?? []);
      if (data.message) setMessage(data.message);
      else setMessage(null);
    },
    [], // stable — reads from refs
  );

  // ─── Debounced search effect ──────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Abort any previous in-flight search fetch
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }

    const trimmed = query.trim();

    // Use instant (0ms) for: empty query, topic pill clicks
    const useInstant = instantRef.current || !trimmed;
    instantRef.current = false;
    const delay = useInstant ? DEBOUNCE_INSTANT : DEBOUNCE_MS;

    // On first load (no results yet), show full skeletons.
    const hasResults = discoveryPaths.length > 0 || inProgressPaths.length > 0;

    debounceRef.current = setTimeout(() => {
      if (!hasResults) setIsLoading(true);
      setIsSearching(true);
      setError(null);
      setMessage(null);

      const abort = new AbortController();
      searchAbortRef.current = abort;

      fetchSearch(trimmed, abort.signal)
        .then(() => {
          if (abort.signal.aborted) return;
          setIsLoading(false);
          setIsSearching(false);
        })
        .catch((err) => {
          if (!abort.signal.aborted) {
            setError(err.message);
            setIsLoading(false);
            setIsSearching(false);
          }
        });
    }, delay);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchSearch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchAbortRef.current) searchAbortRef.current.abort();
    };
  }, []);

  return {
    query,
    setQuery,
    discoveryPaths,
    inProgressPaths,
    isLoading,
    searchResults,
    isSearching,
    hasSearched,
    shouldOfferGeneration,
    error,
    message,
    setQueryFromTopic,
  };
}
