"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface UserData {
  id: string;
  username: string | null;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  created_at: string;
}

interface UserDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserData | null;
  stats: { sessionCount: number; taskCount: number; partyCount: number } | null;
  onSave: (id: string, updates: Record<string, unknown>) => Promise<void>;
}

export function UserDetailModal({
  isOpen,
  onClose,
  user,
  stats,
  onSave,
}: UserDetailModalProps) {
  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [isAdmin, setIsAdmin] = useState(user?.is_admin ?? false);
  const [saving, setSaving] = useState(false);

  // Sync all fields when user changes
  useEffect(() => {
    setDisplayName(user?.display_name ?? "");
    setUsername(user?.username ?? "");
    setIsAdmin(user?.is_admin ?? false);
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await onSave(user.id, {
        display_name: displayName,
        username,
        is_admin: isAdmin,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="User Detail">
      <div className="space-y-5">
        {/* Avatar & ID */}
        <div className="flex items-center gap-4">
          {user.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatar_url}
              alt=""
              className="h-14 w-14 shrink-0 rounded-full object-cover"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}
            />
          ) : (
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold"
              style={{
                background: "rgba(20,20,20,0.6)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "var(--sg-white)",
              }}
            >
              {(user.display_name || user.email || "?").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[var(--sg-white)]">
              {user.email}
            </p>
            <p className="mt-0.5 truncate text-xs text-[var(--sg-shell-500)]">
              {user.id}
            </p>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Sessions", value: stats.sessionCount },
              { label: "Tasks", value: stats.taskCount },
              { label: "Parties", value: stats.partyCount },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-lg border border-white/[0.08] px-3 py-2 text-center"
                style={{ background: "var(--sg-forest-900)" }}
              >
                <p className="text-lg font-bold text-[var(--sg-white)]">
                  {s.value}
                </p>
                <p className="text-xs text-[var(--sg-shell-500)]">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Editable Fields */}
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--sg-shell-500)]">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="h-10 w-full rounded-full border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-[var(--sg-white)] outline-none focus:border-[var(--sg-forest-400)]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--sg-shell-500)]">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-10 w-full rounded-full border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-[var(--sg-white)] outline-none focus:border-[var(--sg-forest-400)]"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsAdmin(!isAdmin)}
              className="flex h-5 w-9 items-center rounded-full px-0.5 transition-colors"
              style={{
                background: isAdmin
                  ? "var(--sg-forest-500)"
                  : "rgba(255,255,255,0.08)",
              }}
            >
              <span
                className="h-4 w-4 rounded-full bg-white shadow-sm transition-transform"
                style={{
                  transform: isAdmin ? "translateX(16px)" : "translateX(0)",
                }}
              />
            </button>
            <label className="text-sm text-[var(--sg-shell-300)]">
              Admin
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
