"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
import { Pagination } from "../Pagination";
import { StatusBadge } from "../StatusBadge";
import { renderActivityEvent, relativeTime } from "@/lib/activityEventRender";
import type { ActivityEvent } from "@/lib/types";

const ACTOR_TYPES = ["user", "host", "system", "synthetic"];
const EVENT_TYPES = [
  "session_started",
  "session_completed",
  "sprint_started",
  "sprint_completed",
  "goal_declared",
  "goal_completed",
  "task_completed",
  "reflection_submitted",
  "participant_joined",
  "participant_left",
  "host_prompt",
  "high_five",
  "check_in",
];

export function ActivityView() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actorType, setActorType] = useState("");
  const [eventType, setEventType] = useState("");
  const [loading, setLoading] = useState(true);
  const limit = 50;

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (actorType) params.set("actor_type", actorType);
      if (eventType) params.set("event_type", eventType);

      const res = await fetch(`/api/admin/activity?${params}`);
      const data = await res.json();
      setEvents(data.events ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      console.error("Failed to fetch activity:", err);
    } finally {
      setLoading(false);
    }
  }, [page, actorType, eventType]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <select
            value={actorType}
            onChange={(e) => {
              setActorType(e.target.value);
              setPage(1);
            }}
            className="h-9 appearance-none rounded-full border border-[var(--color-border-default)] bg-white/[0.04] pl-3 pr-8 text-sm text-[var(--color-text-secondary)] outline-none focus:border-[var(--color-border-focus)]"
          >
            <option value="">All Actors</option>
            {ACTOR_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]"
          />
        </div>
        <div className="relative">
          <select
            value={eventType}
            onChange={(e) => {
              setEventType(e.target.value);
              setPage(1);
            }}
            className="h-9 appearance-none rounded-full border border-[var(--color-border-default)] bg-white/[0.04] pl-3 pr-8 text-sm text-[var(--color-text-secondary)] outline-none focus:border-[var(--color-border-focus)]"
          >
            <option value="">All Events</option>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]"
          />
        </div>
        <button
          type="button"
          onClick={() => fetchActivity()}
          className="flex h-9 items-center gap-1.5 rounded-full border border-[var(--color-border-default)] px-3 text-sm text-[var(--color-text-tertiary)] transition-colors hover:bg-white/[0.04]"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
        <span className="ml-auto text-xs text-[var(--color-text-tertiary)]">
          {total} events
        </span>
      </div>

      {/* Event List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div
            className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent"
            style={{ color: "var(--color-text-tertiary)" }}
          />
        </div>
      ) : (
        <div
          className="rounded-xl border border-[var(--color-border-default)] divide-y divide-[var(--color-border-subtle)]"
          style={{ background: "var(--color-bg-elevated)" }}
        >
          {events.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-[var(--color-text-tertiary)]">
              No events found
            </div>
          ) : (
            events.map((event) => {
              const rendered = renderActivityEvent(event);
              const Icon = rendered.icon;
              return (
                <div
                  key={event.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <Icon
                    size={16}
                    strokeWidth={1.8}
                    className="shrink-0"
                    style={{ color: rendered.color }}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-[var(--color-text-secondary)]">
                    {rendered.label}
                  </span>
                  <StatusBadge status={event.actor_type} />
                  <span className="text-xs text-[var(--color-text-tertiary)]">
                    {event.event_type.replace(/_/g, " ")}
                  </span>
                  <span className="shrink-0 text-xs text-[var(--color-text-tertiary)]">
                    {relativeTime(event.created_at)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
