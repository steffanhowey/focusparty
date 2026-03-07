"use client";

import { SPRINT_DURATION_OPTIONS } from "@/lib/constants";

interface DurationPillsProps {
  value: number;
  onChange: (durationMinutes: number) => void;
}

/**
 * Shared sprint duration pill selector. Used in GoalCard, StartSessionModal, and TimerDropdown.
 */
export function DurationPills({ value, onChange }: DurationPillsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SPRINT_DURATION_OPTIONS.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onChange(d)}
          className="cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-150"
          style={{
            background: d === value ? "var(--color-accent-primary)" : "transparent",
            color: d === value ? "var(--color-text-on-accent)" : "var(--color-text-tertiary)",
            border: d === value ? "none" : "1px solid var(--color-border-default)",
          }}
        >
          {d}m
        </button>
      ))}
    </div>
  );
}
