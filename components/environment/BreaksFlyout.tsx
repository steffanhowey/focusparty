"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PanelHeader } from "@/components/session/PanelHeader";
import { DurationPills } from "@/components/session/DurationPills";
import { BreakContentCard } from "./BreakContentCard";
import { useBreakContent } from "@/lib/useBreakContent";
import type { BreakClip } from "@/lib/useBreakContent";
import type { BreakContentItem, BreakDuration } from "@/lib/types";
import { BREAK_CATEGORY_MAP, type BreakCategory } from "@/lib/breakConstants";
import { getSponsorLock } from "@/lib/breaks/worldBreakProfiles";

const DURATION_PRESETS: BreakDuration[] = [3, 5, 10];

interface BreaksFlyoutProps {
  roomWorldKey: string;
  worldLabel: string;
  category: BreakCategory;
  onClose: () => void;
  onSelectContent: (item: BreakContentItem, duration: BreakDuration, clips: BreakClip[]) => void;
}

export function BreaksFlyout({
  roomWorldKey,
  worldLabel,
  category,
  onClose,
  onSelectContent,
}: BreaksFlyoutProps) {
  const { clips, loading } = useBreakContent(roomWorldKey, category);
  const [selectedDuration, setSelectedDuration] = useState<BreakDuration>(5);

  const categoryConfig = BREAK_CATEGORY_MAP[category];
  const sponsorLock = getSponsorLock(category);

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
      <PanelHeader title={`${categoryConfig.label} Break`} onClose={onClose} />

      {/* Category subtitle */}
      <div className="px-5 pb-2">
        <p className="text-xs text-white/40">{categoryConfig.subtitle}</p>
        {sponsorLock?.badge && (
          <p className="mt-1 text-[10px] font-medium tracking-wide text-white/25">
            {sponsorLock.badge}
          </p>
        )}
      </div>

      {/* Duration picker */}
      <div className="px-5 pb-3">
        <p className="mb-2 text-xs text-white/40">How long?</p>
        <DurationPills
          value={selectedDuration}
          onChange={(d) => setSelectedDuration(d as BreakDuration)}
          options={DURATION_PRESETS}
          suffix=" min"
        />
      </div>

      <div className="fp-shell-scroll flex-1 overflow-y-auto px-5 py-3">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-white/25">
          {selectedDuration}-min {categoryConfig.label.toLowerCase()} for {worldLabel}
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
            No {categoryConfig.label.toLowerCase()} content available yet
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
