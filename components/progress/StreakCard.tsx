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
              ? "var(--sg-forest-100)"
              : "var(--sg-shell-100)",
          }}
        >
          <Flame
            size={28}
            style={{
              color: isActive ? "var(--sg-forest-500)" : "var(--sg-shell-400)",
            }}
          />
        </div>

        {/* Streak numbers */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-[var(--sg-shell-900)]">
              {currentStreak}
            </span>
            <span className="text-sm text-[var(--sg-shell-600)]">
              day{currentStreak !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-[var(--sg-shell-600)]">
            {isActive
              ? "Keep it going!"
              : "Start a session to build your streak"}
          </p>
        </div>

        {/* Best streak badge */}
        <div className="text-right">
          <p className="text-xs text-[var(--sg-shell-500)]">Best</p>
          <p className="text-lg font-semibold text-[var(--sg-shell-900)]">
            {bestStreak}
          </p>
        </div>
      </div>
    </Card>
  );
}
