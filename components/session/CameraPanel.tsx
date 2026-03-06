"use client";

import { RefObject } from "react";
import { Video, VideoOff } from "lucide-react";
import type { CameraStatus } from "@/lib/useCamera";

interface CameraPanelProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  status: CameraStatus;
  isActive: boolean;
  onToggleCamera?: () => void;
}

export function CameraPanel({ videoRef, status, isActive, onToggleCamera }: CameraPanelProps) {
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
        <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--color-text-tertiary)]">
          <div
            className="mb-2.5 flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold"
            style={{
              background: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border-default)",
            }}
          >
            S
          </div>
          <span className="text-xs">{label}</span>
        </div>
      )}

      {/* Camera toggle */}
      {onToggleCamera && (
        <button
          type="button"
          onClick={onToggleCamera}
          aria-label={isActive ? "Turn off camera" : "Turn on camera"}
          className="absolute bottom-3 left-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-[var(--color-text-tertiary)] backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white"
        >
          {isActive ? <Video size={16} strokeWidth={1.8} /> : <VideoOff size={16} strokeWidth={1.8} />}
        </button>
      )}
    </div>
  );
}
