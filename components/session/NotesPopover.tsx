"use client";

import { useEffect, useRef, useCallback, useState, memo } from "react";
import { Maximize2 } from "lucide-react";

interface NotesPopoverProps {
  text: string;
  setText: (text: string) => void;
  isSaving: boolean;
  onBlur: () => void;
  onExpand: () => void;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

export const NotesPopover = memo(function NotesPopover({
  text,
  setText,
  isSaving,
  onBlur,
  onExpand,
  onClose,
  triggerRef,
}: NotesPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ─── Drag state ──────────────────────────────────────────
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const startRef = useRef({ px: 0, py: 0, ox: 0, oy: 0 });
  const wasDraggedRef = useRef(false);

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      e.preventDefault();
      const dx = e.clientX - startRef.current.px;
      const dy = e.clientY - startRef.current.py;
      setOffset({
        x: startRef.current.ox + dx,
        y: startRef.current.oy + dy,
      });
      if (Math.abs(dx) + Math.abs(dy) >= 4) {
        wasDraggedRef.current = true;
      }
    };

    const handleUp = () => {
      draggingRef.current = false;
    };

    window.addEventListener("pointermove", handleMove, { passive: false });
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, []);

  const handleHeaderPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!e.isPrimary) return;
      draggingRef.current = true;
      wasDraggedRef.current = false;
      startRef.current = {
        px: e.clientX,
        py: e.clientY,
        ox: offset.x,
        oy: offset.y,
      };
    },
    [offset],
  );

  // ─── Auto-focus textarea on mount ────────────────────────
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // ─── Close on click outside ──────────────────────────────
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (popoverRef.current?.contains(e.target as Node)) return;
      if (triggerRef?.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [onClose, triggerRef]);

  // ─── Close on Escape ─────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Gate expand click so drag doesn't trigger it
  const handleExpand = useCallback(() => {
    if (wasDraggedRef.current) return;
    onExpand();
  }, [onExpand]);

  return (
    <div
      ref={popoverRef}
      className="absolute bottom-full left-1/2 z-50 mb-3 w-72 rounded-xl border border-[var(--sg-shell-border)] shadow-lg"
      style={{
        background: "rgba(15,35,24,0.85)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        boxShadow: "var(--shadow-float)",
        transform: `translate(calc(-50% + ${offset.x}px), ${offset.y}px)`,
      }}
    >
      {/* Header — drag handle */}
      <div
        className="flex cursor-grab items-center justify-between px-3 pb-0 pt-3 active:cursor-grabbing"
        onPointerDown={handleHeaderPointerDown}
        style={{ touchAction: "none" }}
      >
        <p className="text-2xs font-semibold uppercase tracking-wider text-[var(--sg-shell-500)]">Notes</p>

        {/* Expand button */}
        <button
          type="button"
          onClick={handleExpand}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-white/25 transition-colors hover:bg-white/10 hover:text-white/50"
          aria-label="Expand to floating panel"
        >
          <Maximize2 size={12} strokeWidth={2} />
        </button>
      </div>

      {/* Textarea */}
      <div className="px-3 pb-1 pt-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={onBlur}
          placeholder="Jot something down…"
          className="h-[180px] w-full resize-none bg-transparent text-sm leading-relaxed text-white/90 outline-none placeholder:text-white/25"
          spellCheck={false}
        />
      </div>

      {/* Footer — save indicator */}
      <div className="flex items-center justify-end px-3 pb-3">
        <span className="text-2xs text-white/30">
          {isSaving ? "Saving…" : text.length > 0 ? "Saved" : ""}
        </span>
      </div>
    </div>
  );
});
