"use client";

import { useEffect, useMemo } from "react";
import { X } from "lucide-react";
import {
  renderActivityEvent,
  relativeTime,
} from "@/lib/activityEventRender";
import type { ActivityEvent } from "@/lib/types";

// Momentum only shows wins — accomplishments that create energy.
// Everything else (joins, starts, breaks, commits) is noise.
const MOMENTUM_EVENTS = new Set([
  "task_completed",
  "sprint_completed",
  "high_five",
  "goal_completed",
  "goal_shipped",
]);

function isMomentumEvent(e: ActivityEvent): boolean {
  if (MOMENTUM_EVENTS.has(e.event_type)) return true;
  if (
    e.event_type === "check_in" &&
    (e.payload as Record<string, unknown> | null)?.action === "ship"
  )
    return true;
  return false;
}

interface EnvironmentRailProps {
  activityEvents: ActivityEvent[];
  /** userId → displayName for resolving actor names. */
  displayNameMap: Map<string, string>;
  onClose: () => void;
}

export function EnvironmentRail({
  activityEvents,
  displayNameMap,
  onClose,
}: EnvironmentRailProps) {
  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Filter to wins, show latest first
  const recentEvents = useMemo(() => {
    return activityEvents.filter(isMomentumEvent).slice(-15).reverse();
  }, [activityEvents]);

  return (
    <>
      {/* Panel header */}
      <div
        className="flex h-20 items-center justify-between px-4 md:px-6"
      >
        <span className="text-base font-semibold text-white">Momentum</span>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-lg p-1.5 text-[rgba(255,255,255,0.4)] transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Close momentum"
        >
          <X size={18} strokeWidth={2} />
        </button>
      </div>

      {/* Activity feed */}
      <div className="fp-shell-scroll flex-1 overflow-y-auto px-5 py-3">
        {recentEvents.length === 0 ? (
          <p className="py-4 text-center text-xs text-white/30">
            No wins yet — they&apos;ll show up here
          </p>
        ) : (
          <div className="space-y-2.5">
            {recentEvents.map((event) => {
              const actorName = displayNameMap.get(event.user_id ?? "");
              const rendered = renderActivityEvent(event, actorName);
              const Icon = rendered.icon;
              return (
                <div
                  key={event.id}
                  className="flex items-start gap-2 text-xs"
                >
                  <Icon
                    size={14}
                    className="mt-0.5 shrink-0"
                    style={{ color: rendered.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-white/70">{rendered.label}</span>
                    <span className="ml-1.5 text-white/30">
                      {relativeTime(event.created_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
