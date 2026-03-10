"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  type VibeId,
  type MusicStatus,
  VIBES_MAP,
  YT_PLAYER_ID,
  loadMusicPrefs,
  persistMusicPrefs,
} from "@/lib/musicConstants";
import { loadYouTubeAPI } from "@/lib/youtubeApi";

/* ------------------------------------------------------------------ */
/*  useMusic hook                                                     */
/* ------------------------------------------------------------------ */

export function useMusic() {
  const [status, setStatus] = useState<MusicStatus>("idle");
  const [activeVibe, setActiveVibe] = useState<VibeId | null>(
    () => loadMusicPrefs().vibe,
  );
  const [volume, setVolumeState] = useState(() => loadMusicPrefs().volume);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const playerRef = useRef<YTPlayer | null>(null);
  const videoIndexRef = useRef(0);
  const activeVibeRef = useRef(activeVibe);
  const volumeRef = useRef(volume);
  const isLoadingRef = useRef(false);
  // Incremented on each createPlayer call so stale events from a
  // previously-destroyed player are silently ignored.
  const generationRef = useRef(0);
  // Ref so event handlers inside createPlayer can call it for video transitions
  const createPlayerRef = useRef<(videoId: string, autoplay: boolean) => void>(
    () => {},
  );

  // Keep refs in sync with state for use in callbacks
  useEffect(() => {
    activeVibeRef.current = activeVibe;
  }, [activeVibe]);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  /* ---------- Player creation ---------- */

  const createPlayer = useCallback(
    (videoId: string, autoplay: boolean) => {
      // Bump generation so any events from the previous player are ignored
      const gen = ++generationRef.current;

      // Destroy existing player first
      try {
        playerRef.current?.destroy();
      } catch {
        // ignore
      }
      playerRef.current = null;

      // YouTube's destroy() removes the iframe from the DOM.
      // Restore the placeholder div inside our wrapper container.
      if (!document.getElementById(YT_PLAYER_ID)) {
        const container = document.querySelector("[data-music-container]");
        if (container) {
          const div = document.createElement("div");
          div.id = YT_PLAYER_ID;
          container.appendChild(div);
        }
      }

      playerRef.current = new window.YT.Player(YT_PLAYER_ID, {
        height: "200",
        width: "200",
        videoId,
        playerVars: {
          autoplay: autoplay ? 1 : 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onReady: (event) => {
            if (generationRef.current !== gen) return; // stale player
            // The constructor return value is a proxy; event.target is the
            // fully-initialised player with working API methods.
            playerRef.current = event.target;
            event.target.setVolume(volumeRef.current);
            if (autoplay) {
              setStatus("playing");
            } else {
              setStatus("ready");
            }
            isLoadingRef.current = false;
          },
          onStateChange: (event) => {
            if (generationRef.current !== gen) return; // stale player
            switch (event.data) {
              case 1: // PLAYING
                setStatus("playing");
                break;
              case 2: // PAUSED
                setStatus("paused");
                break;
              case 0: {
                // ENDED — advance to next video in vibe via fresh player
                // (loadVideoById is unreliable for livestreams)
                const vibe = activeVibeRef.current;
                if (!vibe) break;
                const config = VIBES_MAP[vibe];
                if (!config) break;
                videoIndexRef.current =
                  (videoIndexRef.current + 1) % config.videoIds.length;
                const nextId = config.videoIds[videoIndexRef.current];
                createPlayerRef.current(nextId, true);
                break;
              }
              case 3: // BUFFERING
                setStatus("loading");
                break;
            }
          },
          onError: (event) => {
            if (generationRef.current !== gen) return; // stale player
            // Try next video; if all fail, set error status
            const vibe = activeVibeRef.current;
            if (!vibe) {
              setStatus("error");
              return;
            }
            const config = VIBES_MAP[vibe];
            if (!config) {
              setStatus("error");
              return;
            }
            const nextIndex =
              (videoIndexRef.current + 1) % config.videoIds.length;
            if (nextIndex === 0 && event.data !== 150) {
              // Cycled through all videos
              setStatus("error");
              return;
            }
            videoIndexRef.current = nextIndex;
            createPlayerRef.current(config.videoIds[nextIndex], true);
          },
        },
      });
    },
    [], // stable — uses refs for volume/activeVibe
  );

  // Keep createPlayerRef in sync
  createPlayerRef.current = createPlayer;

  /* ---------- Async fallback: load API then create player ---------- */

  const ensurePlayer = useCallback(
    async (vibeId: VibeId, autoplay: boolean) => {
      if (isLoadingRef.current) return;
      isLoadingRef.current = true;
      setStatus("loading");

      try {
        await loadYouTubeAPI();
      } catch {
        setStatus("error");
        isLoadingRef.current = false;
        return;
      }

      const config = VIBES_MAP[vibeId];
      if (!config) {
        setStatus("error");
        isLoadingRef.current = false;
        return;
      }

      videoIndexRef.current = 0;
      createPlayer(config.videoIds[0], autoplay);
    },
    [createPlayer],
  );

  /* ---------- Eagerly preload YouTube API on mount ---------- */

  useEffect(() => {
    // Preload the YouTube IFrame API script in the background so it's
    // ready when the user clicks play. We intentionally do NOT create
    // the player here — Chrome's autoplay policy requires the player
    // iframe to be created within a user-gesture call stack.
    loadYouTubeAPI().catch((err) => console.error("Failed to preload YouTube API:", err));

    return () => {
      try {
        playerRef.current?.destroy();
      } catch {
        // ignore
      }
      playerRef.current = null;
    };
  }, []);

  /* ---------- Public methods ---------- */

  const selectVibe = useCallback(
    (vibeId: VibeId) => {
      setActiveVibe(vibeId);
      persistMusicPrefs({ vibe: vibeId, volume: volumeRef.current });

      const config = VIBES_MAP[vibeId];
      if (!config) return;

      videoIndexRef.current = 0;

      if (window.YT?.Player) {
        // API preloaded — destroy + recreate player synchronously.
        // loadVideoById is unreliable for livestreams (gets stuck buffering).
        // Recreating preserves user gesture for Chrome autoplay policy.
        setStatus("loading");
        createPlayer(config.videoIds[0], true);
      } else {
        // API still loading — async fallback
        ensurePlayer(vibeId, true);
      }
    },
    [createPlayer, ensurePlayer],
  );

  const play = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.playVideo();
      return;
    }
    // No player yet — create one with the persisted or first vibe
    const vibeId = activeVibeRef.current ?? "calm-focus";
    setActiveVibe(vibeId);
    persistMusicPrefs({ vibe: vibeId, volume: volumeRef.current });

    const config = VIBES_MAP[vibeId];
    if (!config) return;

    videoIndexRef.current = 0;

    if (window.YT?.Player) {
      // API preloaded — create player synchronously (preserves user gesture)
      setStatus("loading");
      createPlayer(config.videoIds[0], true);
    } else {
      // API still loading — async fallback
      ensurePlayer(vibeId, true);
    }
  }, [createPlayer, ensurePlayer]);

  const pause = useCallback(() => {
    playerRef.current?.pauseVideo();
  }, []);

  const togglePlayPause = useCallback(() => {
    const player = playerRef.current;
    if (!player) {
      play();
      return;
    }
    try {
      const state = player.getPlayerState();
      if (state === 1) {
        player.pauseVideo();
      } else {
        player.playVideo();
      }
    } catch {
      // Player in transitional state after destroy/recreate — fall back to play
      play();
    }
  }, [play]);

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(100, vol));
    setVolumeState(clamped);
    playerRef.current?.setVolume(clamped);
    persistMusicPrefs({ vibe: activeVibeRef.current, volume: clamped });
  }, []);

  const togglePopover = useCallback(() => {
    setPopoverOpen((prev) => !prev);
  }, []);

  const closePopover = useCallback(() => {
    setPopoverOpen(false);
  }, []);

  const cleanup = useCallback(() => {
    try {
      playerRef.current?.destroy();
    } catch {
      // ignore
    }
    playerRef.current = null;
    setStatus("idle");
  }, []);

  return {
    status,
    activeVibe,
    volume,
    isPlaying: status === "playing",
    popoverOpen,
    selectVibe,
    play,
    pause,
    togglePlayPause,
    setVolume,
    togglePopover,
    closePopover,
    cleanup,
    playerContainerId: YT_PLAYER_ID,
  };
}
