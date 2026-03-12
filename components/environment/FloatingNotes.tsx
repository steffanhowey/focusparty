"use client";

import { useRef, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { usePointerDrag } from "@/lib/usePointerDrag";

interface FloatingNotesProps {
  text: string;
  setText: (text: string) => void;
  isSaving: boolean;
  onBlur: () => void;
  onClose: () => void;
  /** When true, positions to the right of the centered break player */
  breakActive?: boolean;
}

export function FloatingNotes({
  text,
  setText,
  isSaving,
  onBlur,
  onClose,
  breakActive,
}: FloatingNotesProps) {
  const { dragRef, dragStyle, wasDraggedRef } = usePointerDrag({
    threshold: 4,
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Escape to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Auto-focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => e.stopPropagation(),
    [],
  );

  return (
    <div
      ref={dragRef}
      className="absolute z-[25] w-[320px]"
      style={{
        left: breakActive ? "calc(50% + 288px)" : "50%",
        top: breakActive ? "50%" : "33%",
        ...dragStyle,
        transition: "left 0.3s ease, top 0.3s ease",
      }}
    >
      <div
        className="flex flex-col overflow-hidden rounded-xl border border-white/[0.08]"
        style={{
          background: "rgba(10,10,10,0.85)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow:
            "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        {/* Header — drag handle */}
        <div className="flex cursor-grab items-center justify-between px-3 py-2 active:cursor-grabbing">
          <span className="text-[13px] font-medium text-white/70">Notes</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!wasDraggedRef.current) onClose();
            }}
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/10 hover:text-white/70"
            aria-label="Close notes"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={onBlur}
          onPointerDown={handlePointerDown}
          placeholder="Jot something down…"
          className="h-[180px] w-full resize-none bg-transparent px-3 pb-2 text-[13px] leading-relaxed text-white/90 outline-none placeholder:text-white/25"
          style={{ fontFamily: "var(--font-montserrat), sans-serif" }}
          spellCheck={false}
        />

        {/* Footer — save indicator */}
        <div className="flex items-center justify-end px-3 pb-2">
          <span className="text-[11px] text-white/30">
            {isSaving ? "Saving…" : text.length > 0 ? "Saved" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
