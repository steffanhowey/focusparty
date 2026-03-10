"use client";

import Image from "next/image";
import { getWorldConfig } from "@/lib/worlds";
import type { PartyWithCount, SyntheticPresenceInfo } from "@/lib/parties";
import type { ActiveBackground } from "@/lib/roomBackgrounds";

interface FeaturedRoomProps {
  party: PartyWithCount;
  backgrounds?: Map<string, ActiveBackground>;
  onClick?: () => void;
}

function FeaturedAvatars({
  participants,
  totalCount,
}: {
  participants: SyntheticPresenceInfo[];
  totalCount: number;
}) {
  if (totalCount === 0) return null;
  const visible = participants.slice(0, 3);
  const overflow = totalCount - visible.length;
  const size = 28;
  const overlap = 8;

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
        <span className="ml-1.5 text-xs text-white/70">
          +{overflow}
        </span>
      )}
    </span>
  );
}

export function FeaturedRoom({ party, backgrounds, onClick }: FeaturedRoomProps) {
  const world = getWorldConfig(party.world_key);
  const aiBg = backgrounds?.get(party.world_key);
  const coverSrc = aiBg?.publicUrl ?? null;

  return (
    <div
      className="relative w-full overflow-hidden rounded-[var(--radius-md)] cursor-pointer"
      style={{ height: "clamp(300px, 40vh, 440px)" }}
      onClick={onClick}
      role="button"
    >
      {/* Background image */}
      {coverSrc ? (
        <Image
          src={coverSrc}
          alt={world.label}
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: world.placeholderGradient }}
        />
      )}

      {/* Gradient overlay for text readability */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.3) 40%, transparent 70%)",
        }}
      />

      {/* Most Active badge — top-left */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 rounded-full bg-[var(--color-accent-error)] px-2.5 py-1">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
        <span className="text-[11px] font-semibold text-white">Most Active</span>
      </div>

      {/* Content overlay */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-6 md:p-8">
        <div className="min-w-0 flex-1">
          <h2 className="text-3xl font-bold text-white md:text-4xl">
            {party.name}
          </h2>
          <p className="mt-2 line-clamp-2 text-base text-white/70 md:text-lg">
            {world.description}
          </p>
          <div className="mt-4 flex items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-[var(--color-accent-error)] px-5 py-2 text-sm font-bold uppercase tracking-wide text-white">
              Join
            </span>
            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1.5 backdrop-blur-sm">
              <FeaturedAvatars
                participants={party.synthetic_participants}
                totalCount={party.participant_count}
              />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
