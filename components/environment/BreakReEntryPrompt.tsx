"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Play, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useFocusTrap } from "@/lib/useFocusTrap";

interface BreakReEntryPromptProps {
  isOpen: boolean;
  activeTaskTitle: string | null;
  onResume: () => void;
  onSwitchTask: () => void;
}

export function BreakReEntryPrompt({
  isOpen,
  activeTaskTitle,
  onResume,
  onSwitchTask,
}: BreakReEntryPromptProps) {
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

  const modal = (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="break-reentry-title"
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
        className="animate-fp-review-enter relative w-full max-w-[480px] overflow-hidden rounded-[var(--radius-xl)] p-8"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "rgba(10,10,10,0.94)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow:
            "0 16px 48px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        <div className="mb-8 text-center">
          <h2
            id="break-reentry-title"
            className="text-2xl font-bold text-white"
            style={{ fontFamily: "var(--font-montserrat), sans-serif" }}
          >
            Break Complete
          </h2>
          {activeTaskTitle && (
            <p className="mt-2 text-sm text-white/50">
              Next: {activeTaskTitle}
            </p>
          )}
          <p className="mt-2 text-xs text-white/30">Ready to continue?</p>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            variant="cta"
            fullWidth
            data-autofocus
            leftIcon={<Play size={14} />}
            onClick={onResume}
          >
            Resume Sprint
          </Button>
          <Button
            variant="secondary"
            fullWidth
            leftIcon={<ArrowRight size={14} />}
            onClick={onSwitchTask}
          >
            Switch Task
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
