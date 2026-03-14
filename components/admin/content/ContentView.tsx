"use client";

import { useState, useCallback } from "react";
import {
  Film,
  CheckCircle,
  BookOpen,
  Library,
} from "lucide-react";
import { useAdminData } from "@/lib/admin/useAdminData";
import { StatCard } from "@/components/admin/StatCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { SearchInput } from "@/components/admin/SearchInput";
import { Pagination } from "@/components/admin/Pagination";
import { GREEN_700, PRIORITY_MEDIUM } from "@/lib/palette";

interface ContentItem {
  id: string;
  video_id: string;
  title: string;
  channel_name: string;
  world_key: string;
  category: string;
  status: string;
  scaffolding_status: string | null;
  duration_seconds: number;
  published_at: string | null;
  created_at: string;
  engagement_score?: number | null;
  fp_break_content_scores: Array<{
    taste_score: number;
    relevance: number;
    engagement: number;
    content_density: number;
  }> | null;
}

interface FunnelData {
  funnel: {
    candidates: number;
    evaluated: number;
    scaffolded: number;
    onShelf: number;
  };
}

export function ContentView() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const limit = 20;

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set("q", search);
  if (statusFilter) params.set("status", statusFilter);

  const { data: overview } = useAdminData<FunnelData>(
    "/api/admin/content/overview",
    { refreshInterval: 60000 }
  );
  const { data: listData, loading } = useAdminData<{
    items: ContentItem[];
    total: number;
    page: number;
  }>(`/api/admin/content/list?${params.toString()}`);

  const funnel = overview?.funnel;
  const items = listData?.items ?? [];
  const total = listData?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const columns: Column<ContentItem>[] = [
    {
      key: "title",
      label: "Title",
      render: (row) => (
        <div className="max-w-xs">
          <p className="truncate font-medium text-[var(--color-text-primary)]">
            {row.title}
          </p>
          <p className="truncate text-xs text-[var(--color-text-tertiary)]">
            {row.channel_name}
          </p>
        </div>
      ),
    },
    {
      key: "world_key",
      label: "World",
      render: (row) => (
        <span className="text-xs capitalize">{row.world_key.replace(/-/g, " ")}</span>
      ),
    },
    {
      key: "score",
      label: "Score",
      render: (row) => {
        const scores = row.fp_break_content_scores;
        if (!scores || scores.length === 0) return "—";
        const score = scores[0].taste_score;
        const color =
          score >= 70
            ? GREEN_700
            : score >= 55
              ? PRIORITY_MEDIUM
              : "var(--color-text-tertiary)";
        return (
          <span className="font-mono font-semibold" style={{ color }}>
            {score}
          </span>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "scaffolding_status",
      label: "Scaffolding",
      render: (row) =>
        row.scaffolding_status ? (
          <StatusBadge status={row.scaffolding_status} />
        ) : (
          <span className="text-xs text-[var(--color-text-tertiary)]">—</span>
        ),
    },
    {
      key: "engagement",
      label: "Engagement",
      render: (row) => {
        if (row.engagement_score == null) return "—";
        const color =
          row.engagement_score >= 0.7
            ? GREEN_700
            : row.engagement_score >= 0.4
              ? PRIORITY_MEDIUM
              : "var(--color-text-tertiary)";
        return (
          <span className="font-mono text-xs font-semibold" style={{ color }}>
            {row.engagement_score.toFixed(3)}
          </span>
        );
      },
    },
    {
      key: "created_at",
      label: "Discovered",
      render: (row) => new Date(row.created_at).toLocaleDateString(),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Funnel stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Candidates"
          value={funnel?.candidates ?? "—"}
          icon={Film}
        />
        <StatCard
          label="Evaluated"
          value={funnel?.evaluated ?? "—"}
          icon={CheckCircle}
          color={PRIORITY_MEDIUM}
        />
        <StatCard
          label="Scaffolded"
          value={funnel?.scaffolded ?? "—"}
          icon={BookOpen}
          color={GREEN_700}
        />
        <StatCard
          label="On Shelf"
          value={funnel?.onShelf ?? "—"}
          icon={Library}
          color={GREEN_700}
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
            placeholder="Search content..."
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-lg border border-[var(--color-border-default)] bg-transparent px-3 text-sm text-[var(--color-text-secondary)] focus:border-[var(--color-border-focus)] focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="scored">Scored</option>
          <option value="promoted">Promoted</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={items}
        rowKey={(row) => row.id}
        emptyMessage={loading ? "Loading content..." : "No content found"}
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
