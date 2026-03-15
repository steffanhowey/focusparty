"use client";

import { useState, useCallback } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { PathItem, ItemState } from "@/lib/types";

// ─── Types ──────────────────────────────────────────────────

interface QuickCheckViewerProps {
  item: PathItem;
  isCompleted: boolean;
  onComplete: (stateData: Partial<ItemState>) => void;
}

interface CheckFeedback {
  feedback: string;
  quality: "strong" | "good" | "needs_work";
  is_correct: boolean;
}

// ─── Constants ──────────────────────────────────────────────

const QUALITY_COLORS: Record<string, string> = {
  strong: "var(--color-green-700)",
  good: "var(--color-cyan-700)",
  needs_work: "var(--color-amber-700)",
};

// ─── Component ──────────────────────────────────────────────

/**
 * Renders "check" task items — quick comprehension checks
 * with multiple choice or free-text answers.
 */
export function QuickCheckViewer({
  item,
  isCompleted,
  onComplete,
}: QuickCheckViewerProps) {
  const check = item.check;
  if (!check) return null;

  const [selected, setSelected] = useState<string>("");
  const [freeText, setFreeText] = useState("");
  const [feedback, setFeedback] = useState<CheckFeedback | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const isMultipleChoice = check.options && check.options.length > 0;
  const userAnswer = isMultipleChoice ? selected : freeText;

  const handleCheck = useCallback(async () => {
    if (!userAnswer.trim()) return;
    setLoading(true);
    const attempt = attempts + 1;
    setAttempts(attempt);

    try {
      const res = await fetch("/api/learn/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          practice_type: "quick_check",
          question: check.question,
          reference_answer: check.correct_answer,
          user_response: userAnswer,
          hint: check.hint,
        }),
      });
      const data = await res.json();
      setFeedback(data);
    } catch {
      setFeedback({
        feedback: "Could not evaluate right now. Try again later.",
        quality: "good",
        is_correct: false,
      });
    } finally {
      setLoading(false);
    }
  }, [userAnswer, check, attempts]);

  const handleTryAgain = useCallback(() => {
    setSelected("");
    setFreeText("");
    setFeedback(null);
  }, []);

  const handleComplete = useCallback(() => {
    onComplete({
      submission_text: userAnswer || undefined,
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
      attempts: attempts || undefined,
    });
  }, [onComplete, userAnswer, feedback, attempts]);

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
          Quick Check
        </p>

        {/* Question */}
        <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">
          {check.question}
        </p>

        {/* Answer input */}
        {!feedback && (
          <>
            {isMultipleChoice ? (
              <div className="space-y-2">
                {check.options!.map((option) => (
                  <button
                    key={option}
                    onClick={() => setSelected(option)}
                    className="w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all"
                    style={{
                      background:
                        selected === option
                          ? "rgba(255,255,255,0.08)"
                          : "var(--color-bg-primary)",
                      border:
                        selected === option
                          ? "1px solid var(--color-accent-primary)"
                          : "1px solid var(--color-border-default)",
                      color:
                        selected === option
                          ? "var(--color-text-primary)"
                          : "var(--color-text-secondary)",
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : (
              <textarea
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                placeholder="Type your answer..."
                rows={3}
                className="w-full rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1"
                style={{
                  background: "var(--color-bg-primary)",
                  color: "var(--color-text-primary)",
                  border: "1px solid var(--color-border-default)",
                }}
              />
            )}

            <div className="flex items-center gap-3 pt-1">
              <Button variant="ghost" size="sm" onClick={handleSkip}>
                Skip
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCheck}
                loading={loading}
                disabled={!userAnswer.trim()}
              >
                Check Answer
              </Button>
            </div>
          </>
        )}

        {/* Feedback */}
        {feedback && (
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

            {/* Hint on incorrect */}
            {!feedback.is_correct && check.hint && (
              <div
                className="rounded-lg px-3 py-2 text-xs"
                style={{
                  background: "var(--color-bg-primary)",
                  border: "1px solid var(--color-border-default)",
                  color: "var(--color-text-tertiary)",
                }}
              >
                <span className="font-medium text-[var(--color-text-secondary)]">
                  Hint:{" "}
                </span>
                {check.hint}
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              {!feedback.is_correct && (
                <Button variant="ghost" size="sm" onClick={handleTryAgain}>
                  Try Again
                </Button>
              )}
              <Button variant="cta" size="sm" onClick={handleComplete}>
                Continue
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
