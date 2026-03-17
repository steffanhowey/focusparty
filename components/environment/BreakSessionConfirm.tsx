"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Coffee } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useFocusTrap } from "@/lib/useFocusTrap";
import type { BreakContentItem, BreakDuration } from "@/lib/types";

interface BreakSessionConfirmProps {
  isOpen: boolean;
  content: BreakContentItem;
  durationMinutes: BreakDuration;
  onConfirm: () => void;
  onCancel: () => void;
}

export function BreakSessionConfirm({
  isOpen,
  content,
  durationMinutes,
  onConfirm,
  onCancel,
}: BreakSessionConfirmProps) {
  const [mounted, setMounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const previousActive = useRef<HTMLElement | null>(null);
  useFocusTrap(overlayRef, isOpen && mounted);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    previousActive.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      previousActive.current?.focus();
    };
  }, [isOpen]);

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

  const durationLabel = `${durationMinutes} minute break`;
  const segment = content.segments?.find((s) => s.duration === durationMinutes);
  const clipLabel = segment?.label ?? null;

  const modal = (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="break-confirm-title"
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 40 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-[8px]"
        style={{ background: "rgba(30,58,44,0.6)" }}
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Modal card */}
      <div
        className="animate-fp-review-enter relative w-full max-w-[480px] overflow-hidden rounded-xl p-8"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "rgba(15,35,24,0.94)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "var(--sg-shadow-xl)",
        }}
      >
        <div className="mb-8 text-center">
          <Coffee size={28} className="mx-auto mb-3" style={{ color: "var(--sg-teal-600)" }} />
          <h2
            id="break-confirm-title"
            className="text-2xl font-bold text-white"
          >
            Learning Break
          </h2>
          {clipLabel ? (
            <p className="mt-2 text-sm font-medium text-white/70">{clipLabel}</p>
          ) : (
            <p className="mt-2 text-sm text-white/60">{content.title}</p>
          )}
          <p className="mt-1.5 text-xs text-white/30">
            {content.source_name ? `${content.source_name} · ` : ""}{durationLabel}
          </p>
          <p className="mt-4 text-xs text-white/40">
            Your sprint will resume when this finishes.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button variant="cta" fullWidth data-autofocus onClick={onConfirm}>
            Start Break
          </Button>
          <Button variant="ghost" fullWidth onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
