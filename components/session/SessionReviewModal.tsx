"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Zap, Target, Meh, BatteryLow, CloudLightning, CheckCircle2, Clock, RotateCw, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ToggleCard } from "@/components/ui/ToggleCard";
import { useFocusTrap } from "@/lib/useFocusTrap";
import type { SessionMood, SessionReflection, SprintResolution } from "@/lib/types";

/* ─── Constants ──────────────────────────────────────────── */

const MOODS: { id: SessionMood; icon: typeof Zap; label: string }[] = [
  { id: "energized", icon: Zap, label: "Energized" },
  { id: "focused", icon: Target, label: "Focused" },
  { id: "neutral", icon: Meh, label: "Neutral" },
  { id: "tired", icon: BatteryLow, label: "Tired" },
  { id: "frustrated", icon: CloudLightning, label: "Frustrated" },
];

const RESOLUTIONS: { id: SprintResolution; icon: typeof CheckCircle2; label: string; desc: string }[] = [
  { id: "completed", icon: CheckCircle2, label: "Completed", desc: "Finished what I set out to do" },
  { id: "partial", icon: Clock, label: "Partially done", desc: "Made progress, not done yet" },
  { id: "continue", icon: RotateCw, label: "Continue next sprint", desc: "Picking up where I left off" },
  { id: "abandon", icon: ArrowRight, label: "Switch task", desc: "Moving on to something else" },
];

/* ─── Props ──────────────────────────────────────────────── */

interface SessionReviewModalProps {
  isOpen: boolean;
  sessionDurationSec: number;
  elapsedSec: number;
  /** Sprint goal context — if provided, shows resolution step */
  sprintGoalText?: string | null;
  parentGoalTitle?: string | null;
  onResolution?: (resolution: SprintResolution) => void;
  onAnotherRound: () => void;
  onDone: () => void;
  onReflectionComplete: (reflection: SessionReflection) => void;
}

/* ─── Component ──────────────────────────────────────────── */

