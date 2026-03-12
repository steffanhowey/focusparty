"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PanelHeader } from "@/components/session/PanelHeader";
import { BreakContentCard } from "./BreakContentCard";
import { useBreakContent } from "@/lib/useBreakContent";
import type { BreakClip } from "@/lib/useBreakContent";
import type { BreakContentItem, BreakDuration } from "@/lib/types";

const DURATION_PRESETS: BreakDuration[] = [3, 5, 10];

interface BreaksFlyoutProps {
  roomWorldKey: string;
  worldLabel: string;
  onClose: () => void;
  onSelectContent: (item: BreakContentItem, duration: BreakDuration, clips: BreakClip[]) => void;
}

export function BreaksFlyout({
  roomWorldKey,
  worldLabel,
  onClose,
  onSelectContent,
}: BreaksFlyoutProps) {
  const { clips, loading } = useBreakContent(roomWorldKey, "learning");
  const [selectedDuration, setSelectedDuration] = useState<BreakDuration>(5);

  const filteredClips = useMemo(
    () => clips.filter((c) => c.duration === selectedDuration),
    [clips, selectedDuration]
  );

  const handleSelectClip = useCallback(
    (clip: BreakClip) => onSelectContent(clip.sourceItem, clip.duration, filteredClips),
    [onSelectContent, filteredClips]
  );

  // Escape key closes
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <>
      <PanelHeader title="Breaks" onClose={onClose} />

      {/* Duration picker */}
      <div className="px-5 pb-3">
        <p className="mb-2 text-xs text-white/40">How long?</p>
        <div className="flex gap-2">
          {DURATION_PRESETS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setSelectedDuration(d)}
              className="cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-medium transition-all"
              style={
                selectedDuration === d
                  ? { background: "rgba(140, 85, 239, 0.2)", color: "#8C55EF", border: "1px solid rgba(140, 85, 239, 0.3)" }
                  : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }
              }
            >
              {d} min
            </button>
          ))}
        </div>
      </div>

      <div className="fp-shell-scroll flex-1 overflow-y-auto px-5 py-3">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-white/25">
          {selectedDuration}-min clips for {worldLabel}
        </p>

        {loading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-xl bg-white/[0.04]"
              />
            ))}
          </div>
        ) : filteredClips.length === 0 ? (
          <p className="py-8 text-center text-xs text-white/30">
            No break content available yet
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredClips.map((clip) => (
              <BreakContentCard
                key={clip.clipId}
                clip={clip}
                onSelect={handleSelectClip}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
