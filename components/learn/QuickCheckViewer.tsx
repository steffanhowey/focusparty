"use client";

import { useState, useCallback, useEffect } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  RoomStagePanel,
  RoomStageScaffold,
  RoomStageSecondaryButton,
} from "./RoomStageScaffold";
import type { PathItem, ItemState } from "@/lib/types";

// ─── Types ──────────────────────────────────────────────────

interface QuickCheckViewerProps {
  item: PathItem;
  isCompleted: boolean;
  onComplete: (stateData: Partial<ItemState>) => void;
  variant?: "default" | "roomOverlay" | "missionPage";
}

interface CheckFeedback {
  feedback: string;
  quality: "strong" | "good" | "needs_work";
  is_correct: boolean;
}

// ─── Constants ──────────────────────────────────────────────

const QUALITY_COLORS: Record<string, string> = {
  strong: "var(--sg-forest-300)",
  good: "var(--sg-teal-500)",
  needs_work: "var(--sg-gold-600)",
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
  variant = "default",
}: QuickCheckViewerProps) {
  const check = item.check!;
  const isImmersiveStage = variant === "roomOverlay" || variant === "missionPage";
  const stageVariant = variant === "missionPage" ? "missionPage" : "default";

  const [selected, setSelected] = useState<string>("");
  const [freeText, setFreeText] = useState("");
  const [feedback, setFeedback] = useState<CheckFeedback | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    setSelected("");
    setFreeText("");
    setFeedback(null);
    setLoading(false);
    setAttempts(0);
  }, [item.item_id]);

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

  if (isImmersiveStage) {
    if (isCompleted) {
      return (
        <RoomStageScaffold
          variant={stageVariant}
          eyebrow="Check"
          title={item.title}
          description={check.question}
          footerMeta="Check · Completed"
          contentClassName="max-w-[720px] space-y-4"
        >
          <RoomStagePanel className="space-y-2 text-center">
            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-[var(--sg-forest-300)]">
              <Check size={14} />
              Step complete
            </div>
            <p className="text-sm leading-6 text-white/55">
              This check has already been completed.
            </p>
          </RoomStagePanel>
        </RoomStageScaffold>
      );
    }

    return (
      <RoomStageScaffold
        variant={stageVariant}
        eyebrow="Check"
        title={item.title}
        description={check.question}
        footerMeta={
          feedback
            ? `Check · ${feedback.is_correct ? "Answer confirmed" : "Review the feedback"}`
            : `Check · Attempt ${attempts + 1}`
        }
        primaryAction={
          feedback ? (
            <Button variant="cta" size="sm" onClick={handleComplete}>
              Continue
            </Button>
          ) : (
            <Button
              variant="cta"
              size="sm"
              onClick={handleCheck}
              loading={loading}
              disabled={!userAnswer.trim()}
            >
              Check Answer
            </Button>
          )
        }
        secondaryAction={
          feedback ? (
            !feedback.is_correct ? (
              <RoomStageSecondaryButton onClick={handleTryAgain}>
                Try Again
              </RoomStageSecondaryButton>
            ) : null
          ) : (
            <RoomStageSecondaryButton onClick={handleSkip}>
              Skip
            </RoomStageSecondaryButton>
          )
        }
        contentClassName="max-w-[720px] space-y-4"
      >
        {!feedback ? (
          isMultipleChoice ? (
            <div className="space-y-3">
              {check.options!.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSelected(option)}
                  className="w-full cursor-pointer rounded-[var(--sg-radius-lg)] border px-4 py-3.5 text-left text-sm leading-6 transition-colors"
                  style={{
                    background:
                      selected === option
                        ? "color-mix(in srgb, var(--sg-forest-500) 18%, transparent)"
                        : "rgba(255,255,255,0.03)",
                    border:
                      selected === option
                        ? "1px solid var(--sg-forest-500)"
                        : "1px solid rgba(255,255,255,0.08)",
                    color:
                      selected === option
                        ? "rgba(255,255,255,0.95)"
                        : "rgba(255,255,255,0.68)",
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : (
            <RoomStagePanel>
              <textarea
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                placeholder="Type your answer..."
                rows={5}
                className="w-full resize-none bg-transparent text-sm leading-7 text-white placeholder:text-white/25 focus:outline-none"
              />
            </RoomStagePanel>
          )
        ) : (
          <>
            <RoomStagePanel>
              <p className="text-sm leading-7 text-white/70">{feedback.feedback}</p>
            </RoomStagePanel>

            {!feedback.is_correct && check.hint ? (
              <RoomStagePanel className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">
                  Hint
                </p>
                <p className="text-sm leading-6 text-white/60">{check.hint}</p>
              </RoomStagePanel>
            ) : null}
          </>
        )}
      </RoomStageScaffold>
    );
  }

  if (isCompleted) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 p-8 animate-fade-in">
        <Card className="p-6 max-w-2xl w-full">
          <p className="text-xs text-shell-500 flex items-center gap-1.5">
            <Check size={12} style={{ color: "var(--sg-forest-300)" }} />
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
          style={{ color: "var(--sg-forest-500)" }}
        >
          Quick Check
        </p>

        {/* Question */}
        <p className="text-sm text-shell-900 leading-relaxed">
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
                          ? "var(--sg-shell-100)"
                          : "white",
                      border:
                        selected === option
                          ? "1px solid var(--sg-forest-500)"
                          : "1px solid var(--sg-shell-border)",
                      color:
                        selected === option
                          ? "var(--sg-shell-900)"
                          : "var(--sg-shell-600)",
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
                  background: "white",
                  color: "var(--sg-shell-900)",
                  border: "1px solid var(--sg-shell-border)",
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
              className="rounded-lg px-3 py-2.5 text-sm leading-relaxed text-shell-600"
              style={{
                background: "white",
                borderLeft: `3px solid ${QUALITY_COLORS[feedback.quality] ?? QUALITY_COLORS.good}`,
              }}
            >
              {feedback.feedback}
            </div>

            {/* Hint on incorrect */}
            {!feedback.is_correct && check.hint && (
              <div
                className="rounded-lg px-3 py-2 text-xs"
                style={{
                  background: "white",
                  border: "1px solid var(--sg-shell-border)",
                  color: "var(--sg-shell-500)",
                }}
              >
                <span className="font-medium text-shell-600">
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
