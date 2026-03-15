"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { LearningPath, LearningProgress } from "./types";

// ─── Types ──────────────────────────────────────────────────

interface PathWithProgress {
  path: LearningPath;
  progress: LearningProgress;
}

type GenerationStatus = "idle" | "generating" | "complete" | "failed";

interface UseLearnSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  discoveryPaths: LearningPath[];
  inProgressPaths: PathWithProgress[];
  isLoading: boolean;
  error: string | null;
  message: string | null;
  hasSearched: boolean;
  setQueryFromTopic: (slug: string) => void;
  generationStatus: GenerationStatus;
  retryGeneration: () => void;
}

const MAX_POLLS = 30;
const POLL_INTERVAL_MS = 2000;

// ─── Hook ───────────────────────────────────────────────────

/**
 * Manages Learn search state with two-phase pattern:
 * Phase 1: Instant cache lookup via /api/learn/search
 * Phase 2: Background generation + polling if cache is thin
 */
export function useLearnSearch(): UseLearnSearchReturn {
  const [query, setQuery] = useState("");
  const [discoveryPaths, setDiscoveryPaths] = useState<LearningPath[]>([]);
  const [inProgressPaths, setInProgressPaths] = useState<PathWithProgress[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [generationStatus, setGenerationStatus] =
    useState<GenerationStatus>("idle");

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pollRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const abortRef = useRef<AbortController>(undefined);
  const currentQueryRef = useRef("");

  const setQueryFromTopic = useCallback((slug: string) => {
    const readable = slug.replace(/-/g, " ");
    setQuery(readable);
  }, []);

  /** Cancel any in-flight generation polling */
  const cancelGeneration = useCallback(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = undefined;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = undefined;
    }
    setGenerationStatus("idle");
  }, []);

  /** Fetch search results (Phase 1) */
  const fetchSearch = useCallback(
    async (q: string, signal?: AbortSignal): Promise<boolean> => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);

      const res = await fetch(`/api/learn/search?${params}`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setDiscoveryPaths(data.discovery ?? []);
      setInProgressPaths(data.in_progress ?? []);
      if (data.message) setMessage(data.message);
      else setMessage(null);
      if (q) setHasSearched(true);

      return data.should_generate === true;
    },
    []
  );

  /** Start background generation + polling (Phase 2) */
  const startGeneration = useCallback(
    async (q: string) => {
      cancelGeneration();

      const abort = new AbortController();
      abortRef.current = abort;
      setGenerationStatus("generating");

      try {
        // POST to start generation
        const postRes = await fetch("/api/learn/search/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q }),
          signal: abort.signal,
        });

        if (!postRes.ok) {
          setGenerationStatus("failed");
          return;
        }

        const { generation_id, query: normalizedQuery } = await postRes.json();
        let attempts = 0;

        // Recursive setTimeout polling
        const poll = async () => {
          if (abort.signal.aborted || attempts >= MAX_POLLS) {
            if (!abort.signal.aborted) setGenerationStatus("failed");
            return;
          }

          attempts++;

          try {
            const params = new URLSearchParams({
              generation_id,
              query: normalizedQuery,
            });
            const res = await fetch(
              `/api/learn/search/generate?${params}`,
              { signal: abort.signal }
            );
            const data = await res.json();

            if (data.status === "complete") {
              // Re-fetch search to get the new path in results
              setGenerationStatus("complete");
              try {
                await fetchSearch(q, abort.signal);
              } catch {
                // Search re-fetch failed — still mark generation done
              }
              setGenerationStatus("idle");
              return;
            }

            if (data.status === "failed") {
              setGenerationStatus("failed");
              return;
            }

            // Still generating — poll again
            pollRef.current = setTimeout(poll, POLL_INTERVAL_MS);
          } catch {
            if (!abort.signal.aborted) setGenerationStatus("failed");
          }
        };

        pollRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      } catch {
        if (!abort.signal.aborted) setGenerationStatus("failed");
      }
    },
    [cancelGeneration, fetchSearch]
  );

  /** Retry generation with the current query */
  const retryGeneration = useCallback(() => {
    const q = currentQueryRef.current;
    if (q) startGeneration(q);
  }, [startGeneration]);

  // ─── Debounced search effect ──────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    cancelGeneration();

    const trimmed = query.trim();
    currentQueryRef.current = trimmed;
    const delay = trimmed ? 500 : 0;

    debounceRef.current = setTimeout(() => {
      setIsLoading(true);
      setError(null);
      setMessage(null);

      const abort = new AbortController();

      fetchSearch(trimmed, abort.signal)
        .then((shouldGenerate) => {
          setIsLoading(false);
          // Phase 2: trigger background generation if needed
          if (shouldGenerate && trimmed) {
            startGeneration(trimmed);
          }
        })
        .catch((err) => {
          if (!abort.signal.aborted) {
            setError(err.message);
            setIsLoading(false);
          }
        });
    }, delay);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, cancelGeneration, fetchSearch, startGeneration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelGeneration();
    };
  }, [cancelGeneration]);

  return {
    query,
    setQuery,
    discoveryPaths,
    inProgressPaths,
    isLoading,
    error,
    message,
    hasSearched,
    setQueryFromTopic,
    generationStatus,
    retryGeneration,
  };
}
