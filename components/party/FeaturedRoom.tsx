"use client";

import Image from "next/image";
import { Play, Pause } from "lucide-react";
import { getWorldConfig } from "@/lib/worlds";
import type { PartyWithCount, SyntheticPresenceInfo } from "@/lib/parties";
import type { ActiveBackground } from "@/lib/roomBackgrounds";
import type { MusicStatus } from "@/lib/musicConstants";

interface FeaturedRoomProps {
  party: PartyWithCount;
  backgrounds?: Map<string, ActiveBackground>;
  onClick?: () => void;
  /** Whether this room's vibe is currently being previewed */
  isPreviewPlaying?: boolean;
  /** Preview player status (for loading state) */
  previewStatus?: MusicStatus;
  /** Called when user clicks the vibe check button */
  onTogglePreview?: () => void;
}

/* ── CSS equalizer bars ── */
function Equalizer() {
  return (
    <span className="flex items-end gap-[2px]" style={{ height: 14 }}>
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

export function FeaturedRoom({
  party,
  backgrounds,
  onClick,
  isPreviewPlaying,
  previewStatus,
  onTogglePreview,
}: FeaturedRoomProps) {
  const world = getWorldConfig(party.world_key);
  const aiBg = backgrounds?.get(party.world_key);
  const coverSrc = aiBg?.publicUrl ?? null;
  const isPreviewLoading = previewStatus === "loading" && isPreviewPlaying;

  return (
    <div
      className="group/featured relative w-full overflow-hidden rounded-md border border-shell-border cursor-pointer"
      style={{ height: "clamp(340px, 50vh, 500px)" }}
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
      <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 rounded-full bg-sg-coral-500 px-2.5 py-1">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
        <span className="text-2xs font-semibold text-white">Most Active</span>
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
            <span className="inline-flex items-center rounded-full bg-sg-coral-500 px-5 py-2 text-sm font-bold uppercase tracking-wide text-white transition-all duration-150 group-hover/featured:brightness-110 active:scale-95">
              Join
            </span>

            {/* Vibe Check button */}
            {onTogglePreview && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePreview();
                }}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white transition-all hover:scale-105 active:scale-100"
                style={{
                  background: "rgba(255,255,255,0.12)",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
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
                <span>Vibe Check</span>
              </button>
            )}

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
