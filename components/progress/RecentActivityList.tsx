"use client";

import { Card } from "@/components/ui/Card";
import { renderActivityEvent, relativeTime } from "@/lib/activityEventRender";
import type { ActivityEvent } from "@/lib/types";

interface RecentActivityListProps {
  events: ActivityEvent[];
}

export function RecentActivityList({ events }: RecentActivityListProps) {
  if (events.length === 0) {
    return (
      <Card variant="default" className="p-5">
        <p className="text-center text-sm text-[var(--color-text-tertiary)]">
          No activity yet — complete a session to see your momentum
        </p>
      </Card>
    );
  }

  return (
    <Card variant="default" className="p-4">
      <div className="space-y-3">
        {events.map((event) => {
          const rendered = renderActivityEvent(event, "You");
          const Icon = rendered.icon;

          return (
            <div key={event.id} className="flex items-start gap-3">
              <div
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${rendered.color}20` }}
              >
                <Icon size={13} style={{ color: rendered.color }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug text-[var(--color-text-secondary)]">
                  {rendered.label}
                </p>
                <p className="mt-0.5 text-2xs text-[var(--color-text-tertiary)]">
                  {relativeTime(event.created_at)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
