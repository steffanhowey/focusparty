"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Zap, Target, Meh, BatteryLow, CloudLightning } from "lucide-react";
import type { SessionMood, SessionReflection } from "@/lib/types";

/* ─── Constants ──────────────────────────────────────────── */

const MOODS: { id: SessionMood; icon: typeof Zap; label: string }[] = [
  { id: "energized", icon: Zap, label: "Energized" },
  { id: "focused", icon: Target, label: "Focused" },
  { id: "neutral", icon: Meh, label: "Neutral" },
  { id: "tired", icon: BatteryLow, label: "Tired" },
  { id: "frustrated", icon: CloudLightning, label: "Frustrated" },
];

/* ─── Props ──────────────────────────────────────────────── */

interface SessionReviewModalProps {
  isOpen: boolean;
  sessionDurationSec: number;
  elapsedSec: number;
  onAnotherRound: () => void;
  onDone: () => void;
  onReflectionComplete: (reflection: SessionReflection) => void;
}

/* ─── Component ──────────────────────────────────────────── */

export function SessionReviewModal({
  isOpen,
  sessionDurationSec,
  elapsedSec,
  onAnotherRound,
  onDone,
  onReflectionComplete,
}: SessionReviewModalProps) {
  const [mounted, setMounted] = useState(false);
  const [mood, setMood] = useState<SessionMood | null>(null);

  const overlayRef = useRef<HTMLDivElement>(null);
  const previousActive = useRef<HTMLElement | null>(null);

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
    }
  }, [isOpen]);

  if (!isOpen || !mounted || typeof document === "undefined") return null;

  /* ── Helpers ── */

  const buildReflection = (): SessionReflection => ({
    mood,
    productivity: null,
    completedAt: new Date().toISOString(),
    sessionDurationSec,
  });

  const handleAction = (action: () => void) => {
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
        className="animate-fp-review-enter relative w-full max-w-[480px] rounded-[var(--radius-lg)] border border-white/[0.08] p-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "rgba(13,14,32,0.95)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)",
          "--color-bg-elevated": "#11132b",
          "--color-text-primary": "#ffffff",
          "--color-text-secondary": "#c3c4ca",
          "--color-text-tertiary": "#888995",
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

        {/* ── Mood selector ── */}
        <div className="mb-7">
          <p className="mb-3 text-sm font-medium text-[var(--color-text-secondary)]">
            How are you feeling?
          </p>
          <div className="flex justify-between gap-2" role="radiogroup" aria-label="Mood">
            {MOODS.map(({ id, icon: Icon, label }) => {
              const selected = mood === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={label}
                  onClick={() => setMood(selected ? null : id)}
                  className={`flex flex-1 cursor-pointer flex-col items-center gap-1.5 rounded-[var(--radius-md)] border px-2 py-3 transition-all duration-150 ${
                    selected
                      ? "border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10 text-white"
                      : "border-[var(--color-border-default)] text-[var(--color-text-tertiary)] hover:border-[var(--color-border-focus)] hover:text-white"
                  }`}
                >
                  <Icon size={20} strokeWidth={1.6} />
                  <span className="text-[11px] font-medium leading-tight">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Action buttons ── */}
        <div className="flex flex-col gap-2">
          <button
            data-autofocus
            type="button"
            onClick={() => handleAction(onAnotherRound)}
            className="h-12 w-full cursor-pointer rounded-full bg-[var(--color-accent-primary)] font-semibold text-white transition-all duration-150 hover:bg-[var(--color-accent-secondary)] hover:shadow-[var(--shadow-glow-purple)]"
            style={{ fontFamily: "var(--font-montserrat), sans-serif" }}
          >
            Another round
          </button>
          <button
            type="button"
            onClick={() => handleAction(onDone)}
            className="h-12 w-full cursor-pointer rounded-full border border-[var(--color-border-default)] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-white/5"
          >
            Done for now
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
