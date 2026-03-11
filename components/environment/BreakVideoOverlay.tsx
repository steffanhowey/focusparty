"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X } from "lucide-react";
import { usePointerDrag } from "@/lib/usePointerDrag";
import { extractYouTubeId } from "@/lib/youtube";
import type { BreakContentItem } from "@/lib/types";

interface BreakVideoOverlayProps {
  content: BreakContentItem;
  onFinish: () => void;
}

/** Fire-and-forget engagement tracking. */
function trackEngagement(
  contentItemId: string,
  eventType: "started" | "completed" | "abandoned",
  elapsedSeconds?: number
) {
  fetch("/api/breaks/engagement", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content_item_id: contentItemId,
      event_type: eventType,
      elapsed_seconds: elapsedSeconds ?? null,
    }),
  }).catch(() => {});
}

export function BreakVideoOverlay({
  content,
  onFinish,
}: BreakVideoOverlayProps) {
  const [elapsed, setElapsed] = useState(0);
  const { dragRef, dragStyle, wasDraggedRef } = usePointerDrag({ threshold: 4, centerY: true });
  const trackedStartRef = useRef(false);

  // Track "started" on mount
  useEffect(() => {
    if (!trackedStartRef.current) {
      trackedStartRef.current = true;
      trackEngagement(content.id, "started");
    }
  }, [content.id]);

  // Break timer (counts up)
  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Track engagement + close
  const handleClose = useCallback(() => {
    const duration = content.duration_seconds ?? 0;
    const watchRatio = duration > 0 ? elapsed / duration : 0;
    const eventType = watchRatio >= 0.8 ? "completed" : "abandoned";
    trackEngagement(content.id, eventType, elapsed);
    onFinish();
  }, [content.id, content.duration_seconds, elapsed, onFinish]);

  // Escape key to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleClose]);

  const formatElapsed = useCallback((s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }, []);

  const ytId = extractYouTubeId(content.video_url);

  const truncatedTitle =
    content.title.length > 52
      ? content.title.slice(0, 49) + "..."
      : content.title;

  return (
    <div
      ref={dragRef}
      className="group absolute left-1/2 top-1/2 z-30 w-[560px] overflow-hidden rounded-xl border border-white/[0.08]"
      style={{
        ...dragStyle,
        background: "rgba(10,10,10,0.85)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        boxShadow:
          "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      {/* Title bar — drag handle, revealed on hover */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 px-3 py-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)" }}
      >
        <span className="flex-1 truncate text-xs font-medium text-white/90">
          {truncatedTitle}
        </span>
        <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[10px] tabular-nums text-white/70">
          {formatElapsed(elapsed)}
        </span>
        <button
          type="button"
          onClick={() => {
            if (!wasDraggedRef.current) handleClose();
          }}
          className="shrink-0 cursor-pointer rounded-full p-1 text-white/60 transition-colors hover:bg-white/20 hover:text-white"
          aria-label="End break"
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>

      {/* Video */}
      <div className="aspect-video w-full bg-black">
        {ytId ? (
          <iframe
            src={`https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`}
            allow="autoplay; encrypted-media"
            allowFullScreen
            className="h-full w-full"
            title={content.title}
          />
        ) : (
          <video
            src={content.video_url}
            autoPlay
            controls
            className="h-full w-full"
          />
        )}
      </div>
    </div>
  );
}
