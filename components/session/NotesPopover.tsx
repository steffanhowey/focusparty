"use client";

import { useEffect, useRef, memo } from "react";
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

  // Auto-focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Close on click outside
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (popoverRef.current?.contains(e.target as Node)) return;
      if (triggerRef?.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [onClose, triggerRef]);

  // Close on Escape
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
      className="absolute bottom-full left-1/2 z-50 mb-3 w-72 -translate-x-1/2 rounded-xl border border-[var(--color-border-default)] p-3 shadow-lg"
      style={{
        background: "rgba(10,10,10,0.85)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
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

      {/* Title */}
      <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Notes</p>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={onBlur}
        placeholder="Jot something down…"
        className="h-[180px] w-full resize-none bg-transparent text-sm leading-relaxed text-white/90 outline-none placeholder:text-white/25"
        spellCheck={false}
      />

      {/* Footer — save indicator */}
      <div className="flex items-center justify-end">
        <span className="text-2xs text-white/30">
          {isSaving ? "Saving…" : text.length > 0 ? "Saved" : ""}
        </span>
      </div>
    </div>
  );
});
