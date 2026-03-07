"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export type CameraStatus = "idle" | "requesting" | "active" | "denied" | "error";

export function useCamera(initiallyActive = false) {
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const statusRef = useRef<CameraStatus>("idle");
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isRequestingRef = useRef(false);

  const updateStatus = useCallback((s: CameraStatus) => {
    statusRef.current = s;
    setStatus(s);
  }, []);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    updateStatus("idle");
  }, [updateStatus]);

  const start = useCallback(async (deviceId?: string) => {
    if (typeof navigator === "undefined") return;
    if (isRequestingRef.current) return;

    isRequestingRef.current = true;
    updateStatus("requesting");

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
        audio: false,
      });

      streamRef.current = mediaStream;
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      updateStatus("active");
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        updateStatus("denied");
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

  return { videoRef, stream, status, isActive, start, stop, toggle };
}
