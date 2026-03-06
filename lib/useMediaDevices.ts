"use client";

import { useState, useEffect, useCallback } from "react";

export interface DeviceInfo {
  deviceId: string;
  label: string;
}

export function useMediaDevices() {
  const [cameras, setCameras] = useState<DeviceInfo[]>([]);
  const [microphones, setMicrophones] = useState<DeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<DeviceInfo[]>([]);

  const enumerate = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setCameras(
        devices
          .filter((d) => d.kind === "videoinput")
          .map((d) => ({
            deviceId: d.deviceId,
            label: d.label || `Camera ${d.deviceId.slice(0, 8)}`,
          }))
      );
      setMicrophones(
        devices
          .filter((d) => d.kind === "audioinput")
          .map((d) => ({
            deviceId: d.deviceId,
            label: d.label || `Microphone ${d.deviceId.slice(0, 8)}`,
          }))
      );
      setSpeakers(
        devices
          .filter((d) => d.kind === "audiooutput")
          .map((d) => ({
            deviceId: d.deviceId,
            label: d.label || `Speaker ${d.deviceId.slice(0, 8)}`,
          }))
      );
    } catch {
      // Permission denied or API unavailable
    }
  }, []);

  useEffect(() => {
    enumerate();
    if (typeof navigator !== "undefined" && navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener("devicechange", enumerate);
      return () =>
        navigator.mediaDevices.removeEventListener("devicechange", enumerate);
    }
  }, [enumerate]);

  return { cameras, microphones, speakers, refresh: enumerate };
}
