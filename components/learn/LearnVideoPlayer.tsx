"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckCircle, Play, Pause } from "lucide-react";

interface LearnVideoPlayerProps {
  sourceUrl: string;
  title: string;
  onComplete: () => void;
  isCompleted: boolean;
  onPlayStateChange?: (playing: boolean) => void;
  togglePlayRef?: React.MutableRefObject<(() => void) | null>;
}

/**
 * Extract YouTube video ID from various URL formats.
 */
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * YouTube video player for the learning environment.
 * Matches the rooms experience: hides native YouTube controls,
 * uses a shield overlay, and provides custom play/pause interaction.
 */
export function LearnVideoPlayer({
  sourceUrl,
  title,
  onComplete,
  isCompleted,
  onPlayStateChange,
  togglePlayRef,
}: LearnVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const ytId = extractYouTubeId(sourceUrl);
  const [shieldVisible, setShieldVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleStateChange = useCallback(
    (event: { data: number }) => {
      // YT.PlayerState.PLAYING === 1
      if (event.data === 1) {
        setShieldVisible(false);
        setPaused(false);
        onPlayStateChange?.(true);
      }
      // YT.PlayerState.PAUSED === 2
      if (event.data === 2) {
        setPaused(true);
        onPlayStateChange?.(false);
      }
      // YT.PlayerState.ENDED === 0
      if (event.data === 0 && !isCompleted) {
        onComplete();
      }
    },
    [onComplete, isCompleted]
  );

  const handleTogglePlayPause = useCallback(() => {
    if (!playerRef.current) return;
    try {
      const state = playerRef.current.getPlayerState();
      if (state === 1) {
        playerRef.current.pauseVideo();
        setPaused(true);
      } else {
        playerRef.current.playVideo();
        setPaused(false);
      }
    } catch {
      /* player not ready */
    }
  }, []);

  // Expose toggle function to parent
  useEffect(() => {
    if (togglePlayRef) togglePlayRef.current = handleTogglePlayPause;
    return () => { if (togglePlayRef) togglePlayRef.current = null; };
  }, [togglePlayRef, handleTogglePlayPause]);

  const handleScrubClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      if (!playerRef.current) return;
      try {
        const dur = playerRef.current.getDuration();
        if (dur > 0) playerRef.current.seekTo(ratio * dur, true);
      } catch {
        /* player not ready */
      }
    },
    []
  );

  useEffect(() => {
    if (!ytId || !containerRef.current) return;

    setShieldVisible(true);
    setPaused(false);
    setProgress(0);

    // Load YouTube IFrame API if not already loaded
    const loadAPI = (): Promise<void> => {
      if (window.YT?.Player) return Promise.resolve();
      return new Promise((resolve) => {
        if (document.querySelector('script[src*="youtube.com/iframe_api"]')) {
          const check = setInterval(() => {
            if (window.YT?.Player) {
              clearInterval(check);
              resolve();
            }
          }, 100);
          return;
        }
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          if (prev) prev();
          resolve();
        };
        document.head.appendChild(tag);
      });
    };

    loadAPI().then(() => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }

      const target = document.createElement("div");
      target.style.width = "100%";
      target.style.height = "100%";
      containerRef.current!.innerHTML = "";
      containerRef.current!.appendChild(target);

      playerRef.current = new window.YT.Player(target, {
        videoId: ytId,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 0,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onStateChange: handleStateChange,
        },
      });
    });

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytId]);

  // Update state change handler when dependencies change
  useEffect(() => {
    if (!playerRef.current) return;
  }, [handleStateChange]);

  // Progress polling — matches rooms experience (250ms interval)
  useEffect(() => {
    if (!ytId) return;
    const id = setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      try {
        const dur = p.getDuration();
        if (dur > 0) setProgress(p.getCurrentTime() / dur);
      } catch {
        /* player not ready */
      }
    }, 250);
    return () => clearInterval(id);
  }, [ytId]);

  if (!ytId) {
    return (
      <div className="aspect-video bg-[var(--color-bg-secondary)] flex flex-col items-center justify-center rounded-lg gap-3">
        <p className="text-sm text-[var(--color-text-tertiary)]">
          Video unavailable in player
        </p>
        <Button
          variant={isCompleted ? "ghost" : "primary"}
          size="sm"
          leftIcon={<CheckCircle size={14} />}
          onClick={onComplete}
          disabled={isCompleted}
        >
          {isCompleted ? "Completed" : "Mark Complete"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <div className="relative flex-1 min-h-0 bg-black rounded-lg overflow-hidden group border border-[var(--color-border-default)]">
        {/* YouTube player container */}
        <div
          ref={containerRef}
          className="absolute inset-0"
        />

        {/* Shield overlay with thumbnail — click to play */}
        {ytId && shieldVisible && (
          <button
            type="button"
            onClick={() => {
              if (playerRef.current) {
                try { playerRef.current.playVideo(); } catch { /* not ready */ }
              }
            }}
            className="absolute inset-0 z-[5] flex cursor-pointer items-center justify-center transition-opacity duration-500 ease-out"
            aria-label="Play video"
            style={{
              backgroundImage: `url(https://img.youtube.com/vi/${ytId}/maxresdefault.jpg)`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            {/* Dark scrim */}
            <div className="absolute inset-0 bg-black/40" />
            <div
              className="relative rounded-full p-4"
              style={{ background: "var(--color-accent-primary)" }}
            >
              <Play size={32} className="text-white ml-1" />
            </div>
          </button>
        )}

        {/* Play/pause overlay — click anywhere to toggle */}
        {!shieldVisible && (
          <button
            type="button"
            onClick={handleTogglePlayPause}
            className="absolute inset-0 z-[6] flex cursor-pointer items-center justify-center bg-transparent group/play"
            aria-label={paused ? "Play video" : "Pause video"}
          >
            <div
              className="rounded-full p-3 transition-opacity duration-200"
              style={{
                background: "rgba(0, 0, 0, 0.5)",
                opacity: paused ? 1 : 0,
              }}
            >
              {paused ? (
                <Play size={28} className="text-white ml-0.5" />
              ) : (
                <Pause size={28} className="text-white" />
              )}
            </div>
          </button>
        )}

        {/* Scrub bar — hover-revealed, click to seek */}
        {!shieldVisible && (
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
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--color-text-primary)] line-clamp-1">
          {title}
        </h3>
        <Button
          variant={isCompleted ? "ghost" : "primary"}
          size="sm"
          leftIcon={<CheckCircle size={14} />}
          onClick={onComplete}
          disabled={isCompleted}
        >
          {isCompleted ? "Completed" : "Mark Complete"}
        </Button>
      </div>
    </div>
  );
}
