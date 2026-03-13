"use client";

import { useEffect, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";

interface SwitchTaskModalProps {
  isOpen: boolean;
  currentTaskText: string;
  onComplete: () => void;
  onSwitch: () => void;
  onCancel: () => void;
}

export function SwitchTaskModal({
  isOpen,
  currentTaskText,
  onComplete,
  onSwitch,
  onCancel,
}: SwitchTaskModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Escape to dismiss
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onCancel]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onCancel();
    },
    [onCancel]
  );

  if (!isOpen || !mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 50 }}
      onClick={handleOverlayClick}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[6px]"
        aria-hidden
      />

      {/* Modal */}
      <div className="relative w-full max-w-[360px] rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-6 shadow-xl">
        <h3
          className="mb-2 text-base font-semibold text-white"
        >
          Switch task?
        </h3>
        <p className="mb-5 text-sm text-[var(--color-text-secondary)]">
          You&apos;re working on{" "}
          <span className="text-white">&ldquo;{currentTaskText}&rdquo;</span>
        </p>

        <div className="flex gap-2">
          <Button variant="primary" size="sm" fullWidth onClick={onComplete}>
            Mark as done
          </Button>
          <Button variant="outline" size="sm" fullWidth onClick={onSwitch}>
            Switch task
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
