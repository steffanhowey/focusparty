"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronDown, Plus, Check, X, Archive, Star, Zap } from "lucide-react";
import { StatusBadge } from "../StatusBadge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

interface BackgroundAsset {
  id: string;
  world_key: string;
  storage_path: string;
  public_url: string;
  status: string;
  time_of_day_state: string;
  score_overall: number | null;
  review_notes: string | null;
  created_at: string;
}

export function BackgroundsView() {
  const [assets, setAssets] = useState<BackgroundAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [worldFilter, setWorldFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<BackgroundAsset | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [genWorld, setGenWorld] = useState("default");
  const [genCount, setGenCount] = useState(3);
  const [genTimeOfDay, setGenTimeOfDay] = useState("afternoon");
  const [generating, setGenerating] = useState(false);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (worldFilter) params.set("world_key", worldFilter);
      if (timeFilter) params.set("time_of_day", timeFilter);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/admin/backgrounds?${params}`);
      const data = await res.json();
      setAssets(data.assets ?? []);
    } catch (err) {
      console.error("Failed to fetch backgrounds:", err);
    } finally {
      setLoading(false);
    }
  }, [worldFilter, timeFilter, statusFilter]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleReview = async (
    assetId: string,
    action: "approve" | "reject" | "activate" | "archive",
    score?: number
  ) => {
    try {
      await fetch("/api/backgrounds/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId, action, score }),
      });
      setSelectedAsset(null);
      fetchAssets();
    } catch (err) {
      console.error("Review action failed:", err);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await fetch("/api/backgrounds/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          worldKey: genWorld,
          count: genCount,
          timeOfDay: genTimeOfDay,
        }),
      });
      setGenerateOpen(false);
      // Wait a moment for generation then refresh
      setTimeout(fetchAssets, 2000);
    } catch (err) {
      console.error("Generation failed:", err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {[
          {
            value: worldFilter,
            onChange: setWorldFilter,
            label: "All Worlds",
            options: [
              { value: "default", label: "Default" },
              { value: "vibe-coding", label: "Vibe Coding" },
              { value: "writer-room", label: "Writer Room" },
              { value: "yc-build", label: "YC Build" },
              { value: "gentle-start", label: "Gentle Start" },
            ],
          },
          {
            value: timeFilter,
            onChange: setTimeFilter,
            label: "All Times",
            options: [
              { value: "morning", label: "Morning" },
              { value: "afternoon", label: "Afternoon" },
              { value: "evening", label: "Evening" },
              { value: "late_night", label: "Late Night" },
            ],
          },
          {
            value: statusFilter,
            onChange: setStatusFilter,
            label: "All Statuses",
            options: [
              { value: "candidate", label: "Candidate" },
              { value: "approved", label: "Approved" },
              { value: "active", label: "Active" },
              { value: "archived", label: "Archived" },
            ],
          },
        ].map((filter) => (
          <div key={filter.label} className="relative">
            <select
              value={filter.value}
              onChange={(e) => filter.onChange(e.target.value)}
              className="h-9 appearance-none rounded-full border border-[var(--sg-shell-border)] bg-white/[0.04] pl-3 pr-8 text-sm text-[var(--sg-shell-600)] outline-none focus:border-[var(--sg-forest-400)]"
            >
              <option value="">{filter.label}</option>
              {filter.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--sg-shell-500)]"
            />
          </div>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-[var(--sg-shell-500)]">
            {assets.length} assets
          </span>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setGenerateOpen(true)}
          >
            <Plus size={16} strokeWidth={1.8} className="mr-1" />
            Generate
          </Button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div
            className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent"
            style={{ color: "var(--sg-shell-500)" }}
          />
        </div>
      ) : assets.length === 0 ? (
        <div className="py-20 text-center text-sm text-[var(--sg-shell-500)]">
          No background assets found
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              onClick={() => setSelectedAsset(asset)}
              className="group relative overflow-hidden rounded-xl border border-[var(--sg-shell-border)] transition-all hover:border-[var(--sg-forest-400)]"
              style={{ background: "var(--sg-shell-100)" }}
            >
              {/* Thumbnail */}
              <div className="relative aspect-video w-full overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset.public_url}
                  alt={`${asset.world_key} ${asset.time_of_day_state}`}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
                <div className="absolute left-2 top-2">
                  <StatusBadge status={asset.status} />
                </div>
                {asset.score_overall != null && (
                  <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-shell-900/60 px-2 py-0.5 text-xs text-white">
                    <Star size={12} />
                    {asset.score_overall}
                  </div>
                )}
              </div>
              {/* Meta */}
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs font-medium text-[var(--sg-shell-600)]">
                  {asset.world_key}
                </span>
                <span className="text-xs text-[var(--sg-shell-500)]">
                  {asset.time_of_day_state}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Asset Detail Modal */}
      {selectedAsset && (
        <Modal
          isOpen={!!selectedAsset}
          onClose={() => setSelectedAsset(null)}
          title="Background Asset"
        >
          <div className="space-y-4">
            <div className="overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedAsset.public_url}
                alt=""
                className="w-full"
              />
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-[var(--sg-shell-500)]">
              <StatusBadge status={selectedAsset.status} />
              <span>World: {selectedAsset.world_key}</span>
              <span>Time: {selectedAsset.time_of_day_state}</span>
              {selectedAsset.score_overall != null && (
                <span>Score: {selectedAsset.score_overall}</span>
              )}
            </div>
            {selectedAsset.review_notes && (
              <p className="text-sm text-[var(--sg-shell-600)]">
                {selectedAsset.review_notes}
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              {selectedAsset.status === "candidate" && (
                <>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() =>
                      handleReview(selectedAsset.id, "approve", 8)
                    }
                  >
                    <Check size={14} className="mr-1" />
                    Approve
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleReview(selectedAsset.id, "reject")}
                  >
                    <X size={14} className="mr-1" />
                    Reject
                  </Button>
                </>
              )}
              {(selectedAsset.status === "approved" ||
                selectedAsset.status === "candidate") && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    handleReview(selectedAsset.id, "activate")
                  }
                >
                  <Zap size={14} className="mr-1" />
                  Activate
                </Button>
              )}
              {selectedAsset.status !== "archived" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleReview(selectedAsset.id, "archive")}
                >
                  <Archive size={14} className="mr-1" />
                  Archive
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Generate Modal */}
      <Modal
        isOpen={generateOpen}
        onClose={() => setGenerateOpen(false)}
        title="Generate Backgrounds"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--sg-shell-500)]">
              World
            </label>
            <select
              value={genWorld}
              onChange={(e) => setGenWorld(e.target.value)}
              className="h-10 w-full appearance-none rounded-full border border-[var(--sg-shell-border)] bg-white/[0.04] px-4 text-sm text-[var(--sg-shell-900)] outline-none focus:border-[var(--sg-forest-400)]"
            >
              <option value="default">Default</option>
              <option value="vibe-coding">Vibe Coding</option>
              <option value="writer-room">Writer Room</option>
              <option value="yc-build">YC Build</option>
              <option value="gentle-start">Gentle Start</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--sg-shell-500)]">
              Time of Day
            </label>
            <select
              value={genTimeOfDay}
              onChange={(e) => setGenTimeOfDay(e.target.value)}
              className="h-10 w-full appearance-none rounded-full border border-[var(--sg-shell-border)] bg-white/[0.04] px-4 text-sm text-[var(--sg-shell-900)] outline-none focus:border-[var(--sg-forest-400)]"
            >
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="evening">Evening</option>
              <option value="late_night">Late Night</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--sg-shell-500)]">
              Count
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setGenCount(n)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border text-sm font-medium transition-colors"
                  style={{
                    background:
                      genCount === n
                        ? "var(--sg-forest-500)"
                        : "transparent",
                    borderColor:
                      genCount === n
                        ? "var(--sg-forest-500)"
                        : "var(--sg-shell-border)",
                    color:
                      genCount === n
                        ? "white"
                        : "var(--sg-shell-600)",
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setGenerateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? "Generating..." : `Generate ${genCount}`}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
