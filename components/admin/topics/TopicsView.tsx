"use client";

import { useState, useCallback } from "react";
import { Flame, TrendingUp, Hash } from "lucide-react";
import { useAdminData } from "@/lib/admin/useAdminData";
import { StatCard } from "@/components/admin/StatCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { SearchInput } from "@/components/admin/SearchInput";
import { CORAL_700, PRIORITY_MEDIUM } from "@/lib/palette";

interface Topic {
  slug: string;
  name: string;
  category: string;
  heat_score: number;
  status: string;
  signal_count_24h?: number;
  content_count?: number;
  aliases: string[];
}

export function TopicsView() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (categoryFilter) params.set("category", categoryFilter);
  if (statusFilter) params.set("status", statusFilter);

  const { data } = useAdminData<{ topics: Topic[] }>(
    `/api/admin/topics?${params.toString()}`,
    { refreshInterval: 60000 }
  );

  const topics = data?.topics ?? [];
  const hotCount = topics.filter((t) => t.heat_score >= 0.8).length;
  const emergingCount = topics.filter(
    (t) => t.heat_score >= 0.5 && t.heat_score < 0.8
  ).length;

  const categories = [...new Set(topics.map((t) => t.category))].sort();

  const columns: Column<Topic>[] = [
    {
      key: "name",
      label: "Topic",
      sortable: true,
      render: (row) => (
        <span className="font-medium text-[var(--color-text-primary)]">
          {row.name}
        </span>
      ),
    },
    {
      key: "category",
      label: "Category",
      render: (row) => (
        <span
          className="rounded-full px-2.5 py-1 text-xs font-medium capitalize"
          style={{
            background: "var(--color-bg-active)",
            color: "var(--color-text-secondary)",
          }}
        >
          {row.category}
        </span>
      ),
    },
    {
      key: "heat_score",
      label: "Heat",
      sortable: true,
      render: (row) => {
        const color =
          row.heat_score >= 0.8
            ? CORAL_700
            : row.heat_score >= 0.5
              ? PRIORITY_MEDIUM
              : "var(--color-text-tertiary)";
        return (
          <span className="font-mono text-sm font-semibold" style={{ color }}>
            {row.heat_score.toFixed(2)}
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
      key: "signal_count_24h",
      label: "Signals (24h)",
      render: (row) => row.signal_count_24h ?? "—",
    },
    {
      key: "content_count",
      label: "Content",
      render: (row) => row.content_count ?? "—",
    },
  ];

  const [sortKey, setSortKey] = useState("heat_score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = useCallback(
    (key: string) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("desc");
      }
    },
    [sortKey]
  );

  const sorted = [...topics].sort((a, b) => {
    const aVal = (a as unknown as Record<string, unknown>)[sortKey];
    const bVal = (b as unknown as Record<string, unknown>)[sortKey];
    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    }
    return sortDir === "asc"
      ? String(aVal ?? "").localeCompare(String(bVal ?? ""))
      : String(bVal ?? "").localeCompare(String(aVal ?? ""));
  });

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Hot Topics" value={hotCount} icon={Flame} color={CORAL_700} />
        <StatCard
          label="Emerging"
          value={emergingCount}
          icon={TrendingUp}
          color={PRIORITY_MEDIUM}
        />
        <StatCard label="Total Topics" value={topics.length} icon={Hash} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-64">
          <SearchInput value={search} onChange={setSearch} placeholder="Search topics..." />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-9 rounded-lg border border-[var(--color-border-default)] bg-transparent px-3 text-sm text-[var(--color-text-secondary)] focus:border-[var(--color-border-focus)] focus:outline-none"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-lg border border-[var(--color-border-default)] bg-transparent px-3 text-sm text-[var(--color-text-secondary)] focus:border-[var(--color-border-focus)] focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="hot">Hot</option>
          <option value="emerging">Emerging</option>
          <option value="cooling">Cooling</option>
          <option value="cold">Cold</option>
        </select>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={sorted}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        rowKey={(row) => row.slug}
        emptyMessage="No topics found"
      />
    </div>
  );
}
