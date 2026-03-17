"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function SettingsView() {
  const [usernames, setUsernames] = useState<string[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchUsernames = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/reserved-usernames");
      const data = await res.json();
      setUsernames(data.usernames ?? []);
    } catch (err) {
      console.error("Failed to fetch usernames:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsernames();
  }, [fetchUsernames]);

  const handleAdd = async () => {
    if (!newUsername.trim()) return;
    try {
      await fetch("/api/admin/reserved-usernames", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername.trim() }),
      });
      setNewUsername("");
      fetchUsernames();
    } catch (err) {
      console.error("Failed to add username:", err);
    }
  };

  const handleDelete = async (username: string) => {
    try {
      await fetch(`/api/admin/reserved-usernames/${username}`, {
        method: "DELETE",
      });
      fetchUsernames();
    } catch (err) {
      console.error("Failed to delete username:", err);
    }
  };

  return (
    <div className="space-y-8">
      {/* Reserved Usernames */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--sg-shell-500)]">
          Reserved Usernames
        </h2>

        {/* Add Form */}
        <div className="mb-4 flex gap-2">
          <input
            type="text"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="username to reserve..."
            className="h-10 flex-1 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-[var(--sg-white)] placeholder-[var(--sg-shell-500)] outline-none focus:border-[var(--sg-forest-400)]"
          />
          <Button variant="primary" size="sm" onClick={handleAdd}>
            <Plus size={16} strokeWidth={1.8} className="mr-1" />
            Add
          </Button>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div
              className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent"
              style={{ color: "var(--sg-shell-500)" }}
            />
          </div>
        ) : (
          <div
            className="rounded-xl border border-white/[0.08] divide-y divide-white/[0.04]"
            style={{ background: "rgba(20,20,20,0.6)" }}
          >
            {usernames.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[var(--sg-shell-500)]">
                No reserved usernames
              </div>
            ) : (
              usernames.map((name) => (
                <div
                  key={name}
                  className="flex items-center justify-between px-4 py-2.5"
                >
                  <span className="text-sm font-mono text-[var(--sg-shell-300)]">
                    {name}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(name)}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--sg-shell-500)] transition-colors hover:bg-white/[0.06] hover:text-[var(--sg-coral-500)]"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
        <p className="mt-2 text-xs text-[var(--sg-shell-500)]">
          {usernames.length} reserved usernames
        </p>
      </div>

      {/* Worlds Config (read-only) */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--sg-shell-500)]">
          Worlds
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { key: "default", label: "Default", color: "var(--sg-forest-500)" },
            { key: "vibe-coding", label: "Vibe Coding", color: "var(--sg-forest-300)" },
            { key: "writer-room", label: "Writer Room", color: "var(--sg-teal-600)" },
            { key: "yc-build", label: "YC Build", color: "var(--sg-gold-600)" },
            { key: "gentle-start", label: "Gentle Start", color: "var(--sg-coral-500)" },
          ].map((world) => (
            <div
              key={world.key}
              className="rounded-xl border border-white/[0.08] p-4"
              style={{ background: "rgba(20,20,20,0.6)" }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ background: world.color }}
                />
                <span className="text-sm font-medium text-[var(--sg-white)]">
                  {world.label}
                </span>
              </div>
              <p className="mt-1 text-xs font-mono text-[var(--sg-shell-500)]">
                {world.key}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
