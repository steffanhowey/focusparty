"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "../StatusBadge";
import { renderActivityEvent, relativeTime } from "@/lib/activityEventRender";
import type { ActivityEvent } from "@/lib/types";

interface RoomDetail {
  room: {
    id: string;
    name: string;
    world_key: string;
    status: string;
    creator_id: string;
    invite_code: string | null;
    persistent: boolean;
    planned_duration_min: number;
    max_participants: number;
    created_at: string;
  };
  participants: Array<{
    id: string;
    user_id: string;
    display_name: string;
    joined_at: string;
    left_at: string | null;
  }>;
  recentEvents: ActivityEvent[];
}

interface RoomDetailModalProps {
  isOpen: boolean;
  roomId: string | null;
  onClose: () => void;
  onUpdate: () => void;
}

export function RoomDetailModal({
  isOpen,
  roomId,
  onClose,
  onUpdate,
}: RoomDetailModalProps) {
  const [detail, setDetail] = useState<RoomDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!roomId || !isOpen) return;
    setLoading(true);
    fetch(`/api/admin/rooms/${roomId}`)
      .then((r) => r.json())
      .then((data) => {
        setDetail(data);
        setStatus(data.room?.status ?? "");
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [roomId, isOpen]);

  const handleSave = async () => {
    if (!roomId) return;
    await fetch(`/api/admin/rooms/${roomId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    onUpdate();
    onClose();
  };

  const handleDelete = async () => {
    if (!roomId || !confirm("Delete this room and all its data?")) return;
    await fetch(`/api/admin/rooms/${roomId}`, { method: "DELETE" });
    onUpdate();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Room Detail">
      {loading || !detail ? (
        <div className="flex items-center justify-center py-12">
          <div
            className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent"
            style={{ color: "var(--color-text-tertiary)" }}
          />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Room Info */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                {detail.room.name}
              </h3>
              <StatusBadge status={detail.room.status} />
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-[var(--color-text-tertiary)]">
              <span>World: {detail.room.world_key}</span>
              <span>Duration: {detail.room.planned_duration_min}m</span>
              <span>Max: {detail.room.max_participants}</span>
              {detail.room.invite_code && (
                <span>Code: {detail.room.invite_code}</span>
              )}
              <span>{detail.room.persistent ? "Persistent" : "Temporary"}</span>
            </div>
          </div>

          {/* Status Update */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-tertiary)]">
              Update Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-10 w-full appearance-none rounded-full border border-[var(--color-border-default)] bg-white/[0.04] px-4 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-focus)]"
            >
              <option value="waiting">Waiting</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* Participants */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
              Participants ({detail.participants.length})
            </h4>
            <div className="max-h-32 overflow-y-auto rounded-lg border border-[var(--color-border-subtle)] divide-y divide-[var(--color-border-subtle)]">
              {detail.participants.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-[var(--color-text-tertiary)]">
                  No participants
                </p>
              ) : (
                detail.participants.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-3 py-2"
                  >
                    <span className="text-sm text-[var(--color-text-secondary)]">
                      {p.display_name}
                    </span>
                    <span className="text-xs text-[var(--color-text-tertiary)]">
                      {p.left_at ? "Left" : "Active"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Events */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
              Recent Events ({detail.recentEvents.length})
            </h4>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-[var(--color-border-subtle)] divide-y divide-[var(--color-border-subtle)]">
              {detail.recentEvents.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-[var(--color-text-tertiary)]">
                  No events
                </p>
              ) : (
                detail.recentEvents.slice(0, 20).map((event) => {
                  const rendered = renderActivityEvent(event);
                  const Icon = rendered.icon;
                  return (
                    <div
                      key={event.id}
                      className="flex items-center gap-2 px-3 py-2"
                    >
                      <Icon
                        size={14}
                        strokeWidth={1.8}
                        className="shrink-0"
                        style={{ color: rendered.color }}
                      />
                      <span className="min-w-0 flex-1 truncate text-xs text-[var(--color-text-secondary)]">
                        {rendered.label}
                      </span>
                      <span className="shrink-0 text-xs text-[var(--color-text-tertiary)]">
                        {relativeTime(event.created_at)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-2">
            <Button variant="danger" size="sm" onClick={handleDelete}>
              Delete Room
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSave}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
