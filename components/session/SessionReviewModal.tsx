"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { useFocusTrap } from "@/lib/useFocusTrap";
import type { SessionReflection } from "@/lib/types";

/* ─── Props ──────────────────────────────────────────────── */

interface LinkedResourceInfo {
  provider: string;
  resourceType: string;
  externalId: string;
  title: string;
  url: string | null;
}

interface SessionReviewModalProps {
  isOpen: boolean;
  sessionDurationSec: number;
  elapsedSec: number;
  onAnotherRound: () => void;
  onDone: () => void;
  onReflectionComplete: (reflection: SessionReflection) => void;
  /** If the sprint task is linked to an external resource */
  linkedResource?: LinkedResourceInfo | null;
  /** Session ID for writeback logging */
  sessionId?: string | null;
}

/* ─── Component ──────────────────────────────────────────── */

export function SessionReviewModal({
  isOpen,
  sessionDurationSec,
  elapsedSec,
  onAnotherRound,
  onDone,
  onReflectionComplete,
  linkedResource,
  sessionId,
}: SessionReviewModalProps) {
  const [mounted, setMounted] = useState(false);
  const [writebackEnabled, setWritebackEnabled] = useState(true);
  const [writebackSending, setWritebackSending] = useState(false);

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

  if (!isOpen || !mounted || typeof document === "undefined") return null;

  /* ── Helpers ── */

  const elapsedMin = Math.round(elapsedSec / 60);
  const plannedMin = Math.round(sessionDurationSec / 60);

  const buildReflection = (): SessionReflection => ({
    mood: null,
    productivity: null,
    sessionDurationSec: elapsedSec,
  });

  const handleAction = async (action: () => void) => {
    // Fire writeback if enabled and we have a linked resource
    if (writebackEnabled && linkedResource && linkedResource.provider === "github") {
      setWritebackSending(true);
      try {
        await fetch("/api/integrations/github/writeback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            externalId: linkedResource.externalId,
            sessionId: sessionId ?? null,
            payload: {
              action: "comment",
              body: `Focused for ${elapsedMin} min on this. Sprint completed.`,
            },
          }),
        });
      } catch {
        // Non-blocking — don't prevent the user from continuing
        console.warn("[SessionReviewModal] Writeback failed");
      } finally {
        setWritebackSending(false);
      }
    }
    onReflectionComplete(buildReflection());
    action();
  };

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
        className="animate-fp-review-enter relative w-full max-w-[520px] overflow-hidden rounded-xl p-8"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "rgba(10,10,10,0.94)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "var(--shadow-xl)",
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
            className="text-3xl font-bold text-white"
          >
            {celebrationText}
          </h2>
        </div>

        {/* ── Writeback toggle (only when linked to an external resource) ── */}
        {linkedResource && (
          <div className="mb-6">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3" style={{ background: "rgba(255,255,255,0.04)" }}>
              <input
                type="checkbox"
                checked={writebackEnabled}
                onChange={(e) => setWritebackEnabled(e.target.checked)}
                className="h-4 w-4 rounded accent-[var(--color-accent-primary)]"
              />
              <span className="flex-1 text-sm text-[var(--color-navy-400)]">
                Post progress note to{" "}
                <span className="capitalize text-white">{linkedResource.provider}</span>
              </span>
              {writebackSending && (
                <span className="text-xs text-[var(--color-navy-500)]">Sending...</span>
              )}
            </label>
          </div>
        )}

        {/* ── Action buttons ── */}
        <div className="flex flex-col gap-2">
          <Button
            variant="cta"
            fullWidth
            data-autofocus
            onClick={() => handleAction(onAnotherRound)}
          >
            Another round
          </Button>
          <Button
            variant="secondary"
            fullWidth
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
