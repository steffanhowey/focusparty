"use client";

import { RefObject } from "react";
import type { CameraStatus } from "@/lib/useCamera";

interface CameraPanelProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  status: CameraStatus;
  isActive: boolean;
}

export function CameraPanel({ videoRef, status, isActive }: CameraPanelProps) {
  const label =
    status === "requesting"
      ? "Requesting camera…"
      : status === "denied"
        ? "Camera access denied"
        : status === "error"
          ? "Camera unavailable"
          : "Camera off";

  return (
    <div className="relative h-full w-full">
      {/* Always rendered so videoRef is connected to a real DOM node */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`h-full w-full object-cover ${isActive ? "" : "hidden"}`}
        style={{ transform: "scaleX(-1)" }}
      />

      {!isActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--color-text-tertiary)]" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>
          <div
            className="mb-2.5 flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold"
            style={{
              background: "var(--sg-forest-800)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            S
          </div>
          <span className="text-xs">{label}</span>
        </div>
      )}

    </div>
  );
}
