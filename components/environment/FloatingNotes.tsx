"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { Minus } from "lucide-react";
import { usePointerDrag } from "@/lib/usePointerDrag";

interface FloatingNotesProps {
  text: string;
  setText: (text: string) => void;
  isSaving: boolean;
  onBlur: () => void;
  onClose: () => void;
  notesButtonRef: React.RefObject<HTMLButtonElement | null>;
  /** When true, positions to the right of the centered break player */
  breakActive?: boolean;
}

export function FloatingNotes({
  text,
  setText,
  isSaving,
  onBlur,
  onClose,
  notesButtonRef,
  breakActive,
}: FloatingNotesProps) {
  const { dragRef, dragStyle, wasDraggedRef } = usePointerDrag({
    threshold: 4,
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // null = normal, "from" = frozen at current rect, "to" = animating to button
  const [animPhase, setAnimPhase] = useState<null | "from" | "to">(null);
  const frozenRect = useRef<DOMRect | null>(null);
  const targetRect = useRef<DOMRect | null>(null);

  // Escape to close (instant)
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

  // When we enter "from" phase, schedule "to" phase on next frame
  useEffect(() => {
    if (animPhase === "from") {
      const raf = requestAnimationFrame(() => {
        setAnimPhase("to");
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [animPhase]);

  const handleMinimize = useCallback(() => {
    if (wasDraggedRef.current) return;

    const panel = dragRef.current;
    const btn = notesButtonRef.current;
    if (!panel || !btn) {
      onClose();
      return;
    }

    frozenRect.current = panel.getBoundingClientRect();
    targetRect.current = btn.getBoundingClientRect();
    setAnimPhase("from");
  }, [onClose, notesButtonRef, dragRef, wasDraggedRef]);

  const handleTransitionEnd = useCallback(
    (e: React.TransitionEvent) => {
      if (e.propertyName === "transform" && animPhase === "to") {
        onClose();
      }
    },
    [animPhase, onClose],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => e.stopPropagation(),
    [],
  );

  // Minimizing animation: two-phase fixed-position element
  if (animPhase && frozenRect.current && targetRect.current) {
    const fr = frozenRect.current;
    const br = targetRect.current;
    const isTo = animPhase === "to";

    return (
      <div
        className="z-[25]"
        style={{
          position: "fixed",
          left: fr.left,
          top: fr.top,
          width: fr.width,
          height: fr.height,
          transformOrigin: "center center",
          transform: isTo
            ? `translate(${br.left + br.width / 2 - fr.left - fr.width / 2}px, ${br.top + br.height / 2 - fr.top - fr.height / 2}px) scale(0.06)`
            : "scale(1)",
          opacity: isTo ? 0 : 1,
          borderRadius: isTo ? "9999px" : "var(--radius-md)",
          overflow: "hidden",
          pointerEvents: "none",
          transition: isTo
            ? "transform 400ms cubic-bezier(0.4, 0, 0.2, 1), opacity 350ms ease 50ms, border-radius 400ms ease"
            : "none",
        }}
        onTransitionEnd={handleTransitionEnd}
      >
        <div
          className="flex h-full flex-col border border-[var(--color-border-default)]"
          style={{
            background: "rgba(10,10,10,0.65)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            boxShadow: "var(--shadow-float)",
          }}
        />
      </div>
    );
  }

  return (
    <div
      ref={dragRef}
      className="absolute z-[25]"
      style={{
        width: 364,
        height: "calc(100% - 32px)",
        left: "calc(100% - 198px)",
        top: 16,
        ...dragStyle,
      }}
    >
      <div
        className="flex h-full flex-col overflow-hidden rounded-xl border border-[var(--color-border-default)]"
        style={{
          background: "rgba(10,10,10,0.65)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow: "var(--shadow-float)",
        }}
      >
        {/* Header — drag handle */}
        <div className="flex h-20 cursor-grab items-center justify-between px-4 active:cursor-grabbing md:px-6">
          <span className="text-base font-semibold text-white">Notes</span>
          <button
            type="button"
            onClick={handleMinimize}
            className="cursor-pointer rounded-lg p-1.5 text-[var(--color-text-tertiary)] transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Minimize notes"
          >
            <Minus size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Textarea — fills remaining height */}
        <div className="min-h-0 flex-1 px-4 md:px-6">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={onBlur}
            onPointerDown={handlePointerDown}
            placeholder="Jot something down…"
            className="h-full w-full resize-none bg-transparent text-sm leading-relaxed text-white/90 outline-none placeholder:text-white/25"
            spellCheck={false}
          />
        </div>

        {/* Footer — save indicator */}
        <div className="flex items-center justify-end px-4 pb-3 md:px-6">
          <span className="text-2xs text-white/30">
            {isSaving ? "Saving…" : text.length > 0 ? "Saved" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
