"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Brain, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { PreWatchChallenge } from "@/lib/scaffolding/generator";
import { trackScaffoldingEvent } from "@/lib/breaks/scaffoldingTracking";

interface PreWatchCardProps {
  preWatch: PreWatchChallenge;
  contentItemId: string;
  onReady: () => void;
  onSkip: () => void;
}

export function PreWatchCard({
  preWatch,
  contentItemId,
  onReady,
  onSkip,
}: PreWatchCardProps) {
  const [attempting, setAttempting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(
    Math.round(preWatch.estimatedMinutes * 60)
  );
  const trackedRef = useRef(false);

  // Track "shown" on mount
  useEffect(() => {
    if (!trackedRef.current) {
      trackedRef.current = true;
      trackScaffoldingEvent(contentItemId, "pre_watch_shown");
    }
  }, [contentItemId]);

  // Countdown timer when attempting
  useEffect(() => {
    if (!attempting) return;
    if (secondsLeft <= 0) {
      onReady();
      return;
    }
    const id = setInterval(() => {
      setSecondsLeft((s) => s - 1);
    }, 1000);
    return () => clearInterval(id);
  }, [attempting, secondsLeft, onReady]);

  const handleAttempt = useCallback(() => {
    trackScaffoldingEvent(contentItemId, "pre_watch_attempted");
    setAttempting(true);
  }, [contentItemId]);

  const handleSkip = useCallback(() => {
    trackScaffoldingEvent(contentItemId, "pre_watch_skipped");
    onSkip();
  }, [contentItemId, onSkip]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center">
      <div
        className="relative mx-auto w-full max-w-md rounded-2xl border border-white/10 p-6"
        style={{
          background: "rgba(10, 10, 10, 0.85)",
          backdropFilter: "blur(24px)",
          boxShadow: "var(--shadow-float)",
        }}
      >
        {/* Header */}
        <div className="mb-4 flex items-center gap-2">
          <Brain className="h-4 w-4 text-[var(--color-accent-primary)]" />
          <span className="text-xs font-medium uppercase tracking-wider text-white/50">
            Before you watch
          </span>
        </div>

        {/* Challenge prompt */}
        <p className="mb-3 text-sm leading-relaxed text-white/90">
          {preWatch.prompt}
        </p>

        {/* Context */}
        {preWatch.context && (
          <p className="mb-4 text-xs italic leading-relaxed text-white/30">
            {preWatch.context}
          </p>
        )}

        {/* Time estimate */}
        <div className="mb-5 flex items-center gap-2">
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-white/60">
            {attempting
              ? formatTime(secondsLeft)
              : `~${preWatch.estimatedMinutes} min`}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {!attempting ? (
            <>
              <Button variant="secondary" size="sm" onClick={handleAttempt}>
                I&apos;ll try it
              </Button>
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<SkipForward className="h-3.5 w-3.5" />}
                onClick={handleSkip}
              >
                Skip
              </Button>
            </>
          ) : (
            <Button variant="secondary" size="sm" onClick={onReady}>
              Ready to watch
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
