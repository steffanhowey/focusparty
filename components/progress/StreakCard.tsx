"use client";

import { Flame } from "lucide-react";
import { Card } from "@/components/ui/Card";

interface StreakCardProps {
  currentStreak: number;
  bestStreak: number;
}

export function StreakCard({ currentStreak, bestStreak }: StreakCardProps) {
  const isActive = currentStreak > 0;

  return (
    <Card variant="default" className="p-5">
      <div className="flex items-center gap-4">
        {/* Flame icon */}
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
          style={{
            background: isActive
              ? "var(--color-bg-active)"
              : "var(--color-bg-hover)",
          }}
        >
          <Flame
            size={28}
            style={{
              color: isActive ? "var(--color-text-secondary)" : "var(--color-text-tertiary)",
            }}
          />
        </div>

        {/* Streak numbers */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span
              className="text-3xl font-bold text-white"
            >
              {currentStreak}
            </span>
            <span className="text-sm text-[var(--color-text-secondary)]">
              day{currentStreak !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
            {isActive
              ? "Keep it going!"
              : "Start a session to build your streak"}
          </p>
        </div>

        {/* Best streak badge */}
        <div className="text-right">
          <p className="text-xs text-[var(--color-text-tertiary)]">Best</p>
          <p
            className="text-lg font-semibold text-white"
          >
            {bestStreak}
          </p>
        </div>
      </div>
    </Card>
  );
}
