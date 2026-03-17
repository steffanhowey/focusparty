"use client";

import { useEffect, useRef, memo } from "react";
import { Maximize2 } from "lucide-react";
import { FocusBody, type FocusBodyProps } from "./FocusBody";

interface FocusPopoverProps extends FocusBodyProps {
  onExpand: () => void;
  onClose: () => void;
}

export const FocusPopover = memo(function FocusPopover({
  onExpand,
  onClose,
  ...bodyProps
}: FocusPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // ─── Close behavior ─────────────────────────────────────
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (popoverRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      className="absolute bottom-[calc(100%+8px)] left-1/2 z-50 w-80 -translate-x-1/2 overflow-hidden rounded-xl"
      style={{
        background: "var(--sg-forest-800)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "var(--shadow-float)",
      }}
    >
      {/* Expand button — top right */}
      <button
        type="button"
        onClick={onExpand}
        className="absolute right-2 top-2 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-white/25 transition-colors hover:bg-white/10 hover:text-white/50"
        aria-label="Expand to floating panel"
      >
        <Maximize2 size={12} strokeWidth={2} />
      </button>

      <FocusBody {...bodyProps} />
    </div>
  );
});
