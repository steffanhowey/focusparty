"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export type CameraStatus = "idle" | "requesting" | "active" | "denied" | "error";

export function useCamera(initiallyActive = false) {
  const [status, setStatus] = useState<CameraStatus>("idle");
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isRequestingRef = useRef(false);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStatus("idle");
  }, []);

  const start = useCallback(async () => {
    if (typeof navigator === "undefined") return;
    if (isRequestingRef.current) return;

    isRequestingRef.current = true;
    setStatus("requesting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setStatus("active");
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setStatus("denied");
      } else {
        setStatus("error");
      }
    } finally {
      isRequestingRef.current = false;
    }
  }, []);

  const toggle = useCallback(() => {
    if (status === "active") {
      stop();
    } else {
      start();
    }
  }, [status, start, stop]);

  const isActive = status === "active";

  // Auto-start if requested
  useEffect(() => {
    if (initiallyActive) {
      start();
    }
  }, [initiallyActive, start]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return { videoRef, status, isActive, start, stop, toggle };
}
