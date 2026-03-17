"use client";

import { type RefObject, useEffect } from "react";
import { MenuItem } from "@/components/ui/MenuItem";
import { BREAK_CATEGORIES, type BreakCategory } from "@/lib/breakConstants";

const ICON = { size: 14, strokeWidth: 1.8 } as const;

interface BreakCategoryPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  /** Ref to the wrapper that includes the trigger button — clicks inside won't close */
  wrapperRef: RefObject<HTMLDivElement | null>;
  onSelectCategory: (category: BreakCategory) => void;
}

export function BreakCategoryPopover({
  isOpen,
  onClose,
  wrapperRef,
  onSelectCategory,
}: BreakCategoryPopoverProps) {
  // Click-outside and Escape to close (same pattern as CheckInMenu)
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, onClose, wrapperRef]);

  if (!isOpen) return null;

  return (
    <div
      className="absolute bottom-full left-1/2 mb-3 -translate-x-1/2 rounded-xl border border-[var(--color-border-default)] p-3 shadow-lg"
      style={{
        background: "rgba(15,35,24,0.85)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        zIndex: 40,
        minWidth: 200,
        boxShadow: "var(--shadow-float)",
      }}
      role="dialog"
      aria-label="Break categories"
    >
      <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
        Take a break
      </p>

      <div className="flex flex-col gap-0.5">
        {BREAK_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <MenuItem
              key={cat.id}
              icon={<Icon {...ICON} style={{ color: cat.color }} />}
              onClick={() => onSelectCategory(cat.id)}
            >
              {cat.label}
            </MenuItem>
          );
        })}
      </div>
    </div>
  );
}
