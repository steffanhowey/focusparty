"use client";

import { useState, useCallback } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { PathItem, ItemState } from "@/lib/types";

// ─── Types ──────────────────────────────────────────────────

interface ReflectionViewerProps {
  item: PathItem;
  isCompleted: boolean;
  onComplete: (stateData: Partial<ItemState>) => void;
}

interface ReflectionFeedback {
  feedback: string;
  quality: "strong" | "good" | "needs_work";
}

// ─── Constants ──────────────────────────────────────────────

const QUALITY_COLORS: Record<string, string> = {
  strong: "var(--color-green-700)",
  good: "var(--color-cyan-700)",
  needs_work: "var(--color-amber-700)",
};

// ─── Component ──────────────────────────────────────────────

/**
 * Renders "reflect" task items — contemplative reflection prompts
 * with AI-evaluated depth feedback.
 */
export function ReflectionViewer({
  item,
  isCompleted,
  onComplete,
}: ReflectionViewerProps) {
  const reflection = item.reflection;
  if (!reflection) return null;

  const [response, setResponse] = useState("");
  const [feedback, setFeedback] = useState<ReflectionFeedback | null>(null);
  const [loading, setLoading] = useState(false);

  const minLength = reflection.min_length ?? 50;
  const meetsMinLength = response.trim().length >= minLength;

  const handleSubmit = useCallback(async () => {
    if (!meetsMinLength) return;
    setLoading(true);
    try {
      const res = await fetch("/api/learn/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          practice_type: "reflection",
          question: reflection.prompt,
          user_response: response,
        }),
      });
      const data = await res.json();
      setFeedback(data);
    } catch {
      setFeedback({
        feedback: "Thanks for reflecting! Your thoughts have been saved.",
        quality: "good",
      });
    } finally {
      setLoading(false);
    }
  }, [response, reflection, meetsMinLength]);

  const handleComplete = useCallback(() => {
    onComplete({
      submission_text: response || undefined,
      evaluation: feedback
        ? {
            quality:
              feedback.quality === "strong"
                ? "nailed_it"
                : feedback.quality === "good"
                  ? "good"
                  : "needs_iteration",
            feedback: feedback.feedback,
          }
        : undefined,
    });
  }, [onComplete, response, feedback]);

  const handleSkip = useCallback(() => {
    onComplete({ skipped: true });
  }, [onComplete]);

  if (isCompleted) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 p-8 animate-fade-in">
        <Card className="p-6 max-w-2xl w-full">
          <p className="text-xs text-[var(--color-text-tertiary)] flex items-center gap-1.5">
            <Check size={12} style={{ color: "var(--color-green-700)" }} />
            Completed
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-8 animate-fade-in">
      <Card className="p-6 max-w-2xl w-full space-y-5">
        {/* Header */}
        <p
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: "var(--color-accent-primary)" }}
        >
          Reflect
        </p>

        {/* Reflection prompt */}
        <div
          className="rounded-lg px-4 py-3 text-sm leading-relaxed"
          style={{
            background: "var(--color-bg-primary)",
            borderLeft: "3px solid var(--color-accent-primary)",
            color: "var(--color-text-primary)",
          }}
        >
          {reflection.prompt}
        </div>

        {!feedback ? (
          <>
            {/* Response textarea */}
            <div className="space-y-1.5">
              <textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder="Take a moment to reflect..."
                rows={5}
                className="w-full rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1"
                style={{
                  background: "var(--color-bg-primary)",
                  color: "var(--color-text-primary)",
                  border: "1px solid var(--color-border-default)",
                }}
              />
              <div className="flex items-center justify-between">
                <span
                  className="text-[10px]"
                  style={{
                    color: meetsMinLength
                      ? "var(--color-text-tertiary)"
                      : "var(--color-amber-700)",
                  }}
                >
                  {response.trim().length}/{minLength} min characters
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button variant="ghost" size="sm" onClick={handleSkip}>
                Skip
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmit}
                loading={loading}
                disabled={!meetsMinLength}
              >
                Submit Reflection
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Feedback card */}
            <div
              className="rounded-lg px-3 py-2.5 text-sm leading-relaxed"
              style={{
                background: "var(--color-bg-primary)",
                borderLeft: `3px solid ${QUALITY_COLORS[feedback.quality] ?? QUALITY_COLORS.good}`,
                color: "var(--color-text-secondary)",
              }}
            >
              {feedback.feedback}
            </div>

            <Button variant="cta" size="sm" onClick={handleComplete}>
              Continue
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
