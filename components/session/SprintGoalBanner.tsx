"use client";

import { Target, Lock, Users, ArrowRight } from "lucide-react";
import type { CommitmentType } from "@/lib/types";

interface SprintGoalBannerProps {
  goalText: string;
  parentGoalTitle?: string | null;
  commitmentType?: CommitmentType;
  taskProgress?: { completed: number; total: number } | null;
}

export function SprintGoalBanner({
  goalText,
  parentGoalTitle,
  commitmentType,
  taskProgress,
}: SprintGoalBannerProps) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.06)",
        textShadow: "0 1px 4px rgba(0,0,0,0.6)",
      }}
    >
      <Target
        size={14}
        strokeWidth={1.8}
        className="shrink-0 text-[var(--color-accent-primary)]"
      />
      <div className="min-w-0 flex-1">
        {parentGoalTitle ? (
          <>
            <p className="truncate text-[11px] font-medium text-[var(--color-text-tertiary)]">
              {parentGoalTitle}
              {taskProgress && taskProgress.total > 0 && (
                <span className="ml-1.5 text-[10px] text-white/30">
                  {taskProgress.completed}/{taskProgress.total}
                </span>
              )}
            </p>
            <p className="mt-0.5 flex items-center gap-1 truncate text-sm font-medium text-white">
              <ArrowRight size={10} strokeWidth={2} className="shrink-0 text-white/30" />
              {goalText}
            </p>
          </>
        ) : (
          <p className="truncate text-sm font-medium text-white">{goalText}</p>
        )}
      </div>
      {/* Progress pill (only when no parent — otherwise shown inline above) */}
      {!parentGoalTitle && taskProgress && taskProgress.total > 0 && (
        <span className="shrink-0 text-[11px] text-[var(--color-text-tertiary)]">
          {taskProgress.completed}/{taskProgress.total}
        </span>
      )}
      {commitmentType === "social" && (
        <Users size={13} strokeWidth={1.8} className="shrink-0 text-white/40" />
      )}
      {commitmentType === "locked" && (
        <Lock size={13} strokeWidth={1.8} className="shrink-0 text-amber-400/70" />
      )}
    </div>
  );
}
