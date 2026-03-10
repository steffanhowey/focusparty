"use client";

import { useEffect, useState, useCallback } from "react";
import { Bot, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "../StatusBadge";

interface SyntheticStatus {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string;
  archetype: string;
  preferredWorldKeys: string[];
  currentRoomId: string | null;
  recentEventCount: number;
}

const ARCHETYPE_COLORS: Record<string, string> = {
  coder: "#7c5cfc",
  writer: "#5CC2EC",
  founder: "#F5C54E",
  gentle: "#5BC682",
};

export function SyntheticsView() {
  const [synthetics, setSynthetics] = useState<SyntheticStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticking, setTicking] = useState(false);

  const fetchSynthetics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/synthetics/status");
      const data = await res.json();
      setSynthetics(data.synthetics ?? []);
    } catch (err) {
      console.error("Failed to fetch synthetics:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSynthetics();
  }, [fetchSynthetics]);

  const handleTick = async () => {
    setTicking(true);
    try {
      await fetch("/api/synthetics/tick", { method: "POST" });
      setTimeout(fetchSynthetics, 1000);
    } catch (err) {
      console.error("Tick failed:", err);
    } finally {
      setTicking(false);
    }
  };

  const handleRegenerateAvatars = async () => {
    try {
      await fetch("/api/avatar/generate-synthetics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("Avatar regeneration failed:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent"
          style={{ color: "var(--color-text-tertiary)" }}
        />
      </div>
    );
  }

  // Group by archetype
  const grouped = synthetics.reduce(
    (acc, s) => {
      if (!acc[s.archetype]) acc[s.archetype] = [];
      acc[s.archetype].push(s);
      return acc;
    },
    {} as Record<string, SyntheticStatus[]>
  );

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="primary"
          size="sm"
          onClick={handleTick}
          disabled={ticking}
        >
          <Bot size={16} strokeWidth={1.8} className="mr-1" />
          {ticking ? "Running..." : "Trigger Tick"}
        </Button>
        <Button variant="secondary" size="sm" onClick={handleRegenerateAvatars}>
          <Sparkles size={16} strokeWidth={1.8} className="mr-1" />
          Regenerate Avatars
        </Button>
        <Button variant="ghost" size="sm" onClick={fetchSynthetics}>
          <RefreshCw size={16} strokeWidth={1.8} className="mr-1" />
          Refresh
        </Button>
        <span className="ml-auto self-center text-xs text-[var(--color-text-tertiary)]">
          {synthetics.length} synthetics
        </span>
      </div>

      {/* Grouped Grid */}
      {Object.entries(grouped).map(([archetype, synths]) => (
        <div key={archetype}>
          <h3
            className="mb-3 text-sm font-semibold uppercase tracking-wider"
            style={{ color: ARCHETYPE_COLORS[archetype] ?? "var(--color-text-tertiary)" }}
          >
            {archetype}s ({synths.length})
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {synths.map((s) => (
              <div
                key={s.id}
                className="flex flex-col items-center gap-2 rounded-xl border border-[var(--color-border-default)] p-4 transition-colors hover:border-[var(--color-border-focus)]"
                style={{ background: "var(--color-bg-elevated)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.avatarUrl}
                  alt={s.displayName}
                  className="h-12 w-12 rounded-full object-cover"
                  style={{ border: "1px solid var(--color-border-default)" }}
                />
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  {s.displayName}
                </span>
                <span className="text-xs text-[var(--color-text-tertiary)]">
                  @{s.handle}
                </span>
                {s.currentRoomId ? (
                  <StatusBadge status="active" label="In Room" />
                ) : (
                  <span className="text-xs text-[var(--color-text-tertiary)]">
                    Idle
                  </span>
                )}
                {s.recentEventCount > 0 && (
                  <span className="text-xs text-[var(--color-text-tertiary)]">
                    {s.recentEventCount} recent events
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
