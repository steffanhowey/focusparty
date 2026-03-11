"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePointerDrag } from "@/lib/usePointerDrag";
import { extractYouTubeId } from "@/lib/youtube";
import { loadYouTubeAPI } from "@/lib/youtubeApi";
import { TVStaticOverlay, playChannelChangeSound } from "./TVStaticOverlay";
import type { BreakContentItem, BreakDuration, BreakSegment } from "@/lib/types";
import type { BreakClip } from "@/lib/useBreakContent";

// ─── Types ───────────────────────────────────────────────
interface BreakVideoOverlayProps {
  content: BreakContentItem;
  durationMinutes: BreakDuration;
  segment: BreakSegment | null;
  clips: BreakClip[];
  currentClipIndex: number;
  onFinish: () => void;
  onChangeClip: (clip: BreakClip) => void;
}

/** Fire-and-forget engagement tracking. */
function trackEngagement(
  contentItemId: string,
  eventType: "started" | "completed" | "abandoned" | "extended",
  elapsedSeconds?: number,
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

// ─── Component ───────────────────────────────────────────
export function BreakVideoOverlay({
  content,
  durationMinutes,
  segment,
  clips,
  currentClipIndex,
  onFinish,
  onChangeClip,
}: BreakVideoOverlayProps) {
  const totalSeconds = durationMinutes * 60;
  const ytId = extractYouTubeId(content.video_url);
  const startTime = segment?.start ?? 0;

  // ─── Refs ──────────────────────────────────────────────
  const playerRef = useRef<YTPlayer | null>(null);
  const ytWrapperRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trackedStartRef = useRef(false);
  const trackedExtendedRef = useRef(false);
  const { dragRef, dragStyle, wasDraggedRef } = usePointerDrag({ threshold: 4, centerY: true });

  // ─── State ─────────────────────────────────────────────
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isChangingChannel, setIsChangingChannel] = useState(false);
  const [nextClipLabel, setNextClipLabel] = useState("");
  const [shieldVisible, setShieldVisible] = useState(true);

  // Derived
  const isOvertime = elapsed >= totalSeconds;

  // ─── Engagement tracking ───────────────────────────────
  useEffect(() => {
    if (!trackedStartRef.current) {
      trackedStartRef.current = true;
      trackEngagement(content.id, "started");
    }
  }, [content.id]);

  useEffect(() => {
    if (isOvertime && !trackedExtendedRef.current) {
      trackedExtendedRef.current = true;
      trackEngagement(content.id, "extended", elapsed);
    }
  }, [isOvertime, content.id, elapsed]);

  // ─── Elapsed timer (counts up) ────────────────────────
  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // ─── Handlers ──────────────────────────────────────────
  const handleClose = useCallback(() => {
    const watchRatio = totalSeconds > 0 ? elapsed / totalSeconds : 0;
    trackEngagement(content.id, watchRatio >= 0.8 ? "completed" : "abandoned", elapsed);
    onFinish();
  }, [content.id, totalSeconds, elapsed, onFinish]);

  const handleChangeChannel = useCallback(() => {
    if (clips.length <= 1) return;
    playChannelChangeSound();
    // Kill audio immediately — don't wait for effect cleanup
    try { playerRef.current?.destroy(); } catch { /* ok */ }
    playerRef.current = null;
    trackEngagement(content.id, "abandoned", elapsed);
    const nextIndex = (currentClipIndex + 1) % clips.length;
    setNextClipLabel(clips[nextIndex].label);
    setIsChangingChannel(true);
    setShieldVisible(true);
  }, [clips, currentClipIndex, content.id, elapsed]);

  const handleStaticComplete = useCallback(() => {
    const nextIndex = (currentClipIndex + 1) % clips.length;
    onChangeClip(clips[nextIndex]);
    setIsChangingChannel(false);
  }, [clips, currentClipIndex, onChangeClip]);

  const handleScrubClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (ytId && playerRef.current) {
      const dur = playerRef.current.getDuration();
      if (dur > 0) playerRef.current.seekTo(ratio * dur, true);
    } else if (videoRef.current) {
      const dur = videoRef.current.duration;
      if (dur > 0) videoRef.current.currentTime = ratio * dur;
    }
  }, [ytId]);

  // ─── Escape key ────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleClose]);

  // ─── YouTube Player (imperative DOM) ───────────────────
  // YT.Player replaces its target element with an iframe, so we manage
  // it imperatively inside a wrapper div that React always keeps in the DOM.
  useEffect(() => {
    if (!ytId || isChangingChannel || !ytWrapperRef.current) return;
    const wrapper = ytWrapperRef.current;
    let destroyed = false;

    // Fresh target div inside the wrapper
    const target = document.createElement("div");
    target.style.width = "100%";
    target.style.height = "100%";
    wrapper.innerHTML = "";
    wrapper.appendChild(target);

    loadYouTubeAPI().then(() => {
      if (destroyed) return;
      new window.YT.Player(target, {
        videoId: ytId,
        playerVars: {
          autoplay: 1,
          rel: 0,
          controls: 0,
          modestbranding: 1,
          playsinline: 1,
          ...(startTime > 0 ? { start: startTime } : {}),
        },
        events: {
          onReady: (e) => { if (!destroyed) playerRef.current = e.target; },
          onStateChange: (e) => {
            // Fade shield the instant video starts playing (PLAYING = 1)
            if (!destroyed && e.data === 1) setShieldVisible(false);
          },
        },
      });
    });

    return () => {
      destroyed = true;
      try { playerRef.current?.destroy(); } catch { /* already gone */ }
      playerRef.current = null;
      wrapper.innerHTML = "";
    };
  }, [ytId, startTime, isChangingChannel]);

  // ─── Progress polling ──────────────────────────────────
  useEffect(() => {
    if (isChangingChannel) return;

    if (ytId) {
      const id = setInterval(() => {
        const p = playerRef.current;
        if (!p) return;
        try {
          const dur = p.getDuration();
          if (dur > 0) setProgress(p.getCurrentTime() / dur);
        } catch { /* player not ready */ }
      }, 250);
      return () => clearInterval(id);
    }

    const el = videoRef.current;
    if (el) {
      const onUpdate = () => {
        if (el.duration > 0) setProgress(el.currentTime / el.duration);
      };
      el.addEventListener("timeupdate", onUpdate);
      return () => el.removeEventListener("timeupdate", onUpdate);
    }
  }, [ytId, isChangingChannel]);

  // ─── Render ────────────────────────────────────────────
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
        ...(isOvertime
          ? {
              animation: "fp-break-pulse 2s ease-in-out infinite",
              borderColor: "rgba(140, 85, 239, 0.3)",
            }
          : {}),
      }}
    >
      {/* Channel knob — right edge */}
      {clips.length > 1 && !isChangingChannel && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!wasDraggedRef.current) handleChangeChannel();
          }}
          className="absolute right-2 top-1/2 z-10 flex -translate-y-1/2 cursor-pointer items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          aria-label="Next channel"
        >
          <div
            className="relative h-10 w-10 rounded-full border border-white/20 transition-transform duration-300 active:scale-95"
            style={{
              background: "radial-gradient(circle at 40% 35%, rgba(60,60,60,1), rgba(25,25,25,1))",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 2px 8px rgba(0,0,0,0.6)",
              transform: `rotate(${currentClipIndex * (360 / clips.length)}deg)`,
            }}
          >
            <div
              className="absolute left-1/2 top-[5px] h-[8px] w-[2px] -translate-x-1/2 rounded-full"
              style={{ background: "rgba(255,255,255,0.7)" }}
            />
            <div
              className="absolute inset-[3px] rounded-full"
              style={{
                background: "repeating-conic-gradient(rgba(255,255,255,0.03) 0deg 10deg, transparent 10deg 20deg)",
              }}
            />
          </div>
        </button>
      )}

      {/* Video area */}
      <div className="relative aspect-video w-full bg-black">
        {/* Player — YT wrapper stays in DOM to prevent React/iframe mismatch */}
        {ytId ? (
          <div
            ref={ytWrapperRef}
            className="h-full w-full"
            style={{ display: isChangingChannel ? "none" : undefined }}
          />
        ) : (
          !isChangingChannel && (
            <video
              src={content.video_url}
              autoPlay
              className="h-full w-full"
              ref={(el) => {
                videoRef.current = el;
                if (el && startTime > 0) el.currentTime = startTime;
              }}
            />
          )
        )}

        {/* Hover shield — blocks YouTube's native overlay chrome.
            Starts opaque black to mask auto-shown title bar, fades on play. */}
        {!isChangingChannel && ytId && (
          <div
            className="absolute inset-0 z-[5] transition-[background-color] duration-500 ease-out"
            style={{ backgroundColor: shieldVisible ? "black" : "transparent" }}
          />
        )}

        {/* Video info — hover-revealed top bar */}
        {!isChangingChannel && (
          <div className="absolute inset-x-0 top-0 z-10 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <div
              className="flex items-start justify-between gap-4 px-4 pt-3 pb-6"
              style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)" }}
            >
              <div className="min-w-0">
                <p className="text-[13px] font-medium leading-tight text-white/90 line-clamp-1">
                  {content.title}
                </p>
                {content.source_name && (
                  <p className="mt-0.5 text-[11px] text-white/50">{content.source_name}</p>
                )}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!wasDraggedRef.current) handleClose();
                }}
                className="shrink-0 cursor-pointer rounded-full px-3 py-1 text-[11px] font-medium text-white/60 transition-colors duration-150 hover:bg-white/10 hover:text-white/90"
                style={{ border: "1px solid rgba(255,255,255,0.15)" }}
              >
                End Break
              </button>
            </div>
          </div>
        )}

        {/* TV static transition */}
        {isChangingChannel && (
          <TVStaticOverlay
            durationMs={1200}
            label={nextClipLabel}
            onComplete={handleStaticComplete}
          />
        )}

        {/* Scrub bar — hover-revealed bottom bar */}
        {!isChangingChannel && (
          <div
            className="absolute inset-x-0 bottom-0 z-10 h-6 cursor-pointer opacity-0 transition-opacity duration-200 group-hover:opacity-100"
            onClick={handleScrubClick}
          >
            <div className="absolute inset-x-3 bottom-1 h-[3px] rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white/70 transition-[width] duration-200"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes fp-break-pulse {
          0%, 100% {
            border-color: rgba(140, 85, 239, 0.3);
            box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 0 rgba(140,85,239,0);
          }
          50% {
            border-color: rgba(140, 85, 239, 0.8);
            box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 16px 4px rgba(140,85,239,0.2);
          }
        }
      `}</style>
    </div>
  );
}
