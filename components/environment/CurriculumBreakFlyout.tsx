"use client";

import { useCallback, useEffect } from "react";
import { CheckCircle, BookOpen, Lock } from "lucide-react";
import { PanelHeader } from "@/components/session/PanelHeader";
import type { CurriculumEntry } from "@/lib/useCurriculum";
import type { BreakContentItem, BreakDuration } from "@/lib/types";
import type { BreakClip } from "@/lib/useBreakContent";
import { useBreakContent } from "@/lib/useBreakContent";
import { extractYouTubeId } from "@/lib/youtube";

interface CurriculumBreakFlyoutProps {
  curriculum: CurriculumEntry[];
  currentPosition: number;
  roomWorldKey: string;
  onClose: () => void;
  onSelectContent: (
    item: BreakContentItem,
    duration: BreakDuration,
    clips: BreakClip[]
  ) => void;
}

export function CurriculumBreakFlyout({
  curriculum,
  currentPosition,
  roomWorldKey,
  onClose,
  onSelectContent,
}: CurriculumBreakFlyoutProps) {
  // Load shelf items to match curriculum entries to playable content
  const { items: shelfItems, clips: allClips } = useBreakContent(
    roomWorldKey,
    "learning"
  );

  const completedCount = curriculum.filter((e) => e.completed).length;

  const handleSelect = useCallback(
    (entry: CurriculumEntry) => {
      if (!entry.onShelf) return;

      // Find the matching shelf item by video ID
      const match = shelfItems.find((item) => {
        const itemYtId = extractYouTubeId(item.video_url);
        return itemYtId === entry.videoId;
      });

      if (!match) return;

      // Find clips for this item
      const itemClips = allClips.filter(
        (c) => c.sourceItem.id === match.id
      );

      // Default to best duration or 5 min
      const duration: BreakDuration = (match.best_duration as BreakDuration) ?? 5;
      onSelectContent(match, duration, itemClips.length > 0 ? itemClips : []);
    },
    [shelfItems, allClips, onSelectContent]
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
      <PanelHeader title="Learning Path" onClose={onClose} />

      <div className="px-5 pb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5 text-[var(--sg-forest-500)]" />
          <span className="text-xs text-white/40">
            {completedCount} of {curriculum.length} completed
          </span>
        </div>
        {/* Progress bar */}
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[var(--sg-forest-500)] transition-[width] duration-300"
            style={{
              width: `${curriculum.length > 0 ? (completedCount / curriculum.length) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      <div className="fp-shell-scroll flex-1 overflow-y-auto px-5 py-3">
        <div className="flex flex-col gap-2">
          {curriculum.map((entry) => {
            const isCurrent = entry.sequencePosition === currentPosition;

            return (
              <button
                key={entry.videoId}
                className={`group relative w-full rounded-xl border p-3 text-left transition-colors ${
                  entry.completed
                    ? "border-white/5 bg-white/[0.02] opacity-60"
                    : isCurrent
                      ? "border-[var(--sg-forest-500)]/30 bg-[var(--sg-forest-500)]/5"
                      : entry.onShelf
                        ? "border-white/5 bg-transparent hover:bg-white/[0.04]"
                        : "cursor-not-allowed border-white/5 bg-transparent opacity-40"
                }`}
                onClick={() => handleSelect(entry)}
                disabled={!entry.onShelf || entry.completed}
              >
                <div className="flex items-start gap-3">
                  {/* Position number / status */}
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white/50">
                    {entry.completed ? (
                      <CheckCircle className="h-4 w-4 text-[var(--sg-forest-300)]" />
                    ) : !entry.onShelf ? (
                      <Lock className="h-3 w-3 text-white/30" />
                    ) : (
                      entry.sequencePosition
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-white/90">
                        {entry.title}
                      </p>
                      {isCurrent && !entry.completed && (
                        <span className="shrink-0 rounded-full bg-[var(--sg-forest-500)]/20 px-2 py-0.5 text-[10px] font-medium text-[var(--sg-forest-500)]">
                          Up Next
                        </span>
                      )}
                    </div>

                    <p className="mt-0.5 text-xs text-white/40">
                      {entry.creator}
                      {entry.durationSeconds > 0 && (
                        <span className="ml-2">
                          {Math.round(entry.durationSeconds / 60)} min
                        </span>
                      )}
                    </p>

                    {entry.learningRationale && (
                      <p className="mt-1 text-[10px] leading-relaxed text-white/25">
                        {entry.learningRationale}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
