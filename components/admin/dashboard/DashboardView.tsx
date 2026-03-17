"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, Zap, Calendar, PartyPopper, RefreshCw, Bot, Image } from "lucide-react";
import { StatCard } from "../StatCard";
import { StatusBadge } from "../StatusBadge";
import { renderActivityEvent, relativeTime } from "@/lib/activityEventRender";
import type { ActivityEvent } from "@/lib/types";

interface Stats {
  totalUsers: number;
  activeSessionsNow: number;
  sessionsToday: number;
  activeParties: number;
}

export function DashboardView() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, activityRes] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch("/api/admin/activity?limit=30"),
      ]);
      const statsData = await statsRes.json();
      const activityData = await activityRes.json();
      setStats(statsData);
      setEvents(activityData.events ?? []);
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleQuickAction = async (action: string) => {
    try {
      if (action === "rotate") {
        await fetch("/api/backgrounds/rotate", { method: "POST" });
      } else if (action === "tick") {
        await fetch("/api/synthetics/tick", { method: "POST" });
      }
      // Refresh stats after action
      fetchData();
    } catch (err) {
      console.error("Quick action failed:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent"
          style={{ color: "var(--sg-shell-500)" }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Users"
          value={stats?.totalUsers ?? 0}
          icon={Users}
          color="var(--sg-teal-600)"
        />
        <StatCard
          label="Active Sessions"
          value={stats?.activeSessionsNow ?? 0}
          icon={Zap}
          color="var(--sg-forest-300)"
        />
        <StatCard
          label="Sessions Today"
          value={stats?.sessionsToday ?? 0}
          icon={Calendar}
          color="var(--sg-gold-600)"
        />
        <StatCard
          label="Active Parties"
          value={stats?.activeParties ?? 0}
          icon={PartyPopper}
          color="var(--sg-teal-600)"
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--sg-shell-500)]">
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => handleQuickAction("rotate")}
            className="flex items-center gap-2 rounded-full border border-white/[0.08] px-4 py-2.5 text-sm font-medium text-[var(--sg-shell-300)] transition-colors hover:bg-white/[0.04]"
          >
            <Image size={16} strokeWidth={1.8} />
            Rotate Backgrounds
          </button>
          <button
            type="button"
            onClick={() => handleQuickAction("tick")}
            className="flex items-center gap-2 rounded-full border border-white/[0.08] px-4 py-2.5 text-sm font-medium text-[var(--sg-shell-300)] transition-colors hover:bg-white/[0.04]"
          >
            <Bot size={16} strokeWidth={1.8} />
            Trigger Synthetic Tick
          </button>
          <button
            type="button"
            onClick={() => fetchData()}
            className="flex items-center gap-2 rounded-full border border-white/[0.08] px-4 py-2.5 text-sm font-medium text-[var(--sg-shell-300)] transition-colors hover:bg-white/[0.04]"
          >
            <RefreshCw size={16} strokeWidth={1.8} />
            Refresh
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--sg-shell-500)]">
          Recent Activity
        </h2>
        <div
          className="rounded-xl border border-white/[0.08] divide-y divide-white/[0.04]"
          style={{ background: "rgba(20,20,20,0.6)" }}
        >
          {events.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-[var(--sg-shell-500)]">
              No recent activity
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
                  <span className="min-w-0 flex-1 truncate text-sm text-[var(--sg-shell-300)]">
                    {rendered.label}
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={event.actor_type} />
                    <span className="text-xs text-[var(--sg-shell-500)]">
                      {relativeTime(event.created_at)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
