"use client";

import { useEffect, useState, useCallback } from "react";
import { DataTable, type Column } from "../DataTable";
import { Pagination } from "../Pagination";
import { SearchInput } from "../SearchInput";
import { StatusBadge } from "../StatusBadge";
import { UserDetailModal } from "./UserDetailModal";
import { relativeTime } from "@/lib/activityEventRender";

interface UserRow {
  id: string;
  username: string | null;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  created_at: string;
}

interface UserDetail {
  user: UserRow;
  sessionCount: number;
  taskCount: number;
  partyCount: number;
}

export function UsersView() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const limit = 25;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sort: sortKey,
        dir: sortDir,
      });
      if (search) params.set("search", search);

      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();
      setUsers(data.users ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, sortKey, sortDir]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSort = (key: string) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const handleRowClick = async (user: UserRow) => {
    try {
      const res = await fetch(`/api/admin/users/${user.id}`);
      const data = await res.json();
      setSelectedUser(data);
      setModalOpen(true);
    } catch (err) {
      console.error("Failed to fetch user detail:", err);
    }
  };

  const handleSave = async (id: string, updates: Record<string, unknown>) => {
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    fetchUsers();
  };

  const columns: Column<UserRow>[] = [
    {
      key: "avatar",
      label: "",
      width: "48px",
      render: (row) =>
        row.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.avatar_url}
            alt=""
            className="h-8 w-8 rounded-full object-cover"
            style={{ border: "1px solid var(--color-border-default)" }}
          />
        ) : (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold"
            style={{
              background: "var(--color-bg-hover)",
              color: "var(--color-text-tertiary)",
            }}
          >
            {(row.display_name || row.email || "?").charAt(0).toUpperCase()}
          </div>
        ),
    },
    {
      key: "username",
      label: "Username",
      sortable: true,
      render: (row) => (
        <span className="text-[var(--color-text-primary)]">
          {row.username ? `@${row.username}` : "—"}
        </span>
      ),
    },
    {
      key: "display_name",
      label: "Name",
      sortable: true,
      render: (row) => row.display_name ?? "—",
    },
    {
      key: "email",
      label: "Email",
      sortable: true,
      render: (row) => (
        <span className="truncate">{row.email ?? "—"}</span>
      ),
    },
    {
      key: "is_admin",
      label: "Role",
      render: (row) =>
        row.is_admin ? (
          <StatusBadge status="active" label="Admin" />
        ) : (
          <span className="text-xs text-[var(--color-text-tertiary)]">User</span>
        ),
    },
    {
      key: "created_at",
      label: "Joined",
      sortable: true,
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
      <div className="flex items-center justify-between gap-4">
        <div className="w-full max-w-sm">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search users..."
          />
        </div>
        <span className="shrink-0 text-xs text-[var(--color-text-tertiary)]">
          {total} users
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
            data={users}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            onRowClick={handleRowClick}
            rowKey={(r) => r.id}
            emptyMessage="No users found"
          />
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      <UserDetailModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedUser(null);
        }}
        user={selectedUser?.user ?? null}
        stats={
          selectedUser
            ? {
                sessionCount: selectedUser.sessionCount,
                taskCount: selectedUser.taskCount,
                partyCount: selectedUser.partyCount,
              }
            : null
        }
        onSave={handleSave}
      />
    </div>
  );
}
