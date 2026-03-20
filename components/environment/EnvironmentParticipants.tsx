"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Coffee } from "lucide-react";
import type { ParticipantStatus, CommitmentType } from "@/lib/types";
import type { SyntheticArchetype } from "@/lib/synthetics/pool";
import { AvatarCelebration } from "./AvatarCelebration";

export interface ParticipantInfo {
  id: string;
  displayName: string;
  username?: string | null;
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
  /** Real users: commitment type for current sprint */
  commitmentType?: CommitmentType | null;
  /** Synthetics: archetype from pool */
  archetype?: SyntheticArchetype;
  /** Synthetics: unique activity flavor assigned per-room */
  syntheticFlavor?: string;
  /** Host: personality key */
  hostPersonality?: string;
  /** Sprint timing — ISO start time + duration for countdown */
  sprintStartedAt?: string | null;
  sprintDurationSec?: number | null;
  /** Break content — populated when on break */
  breakContentId?: string | null;
  breakContentTitle?: string | null;
  breakContentThumbnail?: string | null;
}

interface EnvironmentParticipantsProps {
  participants: ParticipantInfo[];
  onParticipantClick?: (participant: ParticipantInfo, rect: DOMRect) => void;
  onWidthChange?: (width: number) => void;
  /** Active camera stream for the current user — replaces their avatar when present */
  cameraStream?: MediaStream | null;
  /** Map of participant id → celebration info for active burst + status text */
  celebrations?: Map<string, { color: string; text: string }>;
}

/** Generate a consistent DiceBear avatar URL from a user ID or name. */
function fallbackAvatar(seed: string): string {
  return `https://api.dicebear.com/9.x/notionists-neutral/png?seed=${encodeURIComponent(seed)}&size=80`;
}

