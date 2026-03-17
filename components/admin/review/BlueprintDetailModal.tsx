"use client";

import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/admin/StatusBadge";

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

interface CurriculumItem {
  position: number;
  videoId: string;
  title: string;
  channelName: string;
  durationSeconds: number;
  learningRationale: string;
  tasteScore?: number;
}

interface BlueprintDetailModalProps {
  blueprint: Blueprint;
  onClose: () => void;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, notes?: string) => Promise<void>;
}

const TABS = ["Curriculum", "Metadata", "Intelligence"] as const;

export function BlueprintDetailModal({
  blueprint: bp,
  onClose,
  onApprove,
  onReject,
}: BlueprintDetailModalProps) {
  const [activeTab, setActiveTab] = useState<string>("Curriculum");
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");

  const curriculum = (bp.curriculum_sequence ?? []) as CurriculumItem[];
  const contentSelection = bp.content_selection ?? {};
  const isPending = bp.review_status === "pending";

  const handleApprove = useCallback(async () => {
    setApproving(true);
    await onApprove(bp.id);
    setApproving(false);
  }, [bp.id, onApprove]);

  const handleReject = useCallback(async () => {
    setRejecting(true);
    await onReject(bp.id, rejectNotes || undefined);
    setRejecting(false);
  }, [bp.id, onReject, rejectNotes]);

  function formatDuration(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  }

  const content = (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 50 }}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-[var(--color-border-default)] shadow-xl"
        style={{ background: "var(--color-bg-secondary)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border-default)] px-6 py-5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <h2 className="truncate text-lg font-bold text-[var(--color-text-primary)]">
                {bp.room_name}
              </h2>
              <StatusBadge status={bp.review_status} />
            </div>
            <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">
              {bp.room_description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[var(--color-border-default)] px-6">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "border-[var(--sg-forest-500)] text-[var(--color-text-primary)]"
                  : "border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeTab === "Curriculum" && (
            <div className="space-y-3">
              {curriculum.length === 0 ? (
                <p className="text-sm text-[var(--color-text-tertiary)]">No curriculum data</p>
              ) : (
                curriculum.map((item, i) => (
                  <div
                    key={item.videoId ?? i}
                    className="flex gap-4 rounded-lg border border-[var(--color-border-subtle)] p-4"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs font-bold text-[var(--color-text-tertiary)]">
                      {item.position ?? i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">
                        {item.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-tertiary)]">
                        <span>{item.channelName}</span>
                        {item.durationSeconds > 0 && (
                          <span>{formatDuration(item.durationSeconds)}</span>
                        )}
                        {item.tasteScore !== undefined && (
                          <span>Score: {item.tasteScore}</span>
                        )}
                      </div>
                      {item.learningRationale && (
                        <p className="mt-2 text-xs text-[var(--color-text-tertiary)] italic">
                          {item.learningRationale}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "Metadata" && (
            <div className="space-y-4">
              <MetadataRow label="Room Name" value={bp.room_name} />
              <MetadataRow label="Description" value={bp.room_description} />
              <MetadataRow label="Topic" value={`${bp.topic} (${bp.topic_slug})`} />
              <MetadataRow label="Status" value={bp.status} />
              <MetadataRow label="Generation Source" value={bp.generation_source} />
              <MetadataRow
                label="Created"
                value={new Date(bp.created_at).toLocaleString()}
              />
              {bp.reviewed_at && (
                <MetadataRow
                  label="Reviewed"
                  value={new Date(bp.reviewed_at).toLocaleString()}
                />
              )}
              {bp.review_notes && (
                <MetadataRow label="Review Notes" value={bp.review_notes} />
              )}
            </div>
          )}

          {activeTab === "Intelligence" && (
            <div className="space-y-4">
              <MetadataRow
                label="Heat Score at Generation"
                value={(bp.heat_score_at_generation ?? 0).toFixed(3)}
              />
              <MetadataRow
                label="Videos in Curriculum"
                value={String(curriculum.length)}
              />
              {contentSelection && (
                <>
                  <MetadataRow
                    label="Video Count"
                    value={String((contentSelection as Record<string, unknown>).videoCount ?? "—")}
                  />
                  <MetadataRow
                    label="Creator Count"
                    value={String((contentSelection as Record<string, unknown>).creatorCount ?? "—")}
                  />
                  <MetadataRow
                    label="Avg Taste Score"
                    value={String((contentSelection as Record<string, unknown>).avgTasteScore ?? "—")}
                  />
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {isPending && (
          <div className="flex items-center justify-end gap-3 border-t border-[var(--color-border-default)] px-6 py-4">
            {showRejectDialog ? (
              <div className="flex flex-1 items-end gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-[var(--color-text-tertiary)]">
                    Rejection notes (optional)
                  </label>
                  <textarea
                    value={rejectNotes}
                    onChange={(e) => setRejectNotes(e.target.value)}
                    className="w-full rounded-lg border border-[var(--color-border-default)] bg-transparent px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-border-focus)] focus:outline-none"
                    rows={2}
                    placeholder="Why is this being rejected?"
                  />
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  loading={rejecting}
                  onClick={handleReject}
                >
                  Confirm Reject
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRejectDialog(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setShowRejectDialog(true)}
                >
                  Reject
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  loading={approving}
                  onClick={handleApprove}
                >
                  Approve
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : null;
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4">
      <span className="w-48 shrink-0 text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
        {label}
      </span>
      <span className="text-sm text-[var(--color-text-secondary)]">{value}</span>
    </div>
  );
}
