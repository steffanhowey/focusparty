"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  CheckCircle,
  Code2,
  Eye,
  MessageCircle,
  SkipForward,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { Scaffolding } from "@/lib/scaffolding/generator";
import { trackScaffoldingEvent } from "@/lib/breaks/scaffoldingTracking";

type Section = "comprehension" | "exercise" | "discussion";

interface PostWatchPanelProps {
  scaffolding: Scaffolding;
  contentItemId: string;
  onDismiss: () => void;
  onShareDiscussion?: (question: string) => void;
  onSeekVideo?: (seconds: number) => void;
}

/** Determine the first section to show based on available scaffolding data. */
function getFirstSection(s: Scaffolding): Section {
  if (s.comprehensionChecks?.length > 0) return "comprehension";
  if (s.exercise) return "exercise";
  return "discussion";
}

/** Determine the next section after the current one. */
function getNextSection(current: Section, s: Scaffolding): Section | null {
  if (current === "comprehension") {
    if (s.exercise) return "exercise";
    if (s.discussionQuestion) return "discussion";
    return null;
  }
  if (current === "exercise") {
    if (s.discussionQuestion) return "discussion";
    return null;
  }
  return null;
}

export function PostWatchPanel({
  scaffolding,
  contentItemId,
  onDismiss,
  onShareDiscussion,
  onSeekVideo,
}: PostWatchPanelProps) {
  const [section, setSection] = useState<Section>(() =>
    getFirstSection(scaffolding)
  );
  const [checkIndex, setCheckIndex] = useState(0);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animate in on mount and section change
  useEffect(() => {
    setAnimateIn(false);
    const id = requestAnimationFrame(() => setAnimateIn(true));
    return () => cancelAnimationFrame(id);
  }, [section]);

  // Track section shown
  useEffect(() => {
    if (section === "comprehension") {
      trackScaffoldingEvent(contentItemId, "comprehension_shown", {
        questionIndex: checkIndex,
      });
    } else if (section === "exercise") {
      trackScaffoldingEvent(contentItemId, "exercise_shown");
    }
  }, [section, checkIndex, contentItemId]);

  // Auto-dismiss after 60s of inactivity
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      trackScaffoldingEvent(contentItemId, "post_watch_auto_dismissed");
      onDismiss();
    }, 60000);
  }, [contentItemId, onDismiss]);

  useEffect(() => {
    resetIdleTimer();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [resetIdleTimer]);

  const handleInteraction = useCallback(() => {
    resetIdleTimer();
  }, [resetIdleTimer]);

  const advanceSection = useCallback(() => {
    handleInteraction();
    const next = getNextSection(section, scaffolding);
    if (next) {
      setSection(next);
      setAnswerRevealed(false);
    } else {
      trackScaffoldingEvent(contentItemId, "post_watch_dismissed");
      onDismiss();
    }
  }, [section, scaffolding, contentItemId, onDismiss, handleInteraction]);

  const handleDismiss = useCallback(() => {
    trackScaffoldingEvent(contentItemId, "post_watch_dismissed");
    onDismiss();
  }, [contentItemId, onDismiss]);

  const check = scaffolding.comprehensionChecks?.[checkIndex];

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center">
      <div
        className="relative mx-auto w-full max-w-lg rounded-2xl border border-white/10 p-6 transition-all duration-300"
        style={{
          background: "rgba(10, 10, 10, 0.85)",
          backdropFilter: "blur(24px)",
          boxShadow: "var(--shadow-float)",
          opacity: animateIn ? 1 : 0,
          transform: animateIn ? "translateY(0)" : "translateY(12px)",
        }}
        onClick={handleInteraction}
      >
        {/* ─── Comprehension Check ─── */}
        {section === "comprehension" && check && (
          <div>
            <div className="mb-4 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-[var(--color-accent-primary)]" />
              <span className="text-xs font-medium uppercase tracking-wider text-white/50">
                Quick check
              </span>
              {scaffolding.comprehensionChecks.length > 1 && (
                <span className="text-xs text-white/30">
                  {checkIndex + 1} of {scaffolding.comprehensionChecks.length}
                </span>
              )}
            </div>

            <p className="mb-4 text-sm leading-relaxed text-white/90">
              {check.question}
            </p>

            {!answerRevealed ? (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Eye className="h-3.5 w-3.5" />}
                onClick={() => {
                  setAnswerRevealed(true);
                  handleInteraction();
                  trackScaffoldingEvent(
                    contentItemId,
                    "comprehension_answer_revealed",
                    { questionIndex: checkIndex }
                  );
                }}
              >
                Show answer
              </Button>
            ) : (
              <div className="mb-4 rounded-lg bg-white/5 p-3">
                <p className="text-sm text-white/70">{check.answer}</p>
              </div>
            )}

            {check.timestampHint != null && (
              <button
                className="mt-2 flex items-center gap-1.5 text-xs text-[var(--color-accent-primary)] transition-opacity hover:opacity-80"
                onClick={() => {
                  handleInteraction();
                  trackScaffoldingEvent(contentItemId, "comprehension_rewatch", {
                    timestampSeconds: check.timestampHint,
                  });
                  onSeekVideo?.(check.timestampHint!);
                }}
              >
                <RotateCcw className="h-3 w-3" />
                Rewatch this part
              </button>
            )}

            <div className="mt-5 flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
                onClick={advanceSection}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* ─── Practice Exercise ─── */}
        {section === "exercise" && scaffolding.exercise && (
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Code2 className="h-4 w-4 text-[var(--color-accent-primary)]" />
              <span className="text-xs font-medium uppercase tracking-wider text-white/50">
                Try it yourself
              </span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/50">
                ~{scaffolding.exercise.estimatedMinutes} min
              </span>
            </div>

            <p className="mb-3 text-sm leading-relaxed text-white/90">
              {scaffolding.exercise.prompt}
            </p>

            {scaffolding.exercise.instructions.length > 0 && (
              <ol className="mb-3 list-inside list-decimal space-y-1">
                {scaffolding.exercise.instructions.map((inst, i) => (
                  <li key={i} className="text-xs leading-relaxed text-white/60">
                    {inst}
                  </li>
                ))}
              </ol>
            )}

            {scaffolding.exercise.tools.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {scaffolding.exercise.tools.map((tool) => (
                  <span
                    key={tool}
                    className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/50"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            )}

            {scaffolding.exercise.starterCode && (
              <pre className="mb-3 overflow-x-auto rounded-lg bg-black/40 p-3 text-xs text-white/60">
                <code>{scaffolding.exercise.starterCode}</code>
              </pre>
            )}

            {scaffolding.exercise.successCriteria && (
              <p className="mb-4 text-[10px] text-white/30">
                Success: {scaffolding.exercise.successCriteria}
              </p>
            )}

            <div className="mt-5 flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  handleInteraction();
                  trackScaffoldingEvent(contentItemId, "exercise_completed");
                  advanceSection();
                }}
              >
                Done
              </Button>
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<SkipForward className="h-3.5 w-3.5" />}
                onClick={() => {
                  handleInteraction();
                  trackScaffoldingEvent(contentItemId, "exercise_skipped");
                  advanceSection();
                }}
              >
                Skip
              </Button>
            </div>
          </div>
        )}

        {/* ─── Discussion Question ─── */}
        {section === "discussion" && (
          <div>
            <div className="mb-4 flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-[var(--color-accent-primary)]" />
              <span className="text-xs font-medium uppercase tracking-wider text-white/50">
                For the room
              </span>
            </div>

            <p className="mb-5 text-sm leading-relaxed text-white/90">
              {scaffolding.discussionQuestion}
            </p>

            <div className="flex items-center gap-3">
              {onShareDiscussion && scaffolding.discussionQuestion && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    handleInteraction();
                    trackScaffoldingEvent(contentItemId, "discussion_shared");
                    onShareDiscussion(scaffolding.discussionQuestion);
                    handleDismiss();
                  }}
                >
                  Share in chat
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={handleDismiss}>
                Back to work
              </Button>
            </div>
          </div>
        )}

        {/* Always-visible dismiss */}
        {section !== "discussion" && (
          <div className="mt-4 border-t border-white/5 pt-3">
            <Button variant="ghost" size="xs" onClick={handleDismiss}>
              Back to work
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
