"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { useFocusTrap } from "@/lib/useFocusTrap";

/* ─── Props ──────────────────────────────────────────────── */

interface LeaveConfirmModalProps {
  isOpen: boolean;
  remainingMin: number;
  onKeepGoing: () => void;
  onEndSession: () => void;
}

/* ─── Component ──────────────────────────────────────────── */

export function LeaveConfirmModal({
  isOpen,
  remainingMin,
  onKeepGoing,
  onEndSession,
}: LeaveConfirmModalProps) {
  const [mounted, setMounted] = useState(false);

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

  const subtitle =
    remainingMin > 1
      ? `You still have ${remainingMin} min left on your timer.`
      : "You're almost at the finish line.";

  /* ── Render ── */

  const content = (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-confirm-title"
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
        {/* ── Header ── */}
        <div className="mb-8 text-center">
          <h2
            id="leave-confirm-title"
            className="text-3xl font-bold text-white"
          >
            Leaving so soon?
          </h2>
          <p className="mt-2 text-sm text-white/50">{subtitle}</p>
        </div>

        {/* ── Action buttons ── */}
        <div className="flex flex-col gap-2">
          <Button
            variant="cta"
            fullWidth
            data-autofocus
            onClick={onKeepGoing}
          >
            Keep going
          </Button>
          <Button variant="secondary" fullWidth onClick={onEndSession}>
            End session
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
