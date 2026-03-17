"use client";

import { useState, useCallback } from "react";
import { UserCircle, Star, UserX } from "lucide-react";
import { useAdminData } from "@/lib/admin/useAdminData";
import { StatCard } from "@/components/admin/StatCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { SearchInput } from "@/components/admin/SearchInput";
import { Pagination } from "@/components/admin/Pagination";
import { FOREST_300, CORAL_500, PRIORITY_MEDIUM } from "@/lib/palette";

interface Creator {
  id: string;
  channel_id: string;
  channel_name: string;
  authority_score: number;
  topics: string[];
  partnership_status: string;
  video_count: number;
  opted_out: boolean;
  created_at: string;
  avg_engagement?: number | null;
}

interface CreatorsData {
  creators: Creator[];
  total: number;
  page: number;
}

export function CreatorsView() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const limit = 20;

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set("q", search);
  if (statusFilter) params.set("partnership_status", statusFilter);

  const { data, loading } = useAdminData<CreatorsData>(
    `/api/admin/creators?${params.toString()}`,
    { refreshInterval: 60000 }
  );

  const creators = data?.creators ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const activePartners = creators.filter((c) => c.partnership_status === "partner").length;
  const optedOut = creators.filter((c) => c.opted_out).length;

  const columns: Column<Creator>[] = [
    {
      key: "channel_name",
      label: "Channel",
      render: (row) => (
        <span className="font-medium text-[var(--sg-white)]">
          {row.channel_name}
        </span>
      ),
    },
    {
      key: "authority_score",
      label: "Authority",
      render: (row) => (
        <span className="font-mono text-sm font-semibold">
          {row.authority_score?.toFixed(1) ?? "—"}
        </span>
      ),
    },
    {
      key: "topics",
      label: "Topics",
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {(row.topics ?? []).slice(0, 3).map((t) => (
            <span
              key={t}
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                background: "var(--color-bg-active)",
                color: "var(--sg-shell-300)",
              }}
            >
              {t}
            </span>
          ))}
          {(row.topics ?? []).length > 3 && (
            <span className="text-[10px] text-[var(--sg-shell-500)]">
              +{row.topics.length - 3}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "partnership_status",
      label: "Status",
      render: (row) =>
        row.opted_out ? (
          <StatusBadge status="rejected" label="Opted Out" />
        ) : (
          <StatusBadge status={row.partnership_status ?? "active"} />
        ),
    },
    {
      key: "avg_engagement",
      label: "Avg Engagement",
      render: (row) => {
        if (row.avg_engagement == null) return "—";
        const color =
          row.avg_engagement >= 0.7
            ? FOREST_300
            : row.avg_engagement >= 0.4
              ? PRIORITY_MEDIUM
              : "var(--sg-shell-500)";
        return (
          <span className="font-mono text-xs font-semibold" style={{ color }}>
            {row.avg_engagement.toFixed(3)}
          </span>
        );
      },
    },
    {
      key: "video_count",
      label: "Videos",
      render: (row) => row.video_count ?? 0,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Creators" value={total} icon={UserCircle} />
        <StatCard
          label="Active Partners"
          value={activePartners}
          icon={Star}
          color={FOREST_300}
        />
        <StatCard
          label="Opted Out"
          value={optedOut}
          icon={UserX}
          color={CORAL_500}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-64">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search creators..."
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-lg border border-[var(--color-border-default)] bg-transparent px-3 text-sm text-[var(--sg-shell-300)] focus:border-[var(--color-border-focus)] focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="partner">Partner</option>
          <option value="discovered">Discovered</option>
          <option value="opted_out">Opted Out</option>
        </select>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={creators}
        rowKey={(row) => row.channel_id ?? row.id}
        emptyMessage={loading ? "Loading creators..." : "No creators found"}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
