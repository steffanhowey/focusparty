"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { SPRINT_DURATION_OPTIONS } from "@/lib/constants";

interface TimerDropdownProps {
  currentDurationMin: number;
  onChangeDuration: (durationMinutes: number) => void;
  onReset: () => void;
}

export function TimerDropdown({
  currentDurationMin,
  onChangeDuration,
  onReset,
}: TimerDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <div ref={containerRef} className="relative flex items-center">
      {/* Chevron trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="ml-1.5 rounded p-0.5 text-[var(--color-text-tertiary)] transition-colors hover:bg-white/10 hover:text-white"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Timer options"
      >
        <ChevronDown
          size={14}
          strokeWidth={2}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute left-1/2 top-full mt-2 -translate-x-1/2 rounded-xl border border-[var(--color-border-default)] p-3 shadow-2xl"
          style={{
            background: "rgba(13,14,32,0.95)",
            backdropFilter: "blur(20px)",
            zIndex: 40,
            minWidth: 220,
          }}
          role="menu"
          aria-label="Timer controls"
        >
          {/* Section label */}
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Duration
          </p>

          {/* Duration pills */}
          <div className="flex gap-1.5">
            {SPRINT_DURATION_OPTIONS.map((d) => {
              const isActive = d === currentDurationMin;
              return (
                <button
                  key={d}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onChangeDuration(d);
                    setOpen(false);
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                    isActive
                      ? "bg-[var(--color-accent-primary)] text-white"
                      : "border border-[var(--color-border-default)] text-[var(--color-text-tertiary)] hover:bg-white/[0.06] hover:text-[var(--color-text-secondary)]"
                  }`}
                >
                  {d}m
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="my-2.5 border-t border-[var(--color-border-subtle)]" />

          {/* Reset action */}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onReset();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <RotateCcw size={14} strokeWidth={2} />
            Reset timer
          </button>
        </div>
      )}
    </div>
  );
}
