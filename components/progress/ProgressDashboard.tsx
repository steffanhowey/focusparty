"use client";

import { useState } from "react";
import { Timer, Zap, CheckCircle2, CalendarDays } from "lucide-react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { useUserProgress } from "@/lib/useUserProgress";
import { StatsCard } from "./StatsCard";
import { StreakCard } from "./StreakCard";
import { ActivityChart } from "./ActivityChart";
import { RecentActivityList } from "./RecentActivityList";
import { FavoritePartiesCard } from "./FavoritePartiesCard";

export function ProgressDashboard() {
  const { userId } = useCurrentUser();
  const progress = useUserProgress(userId);
  const [chartRange, setChartRange] = useState<"7d" | "30d">("7d");

  if (progress.loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-text-tertiary)] border-t-transparent" />
      </div>
    );
  }

  if (progress.error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-[var(--color-text-secondary)]">
          {progress.error}
        </p>
      </div>
    );
  }

  const stats = progress.stats;
  const streak = progress.streak;
  const chartData = chartRange === "7d" ? progress.chart7d : progress.chart30d;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Your focus journey at a glance
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatsCard
          label="Sessions"
          value={stats?.totalCompletedSessions ?? 0}
          sublabel="completed"
          icon={<CheckCircle2 size={18} />}
        />
        <StatsCard
          label="Focus Time"
          value={stats ? formatMinutes(stats.totalFocusMinutes) : "0m"}
          sublabel="total"
          icon={<Timer size={18} />}
        />
        <StatsCard
          label="Sprints"
          value={stats?.totalCompletedSprints ?? 0}
          sublabel="completed"
          icon={<Zap size={18} />}
        />
        <StatsCard
          label="This Week"
          value={stats?.sessionsThisWeek ?? 0}
          sublabel="sessions"
          icon={<CalendarDays size={18} />}
        />
      </div>

      {/* Streak */}
      <div>
        <h3 className="mb-2 text-sm font-medium text-[var(--color-text-secondary)]">
          Streak
        </h3>
        <StreakCard
          currentStreak={streak?.currentStreak ?? 0}
          bestStreak={streak?.bestStreak ?? 0}
        />
      </div>

      {/* Activity chart */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">
            Activity
          </h3>
          <div className="flex gap-1 rounded-full bg-[var(--color-bg-hover)] p-0.5">
            <button
              type="button"
              onClick={() => setChartRange("7d")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                chartRange === "7d"
                  ? "bg-[var(--color-bg-secondary)] text-white shadow-sm"
                  : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
              }`}
            >
              7d
            </button>
            <button
              type="button"
              onClick={() => setChartRange("30d")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                chartRange === "30d"
                  ? "bg-[var(--color-bg-secondary)] text-white shadow-sm"
                  : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
              }`}
            >
              30d
            </button>
          </div>
        </div>
        <ActivityChart data={chartData} range={chartRange} />
      </div>

      {/* Two-column: Recent activity + Favorite parties */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <h3 className="mb-2 text-sm font-medium text-[var(--color-text-secondary)]">
            Recent Activity
          </h3>
          <RecentActivityList events={progress.recentActivity} />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium text-[var(--color-text-secondary)]">
            Favorite Parties
          </h3>
          <FavoritePartiesCard parties={progress.favoriteParties} />
        </div>
      </div>
    </div>
  );
}

/** Format minutes into a human-readable string. */
function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}
