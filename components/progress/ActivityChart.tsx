"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/Card";
import type { DailySessionCount } from "@/lib/types";

interface ActivityChartProps {
  data: DailySessionCount[];
  range: "7d" | "30d";
}

/** Format a YYYY-MM-DD string into a short label. */
function formatDay(day: string, range: "7d" | "30d"): string {
  const d = new Date(day + "T00:00:00");
  if (range === "7d") {
    return d.toLocaleDateString(undefined, { weekday: "short" });
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function ActivityChart({ data, range }: ActivityChartProps) {
  const maxSessions = useMemo(
    () => Math.max(1, ...data.map((d) => d.sessions)),
    [data]
  );

  const isCompact = range === "30d";

  if (data.length === 0) {
    return (
      <Card variant="default" className="p-5">
        <p className="text-center text-sm text-[var(--sg-shell-500)]">
          No activity data yet
        </p>
      </Card>
    );
  }

  return (
    <Card variant="default" className="p-5">
      {/* Bar chart */}
      <div
        className="flex items-end gap-1"
        style={{ height: 120 }}
      >
        {data.map((d) => {
          const heightPct = (d.sessions / maxSessions) * 100;
          const isToday =
            d.day === new Date().toISOString().slice(0, 10);

          return (
            <div
              key={d.day}
              className="flex flex-1 flex-col items-center justify-end"
              style={{ height: "100%" }}
              title={`${d.day}: ${d.sessions} session${d.sessions !== 1 ? "s" : ""}`}
            >
              <div
                className="w-full rounded-t-sm transition-all duration-300"
                style={{
                  height: d.sessions > 0 ? `${Math.max(heightPct, 8)}%` : 4,
                  minHeight: d.sessions > 0 ? 6 : 2,
                  backgroundColor: d.sessions > 0
                    ? isToday
                      ? "var(--sg-forest-500)"
                      : "var(--sg-teal-500)"
                    : "var(--sg-shell-200)",
                  maxWidth: isCompact ? 8 : 28,
                }}
              />
            </div>
          );
        })}
      </div>

      {/* X-axis labels */}
      {!isCompact && (
        <div className="mt-2 flex">
          {data.map((d) => (
            <div
              key={d.day}
              className="flex-1 text-center text-2xs text-[var(--sg-shell-500)]"
            >
              {formatDay(d.day, range)}
            </div>
          ))}
        </div>
      )}

      {isCompact && (
        <div className="mt-2 flex justify-between">
          <span className="text-2xs text-[var(--sg-shell-500)]">
            {formatDay(data[0].day, range)}
          </span>
          <span className="text-2xs text-[var(--sg-shell-500)]">
            Today
          </span>
        </div>
      )}
    </Card>
  );
}
