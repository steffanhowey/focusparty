"use client";

import { SPRINT_DURATION_OPTIONS } from "@/lib/constants";

interface DurationPillsProps {
  value: number;
  onChange: (durationMinutes: number) => void;
  /** Custom options — defaults to SPRINT_DURATION_OPTIONS */
  options?: readonly number[];
  /** Suffix for each label — defaults to "m" */
  suffix?: string;
}

/**
 * Pill-shaped tab selector with a sliding background indicator.
 * Used for sprint durations, break durations, and anywhere a small set
 * of numeric options needs a compact, tactile picker.
 */
export function DurationPills({
  value,
  onChange,
  options = SPRINT_DURATION_OPTIONS,
  suffix = "m",
}: DurationPillsProps) {
  return (
    <div
      className="flex rounded-full p-0.5"
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {options.map((d) => {
        const isActive = d === value;
        return (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            className="relative flex-1 cursor-pointer rounded-full py-1.5 text-center text-xs font-medium transition-all duration-150"
            style={{
              background: isActive ? "rgba(255,255,255,0.10)" : "transparent",
              color: isActive ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.35)",
              boxShadow: isActive
                ? "0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)"
                : "none",
            }}
          >
            {d}{suffix}
          </button>
        );
      })}
    </div>
  );
}
