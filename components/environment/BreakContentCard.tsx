"use client";

import type { BreakClip } from "@/lib/useBreakContent";
import { getYouTubeThumbnail } from "@/lib/youtube";

interface BreakContentCardProps {
  clip: BreakClip;
  onSelect: (clip: BreakClip) => void;
}

export function BreakContentCard({ clip, onSelect }: BreakContentCardProps) {
  const { sourceItem } = clip;

  const thumbnailSrc =
    sourceItem.thumbnail_url || getYouTubeThumbnail(sourceItem.video_url);

  return (
    <button
      type="button"
      onClick={() => onSelect(clip)}
      className="group w-full cursor-pointer rounded-xl border border-white/[0.06] p-3 text-left transition-colors hover:bg-white/[0.06]"
      style={{ background: "rgba(255,255,255,0.03)" }}
    >
      {/* Thumbnail */}
      {thumbnailSrc && (
        <div className="mb-2 aspect-video overflow-hidden rounded-lg bg-white/5">
          <img
            src={thumbnailSrc}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      )}

      {/* Clip label — what you'll learn */}
      <p className="text-sm font-medium leading-snug text-white">{clip.label}</p>

      {/* Source meta */}
      <div className="mt-1.5 flex items-center gap-2 text-xs text-white/40">
        {sourceItem.source_name && <span>{sourceItem.source_name}</span>}
        {sourceItem.source_name && (
          <span className="text-white/20">&middot;</span>
        )}
        <span
          className="rounded-full px-1.5 py-0.5 text-2xs"
          style={{ background: "rgba(61,142,139,0.15)", color: "var(--sg-teal-600)" }}
        >
          {clip.duration} min
        </span>
      </div>
    </button>
  );
}
