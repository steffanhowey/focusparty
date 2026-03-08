"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export type ScreenShareStatus = "idle" | "requesting" | "active" | "denied" | "error";

export function useScreenShare() {
  const [status, setStatus] = useState<ScreenShareStatus>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const statusRef = useRef<ScreenShareStatus>("idle");
  const streamRef = useRef<MediaStream | null>(null);
  const isRequestingRef = useRef(false);

  const updateStatus = useCallback((s: ScreenShareStatus) => {
    statusRef.current = s;
    setStatus(s);
  }, []);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
    }
    updateStatus("idle");
  }, [updateStatus]);

  // Use a ref so the track.onended handler always sees the latest stop
  const stopRef = useRef(stop);
  stopRef.current = stop;

  const start = useCallback(async () => {
    if (typeof navigator === "undefined") return;
    if (isRequestingRef.current) return;

    isRequestingRef.current = true;
    updateStatus("requesting");

    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      // Handle edge case: some browsers resolve with an already-ended stream
      const videoTrack = mediaStream.getVideoTracks()[0];
      if (!videoTrack || videoTrack.readyState === "ended") {
        mediaStream.getTracks().forEach((t) => t.stop());
        updateStatus("idle");
        return;
      }

      streamRef.current = mediaStream;
      setStream(mediaStream);
      updateStatus("active");

      // Listen for user stopping via browser's native "Stop sharing" button
      videoTrack.onended = () => {
        stopRef.current();
      };
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        // User cancelled the picker — not a permanent denial
        updateStatus("idle");
      } else {
        updateStatus("error");
      }
    } finally {
      isRequestingRef.current = false;
    }
  }, [updateStatus]);

  const toggle = useCallback(() => {
    if (statusRef.current === "active") {
      stop();
    } else {
      start();
    }
  }, [start, stop]);

  const isActive = status === "active";

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return { stream, status, isActive, start, stop, toggle };
}
