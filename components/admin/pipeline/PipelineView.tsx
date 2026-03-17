"use client";

import { useState, useCallback } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Play,
  XCircle,
} from "lucide-react";
import { useAdminData } from "@/lib/admin/useAdminData";
import { StatCard } from "@/components/admin/StatCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { Button } from "@/components/ui/Button";
import { FOREST_300, CORAL_500, PRIORITY_MEDIUM } from "@/lib/palette";

interface JobSummary {
  jobType: string;
  jobName: string;
  lastRunAt: string | null;
  lastStatus: string | null;
  runsLast24h: number;
  successRate: number;
  avgDurationMs: number;
  isHealthy: boolean;
}

interface PipelineAlert {
  severity: "warning" | "critical";
  jobType: string;
  message: string;
  lastRunAt: string | null;
  expectedFrequencyMinutes: number;
}

interface PipelineEvent {
  id: string;
  jobName: string;
  jobType: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  status: string;
  itemsProcessed: number;
  itemsSucceeded: number;
  itemsFailed: number;
  summary: Record<string, unknown>;
  errors: Array<{ message: string }>;
}

interface HealthData {
  jobs: JobSummary[];
  overallHealth: string;
  alerts: PipelineAlert[];
}

const JOB_SCHEDULES: Record<string, string> = {
  signal_collection: "Every 15min",
  topic_clustering: "Hourly",
  discovery_scheduled: "Every 6h",
  discovery_hot_topic: "Every 2h",
  evaluation: "2x daily",
  scaffolding: "2x daily",
  shelf_refresh: "Daily 4am",
  room_auto_generate: "Every 4h",
  room_lifecycle: "Daily 5am",
  background_rotate: "Daily 6am",
  analytics_aggregation: "Daily 2am",
  score_calibration: "Weekly Sun 3am",
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const ms = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function PipelineView() {
  const { data: health } = useAdminData<HealthData>("/api/admin/pipeline/health", {
    refreshInterval: 30000,
  });
  const { data: eventsData, refresh: refreshEvents } = useAdminData<{
    events: PipelineEvent[];
  }>("/api/admin/pipeline/events?limit=50", { refreshInterval: 30000 });

  const [triggeringJob, setTriggeringJob] = useState<string | null>(null);

  const jobs = health?.jobs ?? [];
  const alerts = health?.alerts ?? [];
  const events = eventsData?.events ?? [];
  const healthyCount = jobs.filter((j) => j.isHealthy).length;
  const avgDuration =
    jobs.length > 0
      ? Math.round(jobs.reduce((s, j) => s + j.avgDurationMs, 0) / jobs.length)
      : 0;

  const triggerJob = useCallback(
    async (jobType: string) => {
      setTriggeringJob(jobType);
      try {
        await fetch("/api/admin/pipeline/trigger", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobType }),
        });
        refreshEvents();
      } finally {
        setTriggeringJob(null);
      }
    },
    [refreshEvents]
  );

  const jobColumns: Column<JobSummary>[] = [
    {
      key: "jobName",
      label: "Job",
      render: (row) => (
        <span className="font-medium text-[var(--sg-white)]">
          {row.jobName}
        </span>
      ),
    },
    {
      key: "schedule",
      label: "Schedule",
      render: (row) => JOB_SCHEDULES[row.jobType] ?? "—",
    },
    {
      key: "lastRunAt",
      label: "Last Run",
      render: (row) => timeAgo(row.lastRunAt),
    },
    {
      key: "lastStatus",
      label: "Status",
      render: (row) =>
        row.lastStatus ? <StatusBadge status={row.lastStatus} /> : "—",
    },
    {
      key: "runsLast24h",
      label: "Runs (24h)",
      render: (row) => row.runsLast24h,
    },
    {
      key: "successRate",
      label: "Success",
      render: (row) => `${Math.round(row.successRate * 100)}%`,
    },
    {
      key: "avgDurationMs",
      label: "Avg Duration",
      render: (row) => (row.avgDurationMs > 0 ? formatMs(row.avgDurationMs) : "—"),
    },
    {
      key: "actions",
      label: "",
      width: "80px",
      render: (row) => (
        <Button
          variant="ghost"
          size="xs"
          leftIcon={<Play size={12} />}
          loading={triggeringJob === row.jobType}
          onClick={(e) => {
            e.stopPropagation();
            triggerJob(row.jobType);
          }}
        >
          Run
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Overall Health"
          value={health?.overallHealth ?? "—"}
          icon={Activity}
          color={
            health?.overallHealth === "healthy"
              ? FOREST_300
              : health?.overallHealth === "degraded"
                ? PRIORITY_MEDIUM
                : CORAL_500
          }
        />
        <StatCard
          label="Jobs Healthy"
          value={`${healthyCount}/${jobs.length}`}
          icon={CheckCircle}
          color={FOREST_300}
        />
        <StatCard
          label="Active Alerts"
          value={alerts.length}
          icon={AlertTriangle}
          color={alerts.length > 0 ? CORAL_500 : FOREST_300}
        />
        <StatCard
          label="Avg Duration"
          value={avgDuration > 0 ? formatMs(avgDuration) : "—"}
          icon={Clock}
        />
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div
          className="rounded-xl border p-4 space-y-2"
          style={{
            borderColor: "var(--sg-coral-500)",
            background: "var(--sg-coral-500)" + "08",
          }}
        >
          <h3 className="text-sm font-semibold text-[var(--sg-white)]">
            Alerts
          </h3>
          {alerts.map((alert, i) => (
            <div
              key={`${alert.jobType}-${i}`}
              className="flex items-center gap-3 text-sm"
            >
              {alert.severity === "critical" ? (
                <XCircle size={16} style={{ color: "var(--sg-coral-500)" }} />
              ) : (
                <AlertTriangle size={16} style={{ color: PRIORITY_MEDIUM }} />
              )}
              <span className="text-[var(--sg-shell-300)]">
                {alert.message}
              </span>
              <Button
                variant="ghost"
                size="xs"
                leftIcon={<Play size={12} />}
                loading={triggeringJob === alert.jobType}
                onClick={() => triggerJob(alert.jobType)}
              >
                Run Now
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Job status table */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-[var(--sg-white)]">
          Job Status
        </h3>
        <DataTable
          columns={jobColumns}
          data={jobs}
          rowKey={(row) => row.jobType}
          emptyMessage="No pipeline jobs found"
        />
      </div>

      {/* Recent events */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-[var(--sg-white)]">
          Recent Events
        </h3>
        <div className="max-h-96 space-y-1 overflow-y-auto rounded-lg border border-white/[0.08] p-3">
          {events.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--sg-shell-500)]">
              No events in the last 24 hours
            </p>
          ) : (
            events.map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-white/[0.02]"
              >
                <span className="w-20 shrink-0 text-xs text-[var(--sg-shell-500)]">
                  {new Date(event.startedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <StatusBadge status={event.status} />
                <span className="min-w-0 flex-1 truncate text-[var(--sg-shell-300)]">
                  {event.jobName}
                </span>
                <span className="text-xs text-[var(--sg-shell-500)]">
                  {event.itemsProcessed > 0 && `${event.itemsProcessed} items`}
                </span>
                <span className="text-xs text-[var(--sg-shell-500)]">
                  {event.durationMs != null && formatMs(event.durationMs)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
