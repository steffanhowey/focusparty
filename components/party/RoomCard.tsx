"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { Users, Play } from "lucide-react";
import { Card } from "@/components/ui/Card";
import {
  getPartyLaunchDisplayName,
  getPartyLaunchShortDescription,
} from "@/lib/launchRooms";
import { getPartyRuntimeWorldKey, getWorldConfig } from "@/lib/worlds";
import type { PartyWithCount, SyntheticPresenceInfo } from "@/lib/parties";
import type { ActiveBackground } from "@/lib/roomBackgrounds";
import type { MusicStatus } from "@/lib/musicConstants";

interface RoomCardProps {
  party: PartyWithCount;
  backgrounds?: Map<string, ActiveBackground>;
  onClick?: () => void;
  isJoining?: boolean;
  tone?: "default" | "dark";
  badge?: ReactNode;
  descriptionOverride?: string;
  /** Whether this room's vibe is currently being previewed */
  isPreviewPlaying?: boolean;
  /** Preview player status (for loading state) */
  previewStatus?: MusicStatus;
  /** Called when user clicks the vibe check button */
  onTogglePreview?: () => void;
}

/* ── Tiny ambient avatar cluster with real images ── */
function AvatarCluster({
  participants,
  totalCount,
  overflowTextClassName = "text-shell-500",
}: {
  participants: SyntheticPresenceInfo[];
  totalCount: number;
  overflowTextClassName?: string;
}) {
  if (totalCount === 0) return null;
  const visible = participants.slice(0, 3);
  const overflow = totalCount - visible.length;
  const size = 20;
  const overlap = 6;

  return (
    <span className="flex shrink-0 items-center">
      <span className="flex">
        {visible.map((p, i) => (
          <img
            key={p.id}
            src={p.avatarUrl}
            alt={p.displayName}
            title={`@${p.handle}`}
            width={size}
            height={size}
            className="rounded-full object-cover"
            style={{
              width: size,
              height: size,
              marginLeft: i === 0 ? 0 : -overlap,
              border: "1.5px solid rgba(0,0,0,0.4)",
              zIndex: visible.length - i,
              position: "relative",
            }}
          />
        ))}
      </span>
      {overflow > 0 && (
        <span className={`ml-1 text-2xs ${overflowTextClassName}`}>
          +{overflow}
        </span>
      )}
    </span>
  );
}

/* ── CSS equalizer bars (pure CSS animation) ── */
function Equalizer() {
  return (
    <span className="flex items-end gap-[2px]" style={{ height: 12 }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-white"
          style={{
            animation: `fp-eq-bar 0.8s ease-in-out ${i * 0.15}s infinite alternate`,
          }}
        />
      ))}
    </span>
  );
}

