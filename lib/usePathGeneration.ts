"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { LearningPath } from "./types";
import { useProfile } from "./useProfile";

// ─── Types ──────────────────────────────────────────────────

type GenerationStatus = "idle" | "generating" | "complete" | "failed";

export interface UsePathGenerationReturn {
  status: GenerationStatus;
  generatedPath: LearningPath | null;
  elapsedMs: number;
  generate: (query: string) => void;
  retry: () => void;
  reset: () => void;
}

// ─── Constants ──────────────────────────────────────────────

const MAX_POLL_DURATION_MS = 120_000; // 2 minutes
const INITIAL_POLL_INTERVAL_MS = 3000;
const MAX_POLL_INTERVAL_MS = 6000;

/** Step definitions for generation progress UI */
export const GENERATION_STEPS = [
  { label: "Searching for the best content", thresholdMs: 0 },
  { label: "Curating videos and resources", thresholdMs: 5_000 },
  { label: "Building your curriculum", thresholdMs: 12_000 },
  { label: "Finalizing your learning path", thresholdMs: 22_000 },
] as const;

// ─── Hook ───────────────────────────────────────────────────

/**
 * Manages explicit, user-triggered path generation.
 * Call generate(query) to start; poll status via the returned fields.
 */
export function usePathGeneration(): UsePathGenerationReturn {
  const { profile } = useProfile();

  // Stabilize profile values
  const userFunctionRef = useRef(profile?.primary_function ?? null);
  const userFluencyRef = useRef(profile?.fluency_level ?? null);
  const secondaryFunctionsRef = useRef(profile?.secondary_functions ?? null);
  userFunctionRef.current = profile?.primary_function ?? null;
  userFluencyRef.current = profile?.fluency_level ?? null;
  secondaryFunctionsRef.current = profile?.secondary_functions ?? null;

  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [generatedPath, setGeneratedPath] = useState<LearningPath | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const pollRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const abortRef = useRef<AbortController>(undefined);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const startTimeRef = useRef(0);
  const lastQueryRef = useRef("");

  /** Stop polling and elapsed timer */
  const cancel = useCallback(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = undefined;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = undefined;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  /** Reset all state back to idle */
  const reset = useCallback(() => {
    cancel();
    setStatus("idle");
    setGeneratedPath(null);
    setElapsedMs(0);
  }, [cancel]);

  /** Start generation for a query */
  const generate = useCallback(
    (query: string) => {
      cancel();

      const fn = userFunctionRef.current;
      const flu = userFluencyRef.current;
      const sec = secondaryFunctionsRef.current;

      const abort = new AbortController();
      abortRef.current = abort;
      lastQueryRef.current = query;
      setStatus("generating");
      setGeneratedPath(null);
      setElapsedMs(0);

      // Start elapsed timer
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startTimeRef.current);
      }, 1000);

      // POST to start generation
      const body: Record<string, unknown> = { query };
      if (fn) body.function = fn;
      if (flu) body.fluency = flu;
      if (sec?.length) body.secondary_functions = sec;

      fetch("/api/learn/search/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abort.signal,
      })
        .then((res) => {
          if (!res.ok) {
            setStatus("failed");
            cancel();
            return;
          }
          return res.json();
        })
        .then((data) => {
          if (!data || abort.signal.aborted) return;

          const { generation_id } = data;
          let interval = INITIAL_POLL_INTERVAL_MS;

          // Recursive polling with exponential backoff
          const poll = async () => {
            const elapsed = Date.now() - startTimeRef.current;
            if (abort.signal.aborted || elapsed >= MAX_POLL_DURATION_MS) {
              if (!abort.signal.aborted) {
                setStatus("failed");
                cancel();
              }
              return;
            }

            try {
              const params = new URLSearchParams({ generation_id });
              const res = await fetch(
                `/api/learn/search/generate?${params}`,
                { signal: abort.signal },
              );
              const pollData = await res.json();

              if (pollData.status === "complete" && pollData.path) {
                setGeneratedPath(pollData.path);
                setStatus("complete");
                cancel();
                return;
              }

              if (pollData.status === "failed") {
                setStatus("failed");
                cancel();
                return;
              }

              // Exponential backoff: 1.5s → 2.25s → 3.4s → 5s → 6s (capped)
              interval = Math.min(interval * 1.5, MAX_POLL_INTERVAL_MS);
              pollRef.current = setTimeout(poll, interval);
            } catch {
              if (!abort.signal.aborted) {
                setStatus("failed");
                cancel();
              }
            }
          };

          pollRef.current = setTimeout(poll, INITIAL_POLL_INTERVAL_MS);
        })
        .catch(() => {
          if (!abort.signal.aborted) {
            setStatus("failed");
            cancel();
          }
        });
    },
    [cancel],
  );

  /** Retry the last query */
  const retry = useCallback(() => {
    const q = lastQueryRef.current;
    if (q) generate(q);
  }, [generate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cancel();
  }, [cancel]);

  return { status, generatedPath, elapsedMs, generate, retry, reset };
}
