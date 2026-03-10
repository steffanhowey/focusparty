"use client";

import Image from "next/image";
import type { Party, SyntheticPresenceInfo } from "@/lib/parties";
import type { WorldConfig } from "@/lib/worlds";
import type { HostConfig } from "@/lib/hosts";

function formatMinutes(seconds: number): string {
  const m = Math.ceil(seconds / 60);
  return `${m}m`;
}

interface JoinRoomHeaderProps {
  party: Party | null;
  world: WorldConfig;
  hostConfig: HostConfig;
  coverSrc: string | null;
  focusingCount: number;
  hasActiveSprint: boolean;
  remainingSeconds: number;
  syntheticParticipants: SyntheticPresenceInfo[];
}

export function JoinRoomHeader({
  party,
  world,
  hostConfig,
  coverSrc,
  focusingCount,
  hasActiveSprint,
  remainingSeconds,
  syntheticParticipants,
}: JoinRoomHeaderProps) {
  const visibleSynthAvatars = syntheticParticipants.slice(0, 4);
  const synthOverflow = syntheticParticipants.length - visibleSynthAvatars.length;

  return (
    <div className="flex gap-4 p-5 pb-0">
      {/* Cover image */}
      <div className="relative h-[100px] w-[140px] shrink-0 overflow-hidden rounded-[var(--radius-md)]">
        {coverSrc ? (
          <Image
            src={coverSrc}
            alt={world.label}
            fill
            sizes="140px"
            className="object-cover"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: world.placeholderGradient }}
          />
        )}
      </div>

      {/* Room info */}
      <div className="min-w-0 flex-1 pt-0.5">
        <h2
          className="truncate text-xl font-bold text-white"
          style={{ fontFamily: "var(--font-montserrat), sans-serif" }}
        >
          {party?.name ?? world.label}
        </h2>

        {/* Meta line */}
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-white/50">
          <Image
            src={hostConfig.avatarUrl}
            alt={hostConfig.hostName}
            width={16}
            height={16}
            className="rounded-full"
          />
          <span>{hostConfig.hostName} hosting</span>
          {focusingCount > 0 && (
            <>
              <span className="text-white/25">&middot;</span>
              <span>{focusingCount} focusing now</span>
            </>
          )}
          {hasActiveSprint && (
            <>
              <span className="text-white/25">&middot;</span>
              <span>{formatMinutes(remainingSeconds)} remaining</span>
            </>
          )}
        </div>

        {/* Avatars */}
        {visibleSynthAvatars.length > 0 && (
          <div className="mt-2 flex items-center">
            <span className="flex">
              {visibleSynthAvatars.map((p, i) => (
                <img
                  key={p.id}
                  src={p.avatarUrl}
                  alt={p.displayName}
                  width={22}
                  height={22}
                  className="rounded-full object-cover"
                  style={{
                    width: 22,
                    height: 22,
                    marginLeft: i === 0 ? 0 : -5,
                    border: "1.5px solid rgba(10,10,10,0.9)",
                    zIndex: visibleSynthAvatars.length - i,
                    position: "relative",
                  }}
                />
              ))}
            </span>
            {synthOverflow > 0 && (
              <span className="ml-1.5 text-[11px] text-white/40">
                +{synthOverflow}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