export const EnvironmentParticipants = memo(function EnvironmentParticipants({
  participants,
  onParticipantClick,
  onWidthChange,
  cameraStream,
  celebrations,
}: EnvironmentParticipantsProps) {
  const [expanded, setExpanded] = useState(false);
  const [itemsPerColumn, setItemsPerColumn] = useState(8);
  const containerRef = useRef<HTMLDivElement>(null);

  // Measure container height and compute how many avatars fit per column
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const availableHeight = el.clientHeight - 80 - 96; // pt-20, pb-24
      // Each item: 64px avatar + 4px gap-1 + ~16px name = ~84px
      // gap-y-4 = 16px between items → 100px per slot, last has no trailing gap
      const computed = Math.max(1, Math.floor((availableHeight + 16) / 100));
      setItemsPerColumn(computed);
      onWidthChange?.(el.getBoundingClientRect().width);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [onWidthChange]);

  // Reorder so current user is at top of column 2 (or right after host if single column)
  const orderedParticipants = useMemo(() => {
    const currentUserIdx = participants.findIndex((p) => p.isCurrentUser);
    if (currentUserIdx === -1) return participants;

    const currentUser = participants[currentUserIdx];
    const others = participants.filter((_, i) => i !== currentUserIdx);

    if (participants.length > itemsPerColumn) {
      // 2+ columns: host fills top of col 1, current user tops col 2
      const col1 = others.slice(0, itemsPerColumn);
      const afterCol1 = others.slice(itemsPerColumn);
      return [...col1, currentUser, ...afterCol1];
    }
    // Single column: current user right after host
    return [others[0], currentUser, ...others.slice(1)];
  }, [participants, itemsPerColumn]);

  const maxCollapsedSlots = itemsPerColumn * 2;
  const hasOverflow = !expanded && participants.length > maxCollapsedSlots;
  const isExpanded = expanded && participants.length > maxCollapsedSlots;

  const visibleParticipants = useMemo(() => {
    if (isExpanded || !hasOverflow) return orderedParticipants;
    return orderedParticipants.slice(0, maxCollapsedSlots - 1);
  }, [isExpanded, hasOverflow, orderedParticipants, maxCollapsedSlots]);

  const overflowCount = hasOverflow
    ? participants.length - (maxCollapsedSlots - 1)
    : 0;

  const handleExpand = useCallback(() => setExpanded(true), []);
  const handleCollapse = useCallback(() => setExpanded(false), []);

  if (participants.length === 0) return null;

  const badgeStyle = {
    background: "rgba(255, 255, 255, 0.10)",
    border: "2px solid rgba(255,255,255,0.12)",
    boxShadow: "var(--sg-shadow-dark-md)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
  };

  return (
    <div
      ref={containerRef}
      className={`pointer-events-none absolute left-0 top-0 z-10 flex h-full flex-col flex-wrap content-start items-center gap-x-3 gap-y-4 px-4 pb-24 pt-20 ${
        isExpanded ? "" : "overflow-hidden"
      }`}
    >
      {visibleParticipants.map((p) => (
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
              <CameraAvatar stream={cameraStream} celebrationColor={celebrations?.get(p.id)?.color} />
            ) : (
              <Image
                src={p.avatarUrl || fallbackAvatar(p.id || p.displayName)}
                alt={p.displayName}
                width={64}
                height={64}
                className="h-16 w-16 rounded-full object-cover transition-transform duration-150 hover:scale-105"
                style={{
                  border: "2px solid rgba(255,255,255,0.12)",
                  boxShadow: "var(--sg-shadow-dark-md)",
                  ...(celebrations?.has(p.id) && {
                    "--burst-color": celebrations.get(p.id)!.color,
                    animation: "fp-burst-glow 1.4s ease-out",
                  } as React.CSSProperties),
                }}
              />
            )}
            {/* Break badge */}
            {p.status === "on_break" && (
              <div
                className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full"
                style={{
                  background: "var(--sg-teal-600)",
                  border: "2px solid rgba(15,35,24,0.9)",
                  boxShadow: "var(--sg-shadow-sm)",
                }}
              >
                <Coffee size={10} strokeWidth={2.5} className="text-white" />
              </div>
            )}
            {celebrations?.has(p.id) && (
              <AvatarCelebration color={celebrations.get(p.id)!.color} />
            )}
            {celebrations?.get(p.id)?.text && (
              <div
                className="fp-status-text pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2"
                style={{ animation: "fp-status-float 2s ease-out forwards" }}
              >
                <span
                  className="block max-w-[120px] truncate whitespace-nowrap rounded-full px-2 py-0.5 text-center text-2xs font-medium leading-tight"
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.65)",
                    color: celebrations.get(p.id)!.color,
                    backdropFilter: "blur(4px)",
                    WebkitBackdropFilter: "blur(4px)",
                  }}
                >
                  {celebrations.get(p.id)!.text}
                </span>
              </div>
            )}
          </div>

          {/* Name */}
          <span className="max-w-[80px] truncate text-center text-xs font-medium text-white/70">
            {p.isHost ? "Host" : p.isCurrentUser ? "You" : p.username ? `@${p.username}` : p.displayName.split(" ")[0]}
          </span>
        </div>
      ))}

      {/* +X overflow badge */}
      {hasOverflow && (
        <div
          className="pointer-events-auto flex cursor-pointer flex-col items-center gap-1"
          onClick={handleExpand}
        >
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full transition-transform duration-150 hover:scale-105"
            style={badgeStyle}
          >
            <span className="text-sm font-semibold text-white/80">
              +{overflowCount}
            </span>
          </div>
          <span className="max-w-[80px] truncate text-center text-xs font-medium text-white/50">
            more
          </span>
        </div>
      )}

      {/* Collapse button */}
      {isExpanded && (
        <div
          className="pointer-events-auto flex cursor-pointer flex-col items-center gap-1"
          onClick={handleCollapse}
        >
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full transition-transform duration-150 hover:scale-105"
            style={badgeStyle}
          >
            <span className="text-base font-semibold text-white/80">
              &minus;
            </span>
          </div>
          <span className="max-w-[80px] truncate text-center text-xs font-medium text-white/50">
            less
          </span>
        </div>
      )}
    </div>
  );
});

/* ─── Live camera feed rendered as a circular avatar ───── */

function CameraAvatar({ stream, celebrationColor }: { stream: MediaStream; celebrationColor?: string }) {
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
        boxShadow: "var(--sg-shadow-dark-md)",
        transform: "scaleX(-1)",
        ...(celebrationColor && {
          "--burst-color": celebrationColor,
          animation: "fp-burst-glow 1.4s ease-out",
        } as React.CSSProperties),
      }}
    />
  );
}
