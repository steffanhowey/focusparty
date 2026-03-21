"use client";

import type {} from "./youtube";
import { useState, useCallback, useEffect, useRef } from "react";
import {
  type VibeId,
  type MusicStatus,
  VIBES_MAP,
  YT_PREVIEW_PLAYER_ID,
  getPersistedVolume,
  setPersistedVolume,
} from "@/lib/musicConstants";
import { getWorldConfig } from "@/lib/worlds";
import { loadYouTubeAPI } from "@/lib/youtubeApi";

/* ------------------------------------------------------------------ */
/*  useVibePreview — lightweight YouTube player for room discovery.    */
/*  Separate from useMusic to avoid cross-page lifecycle coupling.     */
/* ------------------------------------------------------------------ */

export interface UseVibePreview {
  /** Currently previewing vibe (null if stopped) */
  previewingVibeId: VibeId | null;
  /** Stable UI key for the room card currently previewing */
  previewingKey: string | null;
  /** World key of the room being previewed */
  previewingWorldKey: string | null;
  /** Player status */
  status: MusicStatus;
  /** Start previewing a specific room's vibe (by world key) */
  startPreview: (worldKey: string, previewKey?: string) => void;
  /** Stop any active preview */
  stopPreview: () => void;
  /** Toggle preview for a room (start if stopped, stop if already playing) */
  togglePreview: (worldKey: string, previewKey?: string) => void;
  /** Volume (shared with session via localStorage) */
  volume: number;
  setVolume: (vol: number) => void;
  /** The player container element ID */
  playerContainerId: string;
}

export function useVibePreview(): UseVibePreview {
  const [status, setStatus] = useState<MusicStatus>("idle");
  const [previewingVibeId, setPreviewingVibeId] = useState<VibeId | null>(null);
  const [previewingKey, setPreviewingKey] = useState<string | null>(null);
  const [previewingWorldKey, setPreviewingWorldKey] = useState<string | null>(null);
  const [volume, setVolumeState] = useState(() => getPersistedVolume());

  const playerRef = useRef<YTPlayer | null>(null);
  const videoIndexRef = useRef(0);
  const activeVibeRef = useRef<VibeId | null>(null);
  const volumeRef = useRef(volume);
  const isLoadingRef = useRef(false);
  const generationRef = useRef(0);
  const createPlayerRef = useRef<(videoId: string, autoplay: boolean) => void>(() => {});

  useEffect(() => {
    activeVibeRef.current = previewingVibeId;
  }, [previewingVibeId]);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  /* ---------- Player creation ---------- */

  const createPlayer = useCallback(
    (videoId: string, autoplay: boolean) => {
      const gen = ++generationRef.current;

      try {
        playerRef.current?.destroy();
      } catch {
        // ignore
      }
      playerRef.current = null;

      // Restore placeholder div after destroy
      if (!document.getElementById(YT_PREVIEW_PLAYER_ID)) {
        const container = document.querySelector("[data-preview-container]");
        if (container) {
          const div = document.createElement("div");
          div.id = YT_PREVIEW_PLAYER_ID;
          container.appendChild(div);
        }
      }

      playerRef.current = new window.YT.Player(YT_PREVIEW_PLAYER_ID, {
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
            if (generationRef.current !== gen) return;
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
            if (generationRef.current !== gen) return;
            switch (event.data) {
              case 1: // PLAYING
                setStatus("playing");
                break;
              case 2: // PAUSED
                setStatus("paused");
                break;
              case 0: {
                // ENDED — advance to next video
                const vibe = activeVibeRef.current;
                if (!vibe) break;
                const config = VIBES_MAP[vibe];
                if (!config) break;
                videoIndexRef.current =
                  (videoIndexRef.current + 1) % config.videoIds.length;
                createPlayerRef.current(config.videoIds[videoIndexRef.current], true);
                break;
              }
              case 3: // BUFFERING
                setStatus("loading");
                break;
            }
          },
          onError: (event) => {
            if (generationRef.current !== gen) return;
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
              setStatus("error");
              return;
            }
            videoIndexRef.current = nextIndex;
            createPlayerRef.current(config.videoIds[nextIndex], true);
          },
        },
      });
    },
    [],
  );

  useEffect(() => {
    createPlayerRef.current = createPlayer;
  }, [createPlayer]);

  /* ---------- Async fallback ---------- */

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

  /* ---------- Cleanup on unmount ---------- */

  useEffect(() => {
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

  const startPreview = useCallback(
    (worldKey: string, previewKey?: string) => {
      const world = getWorldConfig(worldKey);
      const vibeId = world.vibeKey;

      setPreviewingVibeId(vibeId);
      setPreviewingKey(previewKey ?? worldKey);
      setPreviewingWorldKey(worldKey);

      const config = VIBES_MAP[vibeId];
      if (!config) return;

      videoIndexRef.current = 0;

      if (window.YT?.Player) {
        setStatus("loading");
        createPlayer(config.videoIds[0], true);
      } else {
        ensurePlayer(vibeId, true);
      }
    },
    [createPlayer, ensurePlayer],
  );

  const stopPreview = useCallback(() => {
    try {
      playerRef.current?.stopVideo();
    } catch {
      // ignore
    }
    setPreviewingVibeId(null);
    setPreviewingKey(null);
    setPreviewingWorldKey(null);
    setStatus("idle");
  }, []);

  const togglePreview = useCallback(
    (worldKey: string, previewKey?: string) => {
      const resolvedPreviewKey = previewKey ?? worldKey;
      if (previewingKey === resolvedPreviewKey && (status === "playing" || status === "loading")) {
        stopPreview();
      } else {
        startPreview(worldKey, resolvedPreviewKey);
      }
    },
    [previewingKey, status, startPreview, stopPreview],
  );

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(100, vol));
    setVolumeState(clamped);
    playerRef.current?.setVolume(clamped);
    setPersistedVolume(clamped);
  }, []);

  return {
    previewingVibeId,
    previewingKey,
    previewingWorldKey,
    status,
    startPreview,
    stopPreview,
    togglePreview,
    volume,
    setVolume,
    playerContainerId: YT_PREVIEW_PLAYER_ID,
  };
}
