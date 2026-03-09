"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import type { ParticipantStatus } from "@/lib/types";
import type { SyntheticArchetype } from "@/lib/synthetics/pool";

export interface ParticipantInfo {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  isFocusing?: boolean;
  isHost?: boolean;
  isCurrentUser?: boolean;
  /** Discriminator for card content */
  participantType: "real" | "synthetic" | "host";
  /** Real users: live status from presence */
  status?: ParticipantStatus;
  /** Real users: declared sprint goal */
  goalPreview?: string | null;
  /** Synthetics: archetype from pool */
  archetype?: SyntheticArchetype;
  /** Host: personality key */
  hostPersonality?: string;
}

interface EnvironmentParticipantsProps {
  participants: ParticipantInfo[];
  onParticipantClick?: (participant: ParticipantInfo, rect: DOMRect) => void;
  /** Active camera stream for the current user — replaces their avatar when present */
  cameraStream?: MediaStream | null;
}

/** Generate a consistent DiceBear avatar URL from a user ID or name. */
function fallbackAvatar(seed: string): string {
  return `https://api.dicebear.com/9.x/notionists-neutral/png?seed=${encodeURIComponent(seed)}&size=80`;
}

export function EnvironmentParticipants({
  participants,
  onParticipantClick,
  cameraStream,
}: EnvironmentParticipantsProps) {
  if (participants.length === 0) return null;

  return (
    <div className="pointer-events-none absolute left-0 top-0 z-10 flex h-full flex-col flex-wrap content-start items-center gap-x-3 gap-y-4 overflow-hidden px-4 pb-24 pt-20">
      {participants.map((p) => (
        <div
          key={p.id}
          className="pointer-events-auto flex cursor-pointer flex-col items-center gap-1"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            onParticipantClick?.(p, rect);
          }}
        >
          {/* Avatar — live camera feed for current user, static image for others */}
          <div className="relative">
            {p.isCurrentUser && cameraStream ? (
              <CameraAvatar stream={cameraStream} />
            ) : (
              <Image
                src={p.avatarUrl || fallbackAvatar(p.id || p.displayName)}
                alt={p.displayName}
                width={64}
                height={64}
                className="h-16 w-16 rounded-full object-cover transition-transform duration-150 hover:scale-105"
                style={{
                  border: "2px solid rgba(255,255,255,0.12)",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
                }}
              />
            )}
          </div>

          {/* Name */}
          <span className="max-w-[80px] truncate text-center text-xs font-medium text-white/70">
            {p.isHost ? "Host" : p.isCurrentUser ? "You" : p.displayName.split(" ")[0]}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── Live camera feed rendered as a circular avatar ───── */

function CameraAvatar({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="h-16 w-16 rounded-full object-cover transition-transform duration-150 hover:scale-105"
      style={{
        border: "2px solid rgba(255,255,255,0.12)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
        transform: "scaleX(-1)",
      }}
    />
  );
}
