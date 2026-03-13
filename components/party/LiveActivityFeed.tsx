"use client";

import { useEffect, useRef } from "react";
import { renderActivityEvent, relativeTime } from "@/lib/activityEventRender";
import type { ActivityFeedItem } from "@/lib/types";

interface LiveActivityFeedProps {
  events: ActivityFeedItem[];
  isLoading: boolean;
  maxHeight?: number;
}

export function LiveActivityFeed({
  events,
  isLoading,
  maxHeight = 280,
}: LiveActivityFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(events.length);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (events.length > prevCountRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevCountRef.current = events.length;
  }, [events.length]);

  if (isLoading) {
    return (
      <div className="space-y-3 py-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-[var(--color-bg-hover)] animate-pulse" />
            <div
              className="h-3 rounded bg-[var(--color-bg-hover)] animate-pulse"
              style={{ width: `${50 + i * 15}%` }}
            />
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-[var(--color-text-tertiary)]">
        No activity yet — start a session to get the momentum going
      </p>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="overflow-y-auto scrollbar-thin"
      style={{ maxHeight }}
    >
      <div className="space-y-2.5 py-1">
        {events.map((event) => {
          const rendered = renderActivityEvent(event);
          const Icon = rendered.icon;

          return (
            <div key={event.id} className="flex items-start gap-2.5">
              <div
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${rendered.color}20` }}
              >
                <Icon size={11} style={{ color: rendered.color }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug text-[var(--color-text-secondary)]">
                  {event.displayText}
                </p>
                <p className="mt-0.5 text-2xs text-[var(--color-text-tertiary)]">
                  {relativeTime(event.created_at)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
