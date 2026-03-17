"use client";

import { useState, useCallback } from "react";
import {
  BarChart3,
  TrendingUp,
  ShieldCheck,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { useAdminData } from "@/lib/admin/useAdminData";
import { StatCard } from "@/components/admin/StatCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { Button } from "@/components/ui/Button";
import { FOREST_300, CORAL_500, PRIORITY_MEDIUM, FOREST_500 } from "@/lib/palette";
import type { ContentPerformance, ScoreCalibration, AutoApprovalConfig, AutoApprovalLogEntry } from "@/lib/types";

// ─── Data interfaces ────────────────────────────────────────

interface PerformanceData {
  overview: {
    avgCompletionRate: number;
    avgEngagementScore: number;
    totalStarts: number;
    totalCompletions: number;
    contentWithData: number;
  };
  topPerforming: ContentPerformance[];
  underperforming: ContentPerformance[];
}

interface AutoApprovalStats {
  approved: number;
  skipped: number;
  capReached: number;
}

// ─── Component ──────────────────────────────────────────────

export function AnalyticsView() {
  const { data: perfData } = useAdminData<PerformanceData>(
    "/api/admin/analytics/performance",
    { refreshInterval: 60000 }
  );
  const { data: calData } = useAdminData<{ calibrations: ScoreCalibration[] }>(
    "/api/admin/analytics/calibrations?limit=10",
    { refreshInterval: 60000 }
  );
  const { data: configData, refresh: refreshConfig } = useAdminData<{ config: AutoApprovalConfig }>(
    "/api/admin/analytics/auto-approval/config",
    { refreshInterval: 60000 }
  );
  const { data: statsData } = useAdminData<{ stats: AutoApprovalStats }>(
    "/api/admin/analytics/auto-approval/stats?daysBack=1",
    { refreshInterval: 30000 }
  );
  const { data: logData } = useAdminData<{ log: AutoApprovalLogEntry[] }>(
    "/api/admin/analytics/auto-approval/log?limit=20",
    { refreshInterval: 60000 }
  );

  const overview = perfData?.overview;
  const calibrations = calData?.calibrations ?? [];
  const config = configData?.config;
  const stats = statsData?.stats;
  const logEntries = logData?.log ?? [];

  const [savingConfig, setSavingConfig] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  // Group calibrations by type (latest per type)
  const latestByType = new Map<string, ScoreCalibration>();
  for (const cal of calibrations) {
    if (!latestByType.has(cal.calibrationType)) {
      latestByType.set(cal.calibrationType, cal);
    }
  }

  const toggleAutoApproval = useCallback(async () => {
    if (!config) return;
    setSavingConfig(true);
    try {
      await fetch("/api/admin/analytics/auto-approval/config", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !config.enabled }),
      });
      refreshConfig();
    } finally {
      setSavingConfig(false);
    }
  }, [config, refreshConfig]);

  const handleReviewCalibration = useCallback(
    async (id: string, apply: boolean) => {
      setReviewingId(id);
      try {
        await fetch(`/api/admin/analytics/calibrations/${id}/review`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apply, reviewedBy: "admin" }),
        });
      } finally {
        setReviewingId(null);
      }
    },
    []
  );

  // ─── Content table columns ─────────────────────────────────

  const contentColumns: Column<ContentPerformance>[] = [
    {
      key: "videoId",
      label: "Video ID",
      render: (row) => (
        <span className="font-mono text-xs text-[var(--sg-shell-300)]">
          {row.videoId.slice(0, 11)}
        </span>
      ),
    },
    {
      key: "worldKey",
      label: "World",
      render: (row) => (
        <span
          className="rounded-full px-2.5 py-1 text-xs font-medium capitalize"
          style={{
            background: "rgba(255,255,255,0.08)",
            color: "var(--sg-shell-300)",
          }}
        >
          {row.worldKey}
        </span>
      ),
    },
    {
      key: "engagementScore",
      label: "Engagement",
      render: (row) => {
        const color =
          row.engagementScore >= 0.7
            ? FOREST_300
            : row.engagementScore >= 0.4
              ? PRIORITY_MEDIUM
              : CORAL_500;
        return (
          <span className="font-mono text-sm font-semibold" style={{ color }}>
            {row.engagementScore.toFixed(3)}
          </span>
        );
      },
    },
    {
      key: "completionRate",
      label: "Completion",
      render: (row) => `${(row.completionRate * 100).toFixed(1)}%`,
    },
    {
      key: "starts",
      label: "Starts",
      render: (row) => row.starts,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Avg Completion Rate"
          value={overview ? `${(overview.avgCompletionRate * 100).toFixed(1)}%` : "—"}
          icon={BarChart3}
          color={FOREST_300}
        />
        <StatCard
          label="Avg Engagement"
          value={overview ? overview.avgEngagementScore.toFixed(3) : "—"}
          icon={TrendingUp}
          color={FOREST_500}
        />
        <StatCard
          label="Auto-Approvals Today"
          value={stats?.approved ?? 0}
          icon={ShieldCheck}
          color={stats && stats.approved > 0 ? FOREST_300 : "var(--sg-shell-500)"}
        />
        <StatCard
          label="Last Calibration"
          value={calibrations.length > 0 ? timeAgo(calibrations[0].runAt) : "Never"}
          icon={Clock}
        />
      </div>

      {/* Score Calibration Panel */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-[var(--sg-white)]">
          Score Calibrations
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {(["taste_score", "heat_score", "creator_authority"] as const).map((type) => {
            const cal = latestByType.get(type);
            const label =
              type === "taste_score"
                ? "Taste Score"
                : type === "heat_score"
                  ? "Heat Score"
                  : "Creator Authority";
            return (
              <div
                key={type}
                className="rounded-xl border border-white/[0.08] p-4"
                style={{ background: "rgba(20,20,20,0.6)" }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--sg-white)]">
                    {label}
                  </span>
                  {cal && (
                    <StatusBadge
                      status={
                        cal.autoApplied
                          ? "completed"
                          : cal.reviewedBy
                            ? "completed"
                            : "pending"
                      }
                    />
                  )}
                </div>
                {cal ? (
                  <div className="mt-3 space-y-2 text-xs text-[var(--sg-shell-500)]">
                    <div className="flex justify-between">
                      <span>Sample size</span>
                      <span className="text-[var(--sg-shell-300)]">{cal.sampleSize}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Correlation</span>
                      <span
                        className="font-mono font-semibold"
                        style={{
                          color:
                            Math.abs(cal.correlation) >= 0.5
                              ? FOREST_300
                              : Math.abs(cal.correlation) >= 0.3
                                ? PRIORITY_MEDIUM
                                : CORAL_500,
                        }}
                      >
                        {cal.correlation.toFixed(4)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Recommendations</span>
                      <span className="text-[var(--sg-shell-300)]">
                        {cal.recommendations.length}
                      </span>
                    </div>
                    {cal.recommendations.length > 0 && !cal.reviewedBy && (
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="ghost"
                          size="xs"
                          loading={reviewingId === cal.id}
                          onClick={() => handleReviewCalibration(cal.id, false)}
                        >
                          Dismiss
                        </Button>
                        <Button
                          variant="primary"
                          size="xs"
                          loading={reviewingId === cal.id}
                          onClick={() => handleReviewCalibration(cal.id, true)}
                        >
                          Apply
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-[var(--sg-shell-500)]">
                    No calibration data yet
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Auto-Approval Panel */}
      <div
        className="rounded-xl border border-white/[0.08] p-5"
        style={{ background: "rgba(20,20,20,0.6)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--sg-white)]">
            Auto-Approval Engine
          </h3>
          <Button
            variant={config?.enabled ? "primary" : "outline"}
            size="xs"
            loading={savingConfig}
            onClick={toggleAutoApproval}
          >
            {config?.enabled ? "Enabled" : "Disabled"}
          </Button>
        </div>

        {config && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <CriteriaCard label="Min Heat" value={config.minHeatScore.toFixed(2)} />
            <CriteriaCard label="Min Content Score" value={String(config.minContentScore)} />
            <CriteriaCard label="Min Authority" value={config.minCreatorAuthority.toFixed(2)} />
            <CriteriaCard label="Min Curriculum" value={String(config.minCurriculumItems)} />
            <CriteriaCard label="Daily Cap" value={String(config.maxDailyApprovals)} />
          </div>
        )}

        {stats && (
          <div className="mt-4 flex gap-6 text-xs text-[var(--sg-shell-500)]">
            <span className="flex items-center gap-1.5">
              <CheckCircle size={12} style={{ color: FOREST_300 }} />
              {stats.approved} approved
            </span>
            <span className="flex items-center gap-1.5">
              <XCircle size={12} style={{ color: CORAL_500 }} />
              {stats.skipped} skipped
            </span>
            <span className="flex items-center gap-1.5">
              <AlertTriangle size={12} style={{ color: PRIORITY_MEDIUM }} />
              {stats.capReached} cap reached
            </span>
          </div>
        )}

        {/* Recent log entries */}
        {logEntries.length > 0 && (
          <div className="mt-4 max-h-48 overflow-y-auto rounded-lg border border-white/[0.08] p-3 space-y-1">
            {logEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs hover:bg-white/[0.02]"
              >
                <span className="w-16 shrink-0 text-[var(--sg-shell-500)]">
                  {new Date(entry.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                </span>
                <StatusBadge status={entry.decision} />
                <span className="min-w-0 flex-1 truncate text-[var(--sg-shell-300)]">
                  {entry.reason}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Performing Content */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-[var(--sg-white)]">
          Top Performing Content
        </h3>
        <DataTable
          columns={contentColumns}
          data={perfData?.topPerforming ?? []}
          rowKey={(row) => `${row.videoId}-${row.periodDate}`}
          emptyMessage="No performance data yet"
        />
      </div>

      {/* Underperforming Content */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-[var(--sg-white)]">
          Underperforming Content
        </h3>
        <DataTable
          columns={contentColumns}
          data={perfData?.underperforming ?? []}
          rowKey={(row) => `${row.videoId}-${row.periodDate}`}
          emptyMessage="No underperforming content detected"
        />
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────

function CriteriaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.04] px-3 py-2">
      <p className="text-xs text-[var(--sg-shell-500)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--sg-white)]">{value}</p>
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}