export function SessionReviewModal({
  isOpen,
  sessionDurationSec,
  elapsedSec,
  sprintGoalText,
  parentGoalTitle,
  onResolution,
  onAnotherRound,
  onDone,
  onReflectionComplete,
}: SessionReviewModalProps) {
  const [mounted, setMounted] = useState(false);
  const [mood, setMood] = useState<SessionMood | null>(null);
  const [resolution, setResolution] = useState<SprintResolution | null>(null);
  const hasSprintGoal = !!sprintGoalText;

  const overlayRef = useRef<HTMLDivElement>(null);
  const previousActive = useRef<HTMLElement | null>(null);
  useFocusTrap(overlayRef, isOpen && mounted);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Focus management
  useEffect(() => {
    if (!isOpen) return;
    previousActive.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      previousActive.current?.focus();
    };
  }, [isOpen]);

  // Auto-focus the primary action button
  useEffect(() => {
    if (!isOpen || !mounted) return;
    const timer = setTimeout(() => {
      overlayRef.current
        ?.querySelector<HTMLElement>("[data-autofocus]")
        ?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [isOpen, mounted]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setMood(null);
      setResolution(null);
    }
  }, [isOpen]);

  if (!isOpen || !mounted || typeof document === "undefined") return null;

  /* ── Helpers ── */

  const buildReflection = (): SessionReflection => ({
    mood,
    productivity: null,
    sessionDurationSec: elapsedSec,
  });

  const handleAction = (action: () => void) => {
    if (resolution && onResolution) onResolution(resolution);
    onReflectionComplete(buildReflection());
    action();
  };

  const elapsedMin = Math.round(elapsedSec / 60);
  const plannedMin = Math.round(sessionDurationSec / 60);

  const celebrationText =
    elapsedMin >= plannedMin
      ? "Great session!"
      : elapsedMin >= 10
        ? "Nice work!"
        : "Good start!";

  /* ── Render ── */

  const content = (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-modal-title"
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 40 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[var(--color-navy-700)]/60 backdrop-blur-[8px]"
        aria-hidden="true"
      />

      {/* Modal card */}
      <div
        className="animate-fp-review-enter relative w-full max-w-[520px] overflow-hidden rounded-[var(--radius-xl)] p-8"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "rgba(10,10,10,0.94)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
          "--color-bg-elevated": "#141414",
          "--color-text-primary": "#ffffff",
          "--color-text-secondary": "#c0c0c0",
          "--color-text-tertiary": "#888888",
          "--color-text-on-accent": "#ffffff",
          "--color-border-default": "rgba(255, 255, 255, 0.08)",
          "--color-border-focus": "#7c5cfc",
        } as React.CSSProperties}
      >
        {/* ── Celebration header ── */}
        <div className="mb-8 text-center">
          <h2
            id="review-modal-title"
            className="mb-3 text-3xl font-bold text-white"
            style={{ fontFamily: "var(--font-montserrat), sans-serif" }}
          >
            {celebrationText}
          </h2>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border-default)] bg-white/[0.06] px-3.5 py-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
            {elapsedMin} min session
          </span>
        </div>

        {/* ── Sprint resolution (if goal context exists) ── */}
        {hasSprintGoal && (
          <div className="mb-7">
            <div className="mb-3 rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.04)" }}>
              <p className="truncate text-sm font-medium text-white">{sprintGoalText}</p>
              {parentGoalTitle && (
                <p className="mt-0.5 truncate text-[11px] text-[var(--color-text-tertiary)]">
                  Part of: {parentGoalTitle}
                </p>
              )}
            </div>
            <p className="mb-2.5 text-sm font-medium text-[var(--color-text-secondary)]">
              How did it go?
            </p>
            <div className="grid grid-cols-2 gap-2">
              {RESOLUTIONS.map(({ id, icon: Icon, label, desc }) => {
                const selected = resolution === id;
                return (
                  <ToggleCard
                    key={id}
                    selected={selected}
                    onClick={() => setResolution(selected ? null : id)}
                    className="flex items-start gap-2.5"
                  >
                    <Icon
                      size={16}
                      strokeWidth={1.8}
                      className={`mt-0.5 shrink-0 ${selected ? "text-[var(--color-accent-primary)]" : "text-[var(--color-text-tertiary)]"}`}
                    />
                    <div>
                      <p className={`text-xs font-semibold ${selected ? "text-white" : "text-[var(--color-text-secondary)]"}`}>
                        {label}
                      </p>
                      <p className="text-[10px] text-[var(--color-text-tertiary)]">{desc}</p>
                    </div>
                  </ToggleCard>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Mood selector ── */}
        <div className="mb-7">
          <p className="mb-3 text-sm font-medium text-[var(--color-text-secondary)]">
            How are you feeling?
          </p>
          <div className="flex justify-between gap-2" role="radiogroup" aria-label="Mood">
            {MOODS.map(({ id, icon: Icon, label }) => {
              const selected = mood === id;
              return (
                <ToggleCard
                  key={id}
                  selected={selected}
                  role="radio"
                  aria-checked={selected}
                  aria-label={label}
                  onClick={() => setMood(selected ? null : id)}
                  className={`flex flex-1 flex-col items-center gap-1.5 px-2 py-3 ${
                    selected ? "text-white" : "text-[var(--color-text-tertiary)] hover:text-white"
                  }`}
                >
                  <Icon size={20} strokeWidth={1.6} />
                  <span className="text-[11px] font-medium leading-tight">{label}</span>
                </ToggleCard>
              );
            })}
          </div>
        </div>

        {/* ── Action buttons ── */}
        <div className="flex flex-col gap-2">
          {hasSprintGoal && !resolution && (
            <p className="mb-1 text-center text-xs text-[var(--color-text-tertiary)]">
              Select a resolution above to continue
            </p>
          )}
          <Button
            variant="cta"
            fullWidth
            data-autofocus
            disabled={hasSprintGoal && !resolution}
            onClick={() => handleAction(onAnotherRound)}
          >
            Another round
          </Button>
          <Button
            variant="secondary"
            fullWidth
            disabled={hasSprintGoal && !resolution}
            onClick={() => handleAction(onDone)}
          >
            Done for now
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
