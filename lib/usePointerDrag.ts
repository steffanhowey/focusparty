"use client";

import { useRef, useState, useEffect, useCallback } from "react";

interface UsePointerDragOptions {
  /** Minimum px moved before treated as drag rather than click. Default: 4 */
  threshold?: number;
}

interface UsePointerDragReturn {
  /** Attach to the draggable element */
  dragRef: React.RefObject<HTMLDivElement | null>;
  /** Spread onto the draggable element's style prop */
  dragStyle: React.CSSProperties;
  /** Ref — read .current inside click handlers to gate click vs drag */
  wasDraggedRef: React.RefObject<boolean>;
  /** Reset position to center */
  resetPosition: () => void;
}

export function usePointerDrag(
  opts?: UsePointerDragOptions
): UsePointerDragReturn {
  const threshold = opts?.threshold ?? 4;

  const dragRef = useRef<HTMLDivElement | null>(null);
  const posRef = useRef({ x: 0, y: 0 });
  const startRef = useRef({ px: 0, py: 0, sx: 0, sy: 0 });
  const draggingRef = useRef(false);
  const distRef = useRef(0);
  const wasDraggedRef = useRef(false);
  const rafRef = useRef(0);
  const boundsRef = useRef({ minX: 0, maxX: 0, minY: 0, maxY: 0 });

  // React state — only updated on pointerUp to sync virtual DOM
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const applyTransform = useCallback((x: number, y: number) => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (dragRef.current) {
        dragRef.current.style.transform = `translateX(-50%) translate(${x}px, ${y}px)`;
      }
    });
  }, []);

  const resetPosition = useCallback(() => {
    posRef.current = { x: 0, y: 0 };
    setPos({ x: 0, y: 0 });
    applyTransform(0, 0);
  }, [applyTransform]);

  useEffect(() => {
    const el = dragRef.current;
    if (!el) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      e.preventDefault();

      const dx = e.clientX - startRef.current.px;
      const dy = e.clientY - startRef.current.py;
      distRef.current = Math.max(distRef.current, Math.abs(dx) + Math.abs(dy));

      const b = boundsRef.current;
      const nx = Math.max(b.minX, Math.min(b.maxX, startRef.current.sx + dx));
      const ny = Math.max(b.minY, Math.min(b.maxY, startRef.current.sy + dy));

      posRef.current = { x: nx, y: ny };
      applyTransform(nx, ny);
    };

    const handlePointerUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;

      if (distRef.current >= threshold) {
        wasDraggedRef.current = true;
      }

      el.style.cursor = "grab";
      setPos({ ...posRef.current });

      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (!e.isPrimary) return;

      // Compute bounds once per drag gesture
      const parent = el.offsetParent as HTMLElement | null;
      if (parent) {
        const pr = parent.getBoundingClientRect();
        const er = el.getBoundingClientRect();
        const baseLeft = er.left - posRef.current.x;
        const baseTop = er.top - posRef.current.y;
        boundsRef.current = {
          minX: pr.left - baseLeft,
          maxX: pr.right - (baseLeft + er.width),
          minY: pr.top - baseTop,
          maxY: pr.bottom - (baseTop + er.height),
        };
      }

      startRef.current = {
        px: e.clientX,
        py: e.clientY,
        sx: posRef.current.x,
        sy: posRef.current.y,
      };
      draggingRef.current = true;
      distRef.current = 0;
      wasDraggedRef.current = false;
      el.style.cursor = "grabbing";

      window.addEventListener("pointermove", handlePointerMove, { passive: false });
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
    };

    el.addEventListener("pointerdown", handlePointerDown);

    return () => {
      el.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      cancelAnimationFrame(rafRef.current);
    };
  }, [threshold, applyTransform]);

  const dragStyle: React.CSSProperties = {
    transform: `translateX(-50%) translate(${pos.x}px, ${pos.y}px)`,
    cursor: "grab",
    touchAction: "none",
    willChange: "transform",
  };

  return { dragRef, dragStyle, wasDraggedRef, resetPosition };
}