export function RoomCard({
  party,
  backgrounds,
  onClick,
  isJoining,
  tone = "default",
  badge,
  descriptionOverride,
  isPreviewPlaying,
  previewStatus,
  onTogglePreview,
}: RoomCardProps) {
  const runtimeWorldKey = getPartyRuntimeWorldKey(party);
  const world = getWorldConfig(runtimeWorldKey);
  const aiBg = backgrounds?.get(runtimeWorldKey);
  const coverSrc = aiBg?.thumbUrl ?? null;
  const roomName = getPartyLaunchDisplayName(party);
  const roomDescription =
    descriptionOverride ?? getPartyLaunchShortDescription(party);
  const isFull = !party.persistent && party.participant_count >= party.max_participants;

  // Persistent rooms always show "Open"; others: active > waiting > full
  const status = party.persistent
    ? "active"
    : isFull
      ? "full"
      : party.status === "active"
        ? "active"
        : "waiting";

  // Status dot colors: active=forest-300, waiting=sg-gold-500, full=shell-400
  const statusConfig = {
    active: { dot: "var(--sg-forest-300)", label: party.persistent ? "Open" : "Active" },
    waiting: { dot: "var(--sg-gold-500)", label: "Waiting" },
    full: { dot: "var(--sg-shell-400)", label: "Full" },
  } as const;

  const s = statusConfig[status];

  const isPreviewLoading = previewStatus === "loading" && isPreviewPlaying;
  const titleTextClassName = tone === "dark" ? "text-white" : "text-shell-900";
  const bodyTextClassName = tone === "dark" ? "text-white/60" : "text-shell-500";
  const metaTextClassName = tone === "dark" ? "text-white/65" : "text-shell-600";
  const overflowTextClassName = tone === "dark" ? "text-white/55" : "text-shell-500";
  const imageCardShadowClassName =
    tone === "dark"
      ? "shadow-none"
      : "shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)]";

  const cardContent = party.persistent ? (
    <div
      className={`transition-all duration-150 ${
        isJoining ? "pointer-events-none opacity-70" : "cursor-pointer"
      }`}
    >
      {/* Image card */}
      <div
        className={`group/card relative h-[200px] w-full overflow-hidden rounded-md border transition-all duration-200 ${imageCardShadowClassName}`}
        style={{
          borderColor:
            tone === "dark"
              ? isPreviewPlaying
                ? `${world.accentColor}60`
                : "transparent"
              : isPreviewPlaying
                ? `${world.accentColor}60`
                : "var(--sg-shell-border)",
          boxShadow: isPreviewPlaying
            ? tone === "dark"
              ? `0 0 0 1px ${world.accentColor}30`
              : `0 0 0 1px ${world.accentColor}30, var(--shadow-sm)`
            : undefined,
        }}
      >
        {isJoining && (
          <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ background: "rgba(15,35,24,0.6)" }}>
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Entering...
            </div>
          </div>
        )}
        {coverSrc ? (
          <Image
            src={coverSrc}
            alt={roomName}
            fill
            sizes="(max-width: 640px) 100vw, 400px"
            className="object-cover"
          />
        ) : (
          <>
            <div
              className="absolute inset-0"
              style={{ background: world.placeholderGradient }}
            />
            {world.placeholderPattern && (
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: world.placeholderPattern,
                  backgroundSize: "16px 16px",
                }}
              />
            )}
          </>
        )}

        {badge ? (
          <div className="absolute left-3 top-3 z-10">
            {badge}
          </div>
        ) : null}

        {/* Vibe check overlay — visible on hover (desktop) or always (mobile/touch) */}
        {onTogglePreview && !isJoining && (
          <div
            className={`absolute inset-0 z-[5] flex items-center justify-center transition-opacity duration-200 ${
              isPreviewPlaying
                ? "opacity-100"
                : "opacity-0 group-hover/card:opacity-100 touch-device:opacity-100"
            }`}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePreview();
              }}
              className="flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 transition-all hover:scale-105 active:scale-100"
              style={{
                background: "rgba(15,35,24,0.55)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                boxShadow: "var(--shadow-float)",
              }}
              aria-label={isPreviewPlaying ? "Stop vibe check" : "Vibe check"}
            >
              <span className="flex h-4 w-4 items-center justify-center">
                {isPreviewLoading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : isPreviewPlaying ? (
                  <Equalizer />
                ) : (
                  <Play size={14} fill="white" className="text-white" />
                )}
              </span>
              <span className="text-xs font-medium text-white">Vibe Check</span>
            </button>
          </div>
        )}
      </div>

      {/* Text + avatars outside card */}
      <div className="flex items-center gap-2 px-1 pt-2">
        <div className="min-w-0 flex-1">
          <h3 className={`truncate text-sm font-semibold ${titleTextClassName}`}>
            {roomName}
          </h3>
          <p className={`mt-0.5 line-clamp-2 text-xs ${bodyTextClassName}`}>
            {roomDescription}
          </p>
        </div>
        <AvatarCluster
          participants={party.synthetic_participants}
          totalCount={party.participant_count}
          overflowTextClassName={overflowTextClassName}
        />
      </div>
    </div>
  ) : (
    <Card
      variant="default"
      className={`relative overflow-hidden transition-all duration-150 ${
        isJoining
          ? "pointer-events-none opacity-70"
          : isFull
            ? "cursor-default opacity-50"
            : "cursor-pointer hover:bg-shell-200"
      }`}
    >
      {isJoining && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md" style={{ background: "rgba(15,35,24,0.6)" }}>
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Entering...
          </div>
        </div>
      )}

      <div className="p-4">
        <div className="mb-3 flex items-center justify-end">
          <span className={`flex items-center gap-1.5 text-2xs ${bodyTextClassName}`}>
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: s.dot }}
            />
            {s.label}
          </span>
        </div>

        <h3 className={`truncate text-sm font-semibold ${titleTextClassName}`}>
          {roomName}
        </h3>

        <p className={`mt-0.5 line-clamp-2 text-xs ${bodyTextClassName}`}>
          {roomDescription}
        </p>

        <div className={`mt-3 flex items-center gap-3 text-xs ${metaTextClassName}`}>
          <span className="flex items-center gap-1">
            <Users size={12} strokeWidth={1.8} />
            {party.participant_count}/{party.max_participants}
          </span>
        </div>
      </div>
    </Card>
  );

  if (isFull) {
    return <div className="block">{cardContent}</div>;
  }

  return (
    <div className="block" onClick={onClick} role={onClick ? "button" : undefined}>
      {cardContent}
    </div>
  );
}
