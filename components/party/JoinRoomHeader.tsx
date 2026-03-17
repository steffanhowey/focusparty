"use client";

import Image from "next/image";
import type { Party, SyntheticPresenceInfo } from "@/lib/parties";
import type { WorldConfig } from "@/lib/worlds";

function formatMinutes(seconds: number): string {
  const m = Math.ceil(seconds / 60);
  return `${m}m`;
}

interface JoinRoomHeaderProps {
  party: Party | null;
  world: WorldConfig;
  coverSrc: string | null;
  focusingCount: number;
  hasActiveSprint: boolean;
  remainingSeconds: number;
  syntheticParticipants: SyntheticPresenceInfo[];
}

/* ── Avatar cluster — matches FeaturedRoom style ── */

function AvatarCluster({
  participants,
  totalCount,
}: {
  participants: SyntheticPresenceInfo[];
  totalCount: number;
}) {
  if (totalCount === 0) return null;
  const visible = participants.slice(0, 4);
  const overflow = totalCount - visible.length;
  const size = 26;
  const overlap = 7;

  return (
    <span className="flex items-center">
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
              border: "2px solid rgba(0,0,0,0.3)",
              zIndex: visible.length - i,
              position: "relative",
            }}
          />
        ))}
      </span>
      {overflow > 0 && (
        <span className="ml-1.5 text-2xs text-white/50">
          +{overflow}
        </span>
      )}
    </span>
  );
}

export function JoinRoomHeader({
  party,
  world,
  coverSrc,
  focusingCount,
  hasActiveSprint,
  remainingSeconds,
  syntheticParticipants,
}: JoinRoomHeaderProps) {
  return (
    <div className="flex gap-4 p-6 pb-0">
      {/* Cover image */}
      <div className="relative h-[110px] w-[150px] shrink-0 overflow-hidden rounded-md">
        {coverSrc ? (
          <Image
            src={coverSrc}
            alt={world.label}
            fill
            sizes="150px"
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
      </div>

      {/* Room info */}
      <div className="min-w-0 flex-1 py-0.5">
        <h2
          className="truncate text-lg font-bold text-white"
        >
          {party?.name ?? world.label}
        </h2>

        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-white/40">
          {world.description}
        </p>

        {/* Meta line */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-2xs text-white/50">
          {focusingCount > 0 && (
            <span>{focusingCount} focusing</span>
          )}
          {focusingCount > 0 && hasActiveSprint && (
            <span className="text-white/20">·</span>
          )}
          {hasActiveSprint && (
            <span>{formatMinutes(remainingSeconds)} left</span>
          )}
        </div>

        {/* Avatars */}
        {syntheticParticipants.length > 0 && (
          <div className="mt-2.5">
            <AvatarCluster
              participants={syntheticParticipants}
              totalCount={syntheticParticipants.length}
            />
          </div>
        )}
      </div>
    </div>
  );
}
