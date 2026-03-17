"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePointerDrag } from "@/lib/usePointerDrag";
import { extractYouTubeId } from "@/lib/youtube";
import { loadYouTubeAPI } from "@/lib/youtubeApi";
import { StickyNote } from "lucide-react";
import { TVStaticOverlay, playChannelChangeSound } from "./TVStaticOverlay";
import type { BreakContentItem, BreakDuration, BreakSegment } from "@/lib/types";
import type { BreakClip } from "@/lib/useBreakContent";
import type { Scaffolding } from "@/lib/scaffolding/generator";
import { trackScaffoldingEvent } from "@/lib/breaks/scaffoldingTracking";

// ─── Types ───────────────────────────────────────────────
interface BreakVideoOverlayProps {
  content: BreakContentItem;
  durationMinutes: BreakDuration;
  segment: BreakSegment | null;
  clips: BreakClip[];
  currentClipIndex: number;
  onFinish: () => void;
  onChangeClip: (clip: BreakClip) => void;
  onToggleNotes?: () => void;
  /** When true, player shifts left to make room for notes panel */
  notesOpen?: boolean;
  /** AI-generated learning scaffolding */
  scaffolding?: Scaffolding | null;
}

/** Fire-and-forget engagement tracking. */
function trackEngagement(
  contentItemId: string,
  eventType: "started" | "completed" | "abandoned" | "extended",
  elapsedSeconds?: number,
  worldKey?: string,
) {
  fetch("/api/breaks/engagement", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content_item_id: contentItemId,
      event_type: eventType,
      elapsed_seconds: elapsedSeconds ?? null,
      world_key: worldKey ?? null,
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
  onToggleNotes,
  notesOpen,
  scaffolding,
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
  const [paused, setPaused] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [hoveredMoment, setHoveredMoment] = useState<number | null>(null);
  const pendingNextIndexRef = useRef<number | null>(null);

  // Derived
  const isOvertime = elapsed >= totalSeconds;

  // ─── Reset state on content change (no more key-remount) ─
  useEffect(() => {
    trackedStartRef.current = false;
    trackedExtendedRef.current = false;
    setElapsed(0);
    setProgress(0);
    setPaused(false);
    setShieldVisible(true);
  }, [content.id]);

  // ─── Engagement tracking ───────────────────────────────
  useEffect(() => {
    if (!trackedStartRef.current) {
      trackedStartRef.current = true;
      trackEngagement(content.id, "started", undefined, content.room_world_key);
    }
  }, [content.id]);

  useEffect(() => {
    if (isOvertime && !trackedExtendedRef.current) {
      trackedExtendedRef.current = true;
      trackEngagement(content.id, "extended", elapsed, content.room_world_key);
    }
  }, [isOvertime, content.id, elapsed]);

  // ─── Elapsed timer (counts up — pauses during transitions & pause) ─
  useEffect(() => {
    if (paused || isChangingChannel) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [paused, isChangingChannel]);

  // ─── Handlers ──────────────────────────────────────────
  const handleClose = useCallback(() => {
    const watchRatio = totalSeconds > 0 ? elapsed / totalSeconds : 0;
    trackEngagement(content.id, watchRatio >= 0.8 ? "completed" : "abandoned", elapsed, content.room_world_key);
    onFinish();
  }, [content.id, totalSeconds, elapsed, onFinish]);

  const handleChangeChannel = useCallback(() => {
    if (clips.length <= 1) return;
    playChannelChangeSound();
    // Kill audio immediately — don't wait for effect cleanup
    try { playerRef.current?.destroy(); } catch { /* ok */ }
    playerRef.current = null;
    trackEngagement(content.id, "abandoned", elapsed, content.room_world_key);
    // Compute next index ONCE and lock it for the transition
    // Clamp currentClipIndex to valid range in case the clips array shifted
    const safeIndex = Math.min(Math.max(currentClipIndex, 0), clips.length - 1);
    const nextIndex = (safeIndex + 1) % clips.length;
    pendingNextIndexRef.current = nextIndex;
    setNextClipLabel(clips[nextIndex].label);
    setIsChangingChannel(true);
    setShieldVisible(true);
    // Safety: if static animation never fires onComplete, auto-recover after 3s
    setTimeout(() => setIsChangingChannel((v) => v ? false : v), 3000);
  }, [clips, currentClipIndex, content.id, elapsed]);

  const handleStaticComplete = useCallback(() => {
    // Use the index locked at channel-change time, not a potentially stale re-derivation
    const nextIndex = pendingNextIndexRef.current ?? (currentClipIndex + 1) % clips.length;
    pendingNextIndexRef.current = null;
    const nextClip = clips[nextIndex];
    if (!nextClip) {
      // Clips array shifted during transition — bail out gracefully
      setIsChangingChannel(false);
      return;
    }
    onChangeClip(nextClip);
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

  const handleTogglePlayPause = useCallback(() => {
    if (ytId && playerRef.current) {
      try {
        const state = playerRef.current.getPlayerState();
        if (state === 1) { // PLAYING
          playerRef.current.pauseVideo();
          setPaused(true);
        } else {
          playerRef.current.playVideo();
          setPaused(false);
        }
      } catch { /* player not ready */ }
    } else if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setPaused(false);
      } else {
        videoRef.current.pause();
        setPaused(true);
      }
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

  // Stable refs for error fallback (avoids dep-array churn)
  const clipsRef = useRef(clips);
  clipsRef.current = clips;
  const changeChannelRef = useRef(handleChangeChannel);
  changeChannelRef.current = handleChangeChannel;

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

    // Fallback: force shield away after 4s even if PLAYING event never fires
    const shieldTimeout = setTimeout(() => {
      if (!destroyed) setShieldVisible(false);
    }, 4000);

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
            if (destroyed) return;
            // Fade shield the instant video starts playing (PLAYING = 1)
            if (e.data === 1) {
              clearTimeout(shieldTimeout);
              setShieldVisible(false);
            }
          },
          onError: () => {
            // Video unavailable / restricted — skip to next clip or close
            if (destroyed) return;
            clearTimeout(shieldTimeout);
            setShieldVisible(false);
            if (clipsRef.current.length > 1) {
              changeChannelRef.current();
            }
          },
        },
      });
    });

    return () => {
      destroyed = true;
      clearTimeout(shieldTimeout);
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
          if (dur > 0) {
            setProgress(p.getCurrentTime() / dur);
            setVideoDuration(dur);
          }
        } catch { /* player not ready */ }
      }, 250);
      return () => clearInterval(id);
    }

    const el = videoRef.current;
    if (el) {
      const onUpdate = () => {
        if (el.duration > 0) {
          setProgress(el.currentTime / el.duration);
          setVideoDuration(el.duration);
        }
      };
      el.addEventListener("timeupdate", onUpdate);
      return () => el.removeEventListener("timeupdate", onUpdate);
    }
  }, [ytId, isChangingChannel]);

  // ─── Render ────────────────────────────────────────────
  return (
    <div
      ref={dragRef}
      className="group absolute top-1/2 z-30 w-[560px] overflow-hidden rounded-xl border border-white/[0.08]"
      style={{
        left: notesOpen ? "calc(50% - 168px)" : "50%",
        ...dragStyle,
        transition: "left 0.3s ease",
        background: "rgba(15,35,24,0.85)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        boxShadow: "var(--sg-shadow-dark-lg)",
        ...(isOvertime
          ? {
              animation: "fp-break-pulse 2s ease-in-out infinite",
              borderColor: "rgba(61,142,139,0.3)",
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
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), var(--sg-shadow-sm)",
              transform: `rotate(${currentClipIndex * (360 / clips.length)}deg)`,
              transition: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
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
              onError={() => {
                // Video failed to load — skip to next clip or end break
                if (clips.length > 1) {
                  handleChangeChannel();
                } else {
                  onFinish();
                }
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

        {/* Play/pause click target — sits above shield */}
        {!isChangingChannel && !shieldVisible && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!wasDraggedRef.current) handleTogglePlayPause();
            }}
            className="absolute inset-0 z-[6] flex cursor-pointer items-center justify-center bg-transparent"
            aria-label={paused ? "Play video" : "Pause video"}
          >
            {/* Icon: always visible when paused, hover-revealed when playing */}
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-full transition-opacity duration-200 ${
                paused ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
              style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
            >
              {paused ? (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M6 4L16 10L6 16V4Z" fill="white" fillOpacity="0.9" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <rect x="5" y="4" width="3.5" height="12" rx="0.5" fill="white" fillOpacity="0.9" />
                  <rect x="11.5" y="4" width="3.5" height="12" rx="0.5" fill="white" fillOpacity="0.9" />
                </svg>
              )}
            </div>
          </button>
        )}

        {/* Video info — hover-revealed top bar */}
        {!isChangingChannel && (
          <div className="absolute inset-x-0 top-0 z-10 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <div
              className="flex items-start justify-between gap-4 px-4 pt-3 pb-6"
              style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)" }}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium leading-tight text-white/90 line-clamp-1">
                  {content.title}
                </p>
                {content.source_name && (
                  <p className="mt-0.5 text-2xs text-white/50">{content.source_name}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {onToggleNotes && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!wasDraggedRef.current) onToggleNotes();
                    }}
                    className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-white/50 transition-colors duration-150 hover:bg-white/10 hover:text-white/90"
                    aria-label="Notes"
                  >
                    <StickyNote size={14} strokeWidth={1.8} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!wasDraggedRef.current) handleClose();
                  }}
                  className="shrink-0 cursor-pointer rounded-full px-3 py-1 text-2xs font-medium text-white/60 transition-colors duration-150 hover:bg-white/10 hover:text-white/90"
                  style={{ border: "1px solid rgba(255,255,255,0.15)" }}
                >
                  End Break
                </button>
              </div>
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
              {/* Key moment markers */}
              {scaffolding?.keyMoments && videoDuration > 0 && scaffolding.keyMoments.map((km, i) => {
                const pct = (km.timestampSeconds / videoDuration) * 100;
                if (pct < 0 || pct > 100) return null;
                return (
                  <div
                    key={i}
                    className="absolute top-1/2 -translate-y-1/2"
                    style={{ left: `${pct}%` }}
                    onMouseEnter={() => setHoveredMoment(i)}
                    onMouseLeave={() => setHoveredMoment(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (ytId && playerRef.current) {
                        playerRef.current.seekTo(km.timestampSeconds, true);
                      } else if (videoRef.current) {
                        videoRef.current.currentTime = km.timestampSeconds;
                      }
                      trackScaffoldingEvent(content.id, "key_moment_clicked", {
                        timestampSeconds: km.timestampSeconds,
                        label: km.label,
                      });
                    }}
                  >
                    <div className="h-[6px] w-[6px] -translate-x-1/2 cursor-pointer rounded-full bg-white/60 transition-colors hover:bg-white" />
                    {hoveredMoment === i && (
                      <div
                        className="absolute bottom-4 left-1/2 z-20 w-48 -translate-x-1/2 rounded-lg border border-white/10 px-3 py-2"
                        style={{
                          background: "rgba(15,35,24,0.9)",
                          backdropFilter: "blur(12px)",
                        }}
                      >
                        <p className="text-xs font-medium text-white/90">{km.label}</p>
                        <p className="mt-0.5 text-[10px] text-white/40">{km.takeaway}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes fp-break-pulse {
          0%, 100% {
            border-color: rgba(61,142,139,0.3);
            box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 0 rgba(61,142,139,0);
          }
          50% {
            border-color: rgba(61,142,139,0.8);
            box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 16px 4px rgba(61,142,139,0.2);
          }
        }
      `}</style>
    </div>
  );
}
