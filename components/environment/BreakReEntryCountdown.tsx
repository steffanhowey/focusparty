"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

interface BreakReEntryCountdownProps {
  isOpen: boolean;
  onComplete: () => void;
}

export function BreakReEntryCountdown({
  isOpen,
  onComplete,
}: BreakReEntryCountdownProps) {
  const [count, setCount] = useState(3);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) {
      setCount(3);
      return;
    }

    const id = setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          clearInterval(id);
          onComplete();
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [isOpen, onComplete]);

  if (!isOpen || !mounted || typeof document === "undefined" || count === 0)
    return null;

  return createPortal(
    <div
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{ zIndex: 40 }}
    >
      <div
        className="absolute inset-0 bg-[var(--color-navy-700)]/60 backdrop-blur-[8px]"
        aria-hidden="true"
      />

      <div
        key={count}
        className="animate-countdown-pop relative select-none text-8xl font-bold text-white"
        style={{ fontFamily: "var(--font-montserrat), sans-serif" }}
      >
        {count}
      </div>

      <p className="relative mt-4 text-sm text-white/50">
        Resuming sprint…
      </p>
    </div>,
    document.body,
  );
}
