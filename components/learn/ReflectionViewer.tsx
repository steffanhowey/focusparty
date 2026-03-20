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

interface ReflectionViewerProps {
  item: PathItem;
  isCompleted: boolean;
  onComplete: (stateData: Partial<ItemState>) => void;
  variant?: "default" | "roomOverlay" | "missionPage";
}

interface ReflectionFeedback {
  feedback: string;
  quality: "strong" | "good" | "needs_work";
}

// ─── Constants ──────────────────────────────────────────────

const QUALITY_COLORS: Record<string, string> = {
  strong: "var(--sg-forest-300)",
  good: "var(--sg-teal-500)",
  needs_work: "var(--sg-gold-600)",
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
  variant = "default",
}: ReflectionViewerProps) {
  const reflection = item.reflection!;
  const isImmersiveStage = variant === "roomOverlay" || variant === "missionPage";
  const stageVariant = variant === "missionPage" ? "missionPage" : "default";

  const [response, setResponse] = useState("");
  const [feedback, setFeedback] = useState<ReflectionFeedback | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setResponse("");
    setFeedback(null);
    setLoading(false);
  }, [item.item_id]);

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

  if (isImmersiveStage) {
    if (isCompleted) {
      return (
        <RoomStageScaffold
          variant={stageVariant}
          eyebrow="Reflect"
          title={item.title}
          description={reflection.prompt}
          footerMeta="Reflect · Completed"
          contentClassName="max-w-[720px] space-y-4"
        >
          <RoomStagePanel className="space-y-2 text-center">
            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-[var(--sg-forest-300)]">
              <Check size={14} />
              Step complete
            </div>
            <p className="text-sm leading-6 text-white/55">
              Your reflection for this step has already been saved.
            </p>
          </RoomStagePanel>
        </RoomStageScaffold>
      );
    }

    return (
      <RoomStageScaffold
        variant={stageVariant}
        eyebrow="Reflect"
        title={item.title}
        description={reflection.prompt}
        footerMeta={
          feedback
            ? "Reflect · Review complete"
            : `Reflect · ${minLength}+ characters`
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
              onClick={handleSubmit}
              loading={loading}
              disabled={!meetsMinLength}
            >
              Submit Reflection
            </Button>
          )
        }
        secondaryAction={
          feedback ? null : (
            <RoomStageSecondaryButton onClick={handleSkip}>
              Skip
            </RoomStageSecondaryButton>
          )
        }
        contentClassName="max-w-[720px] space-y-4"
      >
        {!feedback ? (
          <>
            <RoomStagePanel>
              <textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder="Take a moment to reflect..."
                rows={8}
                className="w-full resize-none bg-transparent text-sm leading-7 text-white placeholder:text-white/25 focus:outline-none"
              />
            </RoomStagePanel>

            <div className="text-xs text-white/40">
              {response.trim().length}/{minLength} characters
            </div>
          </>
        ) : (
          <RoomStagePanel>
            <p className="text-sm leading-7 text-white/70">{feedback.feedback}</p>
          </RoomStagePanel>
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
          Reflect
        </p>

        {/* Reflection prompt */}
        <div
          className="rounded-lg px-4 py-3 text-sm leading-relaxed text-shell-900"
          style={{
            background: "white",
            borderLeft: "3px solid var(--sg-forest-500)",
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
                  background: "white",
                  color: "var(--sg-shell-900)",
                  border: "1px solid var(--sg-shell-border)",
                }}
              />
              <div className="flex items-center justify-between">
                <span
                  className="text-[10px]"
                  style={{
                    color: meetsMinLength
                      ? "var(--sg-shell-500)"
                      : "var(--sg-gold-600)",
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
              className="rounded-lg px-3 py-2.5 text-sm leading-relaxed text-shell-600"
              style={{
                background: "white",
                borderLeft: `3px solid ${QUALITY_COLORS[feedback.quality] ?? QUALITY_COLORS.good}`,
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
