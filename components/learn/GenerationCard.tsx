"use client";

import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Loader2, AlertCircle, Search, BookOpen, Sparkles } from "lucide-react";

interface GenerationCardProps {
  status: "generating" | "failed";
  query: string;
  onRetry: () => void;
}

const GENERATION_STEPS = [
  { label: "Finding content", icon: Search, durationMs: 0 },
  { label: "Building curriculum", icon: BookOpen, durationMs: 8_000 },
  { label: "Finalizing path", icon: Sparkles, durationMs: 25_000 },
] as const;

/**
 * Placeholder card shown in the results grid while a learning path
 * is being generated in the background. Matches PathCard dimensions.
 */
export function GenerationCard({ status, query, onRetry }: GenerationCardProps) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef(Date.now());

  // Reset timer when status changes to generating
  useEffect(() => {
    if (status !== "generating") return;
    startRef.current = Date.now();
    setElapsedMs(0);
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - startRef.current);
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  // Determine which step we're on based on elapsed time
  const currentStepIndex =
    status === "generating"
      ? GENERATION_STEPS.reduce(
          (idx, step, i) => (elapsedMs >= step.durationMs ? i : idx),
          0
        )
      : -1;

  const elapsedSec = Math.floor(elapsedMs / 1000);

  return (
    <Card className="overflow-hidden">
      {/* Thumbnail area — matches PathCard aspect-video */}
      <div
        className="relative aspect-video flex items-center justify-center"
        style={{
          background:
            "linear-gradient(135deg, var(--color-bg-secondary), var(--color-bg-hover))",
        }}
      >
        {status === "generating" ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2
              size={28}
              className="text-[var(--color-text-tertiary)] animate-spin"
            />
            {/* Step indicators */}
            <div className="flex flex-col gap-1.5 items-start px-6 w-full">
              {GENERATION_STEPS.map((step, i) => {
                const StepIcon = step.icon;
                const isActive = i === currentStepIndex;
                const isDone = i < currentStepIndex;
                return (
                  <div
                    key={step.label}
                    className="flex items-center gap-2 transition-opacity duration-300"
                    style={{ opacity: isDone ? 0.4 : isActive ? 1 : 0.25 }}
                  >
                    <StepIcon size={12} className="text-[var(--color-text-tertiary)]" />
                    <span
                      className={`text-xs ${
                        isActive
                          ? "text-[var(--color-text-secondary)] font-medium"
                          : "text-[var(--color-text-tertiary)]"
                      }`}
                    >
                      {step.label}{isActive ? "..." : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <AlertCircle
            size={32}
            className="text-[var(--color-coral-700)]"
          />
        )}
      </div>

      {/* Content area — matches PathCard p-3 space-y-2 */}
      <div className="p-3 space-y-2">
        {status === "generating" ? (
          <>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
              Building a learning path
            </h3>
            <div className="flex items-center justify-between">
              <p className="text-xs text-[var(--color-text-tertiary)] line-clamp-1 flex-1">
                {query}
              </p>
              <span className="text-xs text-[var(--color-text-tertiary)] tabular-nums ml-2 shrink-0">
                {elapsedSec}s
              </span>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
              Couldn&apos;t generate path
            </h3>
            <Button variant="ghost" size="sm" onClick={onRetry}>
              Try again
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
