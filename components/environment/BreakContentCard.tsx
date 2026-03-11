"use client";

import type { BreakContentItem } from "@/lib/types";
import { getYouTubeThumbnail } from "@/lib/youtube";

interface BreakContentCardProps {
  item: BreakContentItem;
  onSelect: (item: BreakContentItem) => void;
}

export function BreakContentCard({ item, onSelect }: BreakContentCardProps) {
  const durationLabel = item.duration_seconds
    ? `${Math.ceil(item.duration_seconds / 60)} min`
    : null;

  const thumbnailSrc =
    item.thumbnail_url || getYouTubeThumbnail(item.video_url);

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
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

      {/* Title + meta */}
      <p className="text-sm font-medium text-white">{item.title}</p>
      <div className="mt-1 flex items-center gap-2 text-xs text-white/40">
        {item.source_name && <span>{item.source_name}</span>}
        {item.source_name && durationLabel && (
          <span className="text-white/20">&middot;</span>
        )}
        {durationLabel && <span>{durationLabel}</span>}
      </div>
      {item.description && (
        <p className="mt-1.5 text-xs leading-relaxed text-white/30 line-clamp-2">
          {item.description}
        </p>
      )}
      {item.editorial_note && (
        <p className="mt-1 text-[11px] italic leading-relaxed text-white/40">
          {item.editorial_note}
        </p>
      )}
    </button>
  );
}
