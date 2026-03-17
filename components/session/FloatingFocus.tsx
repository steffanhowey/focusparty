"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { Minus } from "lucide-react";
import { usePointerDrag } from "@/lib/usePointerDrag";
import { FocusBody, type FocusBodyProps } from "./FocusBody";

interface FloatingFocusProps extends FocusBodyProps {
  onClose: () => void;
  focusButtonRef: React.RefObject<HTMLButtonElement | null>;
}

export function FloatingFocus({
  onClose,
  focusButtonRef,
  ...bodyProps
}: FloatingFocusProps) {
  const { dragRef, dragStyle, wasDraggedRef } = usePointerDrag({
    threshold: 4,
  });

  // null = normal, "from" = frozen at current rect, "to" = animating to button
  const [animPhase, setAnimPhase] = useState<null | "from" | "to">(null);
  const frozenRect = useRef<DOMRect | null>(null);
  const targetRect = useRef<DOMRect | null>(null);

  // Escape to close (instant, no animation)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

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
    const btn = focusButtonRef.current;
    if (!panel || !btn) {
      onClose();
      return;
    }

    frozenRect.current = panel.getBoundingClientRect();
    targetRect.current = btn.getBoundingClientRect();
    setAnimPhase("from");
  }, [onClose, focusButtonRef, dragRef, wasDraggedRef]);

  const handleTransitionEnd = useCallback(
    (e: React.TransitionEvent) => {
      if (e.propertyName === "transform" && animPhase === "to") {
        onClose();
      }
    },
    [animPhase, onClose],
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
          // "from": identity transform at panel's current position
          // "to": translate to button center + scale down
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
            background: "rgba(15,35,24,0.65)",
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
          background: "rgba(15,35,24,0.65)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow: "var(--shadow-float)",
        }}
      >
        {/* Header — drag handle */}
        <div className="flex h-20 cursor-grab items-center justify-between px-4 active:cursor-grabbing md:px-6">
          <span className="text-base font-semibold text-white">Focus</span>
          <button
            type="button"
            onClick={handleMinimize}
            className="cursor-pointer rounded-lg p-1.5 text-[var(--color-text-tertiary)] transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Minimize focus panel"
          >
            <Minus size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1">
          <FocusBody {...bodyProps} maxHeight="max-h-full" />
        </div>
      </div>
    </div>
  );
}
