"use client";

import { useState, useCallback } from "react";
import { ClipboardCheck, Eye, ShieldCheck } from "lucide-react";
import { useAdminData } from "@/lib/admin/useAdminData";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/Button";
import { BlueprintDetailModal } from "./BlueprintDetailModal";

interface Blueprint {
  id: string;
  room_name: string;
  room_description: string;
  topic: string;
  topic_slug: string;
  heat_score_at_generation: number;
  review_status: string;
  review_notes: string | null;
  status: string;
  generation_source: string;
  created_at: string;
  reviewed_at: string | null;
  content_selection: Record<string, unknown> | null;
  curriculum_sequence: unknown[] | null;
}

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
] as const;

export function ReviewQueueView() {
  const [activeTab, setActiveTab] = useState<string>("pending");
  const [selectedBp, setSelectedBp] = useState<Blueprint | null>(null);

  const { data, loading, refresh, mutate } = useAdminData<{
    blueprints: Blueprint[];
  }>(`/api/admin/rooms/auto-generated?review_status=${activeTab}`, {
    refreshInterval: 60000,
  });

  const { data: autoStats } = useAdminData<{
    stats: { approved: number; skipped: number; capReached: number };
  }>("/api/admin/analytics/auto-approval/stats?daysBack=1", {
    refreshInterval: 60000,
  });

  const blueprints = data?.blueprints ?? [];

  const handleApprove = useCallback(
    async (id: string) => {
      await fetch(`/api/admin/rooms/auto-generated/${id}/approve`, {
        method: "POST",
        credentials: "include",
      });
      mutate((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          blueprints: prev.blueprints.filter((bp) => bp.id !== id),
        };
      });
      setSelectedBp(null);
    },
    [mutate]
  );

  const handleReject = useCallback(
    async (id: string, notes?: string) => {
      await fetch(`/api/admin/rooms/auto-generated/${id}/reject`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      mutate((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          blueprints: prev.blueprints.filter((bp) => bp.id !== id),
        };
      });
      setSelectedBp(null);
    },
    [mutate]
  );

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-[var(--color-border-default)] p-1 w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-white/[0.08] text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {autoStats?.stats && autoStats.stats.approved > 0 && (
          <span className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium" style={{ background: "var(--sg-forest-500)" + "18", color: "var(--sg-forest-500)" }}>
            <ShieldCheck size={12} />
            {autoStats.stats.approved} auto-approved today
          </span>
        )}
      </div>

      {/* Loading */}
      {loading && blueprints.length === 0 && (
        <div className="py-12 text-center text-[var(--color-text-tertiary)]">
          Loading blueprints...
        </div>
      )}

      {/* Empty state */}
      {!loading && blueprints.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <ClipboardCheck
            size={40}
            strokeWidth={1.2}
            className="text-[var(--color-text-tertiary)]"
          />
          <p className="text-[var(--color-text-tertiary)]">
            {activeTab === "pending"
              ? "No pending blueprints — auto-generator runs every 4 hours"
              : `No ${activeTab} blueprints`}
          </p>
        </div>
      )}

      {/* Blueprint cards grid */}
      {blueprints.length > 0 && (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))" }}>
          {blueprints.map((bp) => (
            <div
              key={bp.id}
              className="rounded-xl border border-[var(--color-border-default)] p-5 transition-colors hover:border-[var(--color-border-focus)]"
              style={{ background: "var(--color-bg-elevated)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-semibold text-[var(--color-text-primary)]">
                    {bp.room_name}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-sm text-[var(--color-text-tertiary)]">
                    {bp.room_description}
                  </p>
                </div>
                <StatusBadge status={bp.review_status} />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-tertiary)]">
                <span
                  className="rounded-full px-2.5 py-1 font-medium"
                  style={{
                    background: "var(--sg-forest-500)" + "18",
                    color: "var(--sg-forest-500)",
                  }}
                >
                  {bp.topic}
                </span>
                <span>Heat: {(bp.heat_score_at_generation ?? 0).toFixed(2)}</span>
                <span>
                  {bp.curriculum_sequence
                    ? `${(bp.curriculum_sequence as unknown[]).length} videos`
                    : "No curriculum"}
                </span>
                <span>{new Date(bp.created_at).toLocaleDateString()}</span>
              </div>

              <div className="mt-4">
                <Button
                  variant="ghost"
                  size="xs"
                  leftIcon={<Eye size={14} />}
                  onClick={() => setSelectedBp(bp)}
                >
                  Preview
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selectedBp && (
        <BlueprintDetailModal
          blueprint={selectedBp}
          onClose={() => setSelectedBp(null)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </div>
  );
}
