"use client";

import { RotateCcw } from "lucide-react";
import { DurationPills } from "./DurationPills";

interface GoalCardProps {
  currentDurationMin: number;
  onChangeDuration: (durationMinutes: number) => void;
  onResetTimer: () => void;
}

export function GoalCard({
  currentDurationMin,
  onChangeDuration,
  onResetTimer,
}: GoalCardProps) {
  return (
    <div
      className="absolute top-0 left-1/2 -translate-x-1/2 rounded-b-lg border-x border-b border-[var(--color-border-default)] p-4 md:p-6"
      style={{
        zIndex: 20,
        background: "rgba(10,10,10,0.80)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        boxShadow: "var(--shadow-float)",
      }}
    >
      <div className="flex items-center gap-2">
        <DurationPills value={currentDurationMin} onChange={onChangeDuration} />
        <button
          type="button"
          onClick={onResetTimer}
          className="ml-auto flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs text-[var(--color-text-tertiary)] transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Reset timer"
        >
          <RotateCcw size={12} strokeWidth={2} />
          Reset
        </button>
      </div>
    </div>
  );
}
