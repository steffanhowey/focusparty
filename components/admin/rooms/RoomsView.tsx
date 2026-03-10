"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { DataTable, type Column } from "../DataTable";
import { Pagination } from "../Pagination";
import { StatusBadge } from "../StatusBadge";
import { RoomDetailModal } from "./RoomDetailModal";
import { relativeTime } from "@/lib/activityEventRender";

interface RoomRow {
  id: string;
  name: string;
  world_key: string;
  status: string;
  creator_id: string;
  max_participants: number;
  planned_duration_min: number;
  invite_code: string | null;
  persistent: boolean;
  created_at: string;
  fp_party_participants: { count: number }[];
}

export function RoomsView() {
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [worldFilter, setWorldFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const limit = 25;

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (statusFilter) params.set("status", statusFilter);
      if (worldFilter) params.set("world_key", worldFilter);

      const res = await fetch(`/api/admin/rooms?${params}`);
      const data = await res.json();
      setRooms(data.rooms ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      console.error("Failed to fetch rooms:", err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, worldFilter]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const columns: Column<RoomRow>[] = [
    {
      key: "name",
      label: "Name",
      render: (row) => (
        <span className="font-medium text-[var(--color-text-primary)]">
          {row.name}
        </span>
      ),
    },
    {
      key: "world_key",
      label: "World",
      render: (row) => (
        <span className="text-xs">{row.world_key}</span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "participants",
      label: "Participants",
      render: (row) => {
        const count = row.fp_party_participants?.[0]?.count ?? 0;
        return (
          <span>
            {count} / {row.max_participants}
          </span>
        );
      },
    },
    {
      key: "persistent",
      label: "Type",
      render: (row) => (
        <span className="text-xs">
          {row.persistent ? "Persistent" : "Temporary"}
        </span>
      ),
    },
    {
      key: "created_at",
      label: "Created",
      render: (row) => (
        <span className="text-xs text-[var(--color-text-tertiary)]">
          {relativeTime(row.created_at)}
        </span>
      ),
    },
  ];

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 appearance-none rounded-full border border-[var(--color-border-default)] bg-white/[0.04] pl-3 pr-8 text-sm text-[var(--color-text-secondary)] outline-none focus:border-[var(--color-border-focus)]"
          >
            <option value="">All Statuses</option>
            <option value="waiting">Waiting</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]"
          />
        </div>
        <div className="relative">
          <select
            value={worldFilter}
            onChange={(e) => {
              setWorldFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 appearance-none rounded-full border border-[var(--color-border-default)] bg-white/[0.04] pl-3 pr-8 text-sm text-[var(--color-text-secondary)] outline-none focus:border-[var(--color-border-focus)]"
          >
            <option value="">All Worlds</option>
            <option value="default">Default</option>
            <option value="vibe-coding">Vibe Coding</option>
            <option value="writer-room">Writer Room</option>
            <option value="yc-build">YC Build</option>
            <option value="gentle-start">Gentle Start</option>
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]"
          />
        </div>
        <span className="ml-auto text-xs text-[var(--color-text-tertiary)]">
          {total} rooms
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div
            className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent"
            style={{ color: "var(--color-text-tertiary)" }}
          />
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={rooms}
            onRowClick={(row) => {
              setSelectedRoomId(row.id);
              setModalOpen(true);
            }}
            rowKey={(r) => r.id}
            emptyMessage="No rooms found"
          />
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      <RoomDetailModal
        isOpen={modalOpen}
        roomId={selectedRoomId}
        onClose={() => {
          setModalOpen(false);
          setSelectedRoomId(null);
        }}
        onUpdate={fetchRooms}
      />
    </div>
  );
}
