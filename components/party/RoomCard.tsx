"use client";

import Image from "next/image";
import { Clock, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { getWorldConfig } from "@/lib/worlds";
import { getHostConfig } from "@/lib/hosts";
import { getPartyHostPersonality } from "@/lib/worlds";
import type { PartyWithCount, SyntheticPresenceInfo } from "@/lib/parties";
import type { ActiveBackground } from "@/lib/roomBackgrounds";

interface RoomCardProps {
  party: PartyWithCount;
  backgrounds?: Map<string, ActiveBackground>;
  onClick?: () => void;
  isJoining?: boolean;
}

/* ── Tiny ambient avatar cluster with real images ── */
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
  const size = 20;
  const overlap = 6;

  return (
    <span className="ml-auto flex items-center">
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
              border: "1.5px solid var(--color-bg-secondary)",
              zIndex: visible.length - i,
              position: "relative",
            }}
          />
        ))}
      </span>
      {overflow > 0 && (
        <span className="ml-1 text-[10px] text-[var(--color-text-tertiary)]">
          +{overflow}
        </span>
      )}
    </span>
  );
}

export function RoomCard({ party, backgrounds, onClick, isJoining }: RoomCardProps) {
  const world = getWorldConfig(party.world_key);
  const aiBg = backgrounds?.get(party.world_key);
  const coverSrc = aiBg?.thumbUrl ?? world.coverImage;
  const hostConfig = getHostConfig(getPartyHostPersonality(party));
  const isFull = !party.persistent && party.participant_count >= party.max_participants;

  // Persistent rooms always show "Open"; others: active > waiting > full
  const status = party.persistent
    ? "active"
    : isFull
      ? "full"
      : party.status === "active"
        ? "active"
        : "waiting";

  const statusConfig = {
    active: { dot: "#10B981", label: party.persistent ? "Open" : "Active" },
    waiting: { dot: "#F59E0B", label: "Waiting" },
    full: { dot: "#6B7280", label: "Full" },
  } as const;

  const s = statusConfig[status];

  const cardContent = (
    <Card
      variant="default"
      className={`relative overflow-hidden transition-all duration-150 ${
        isJoining
          ? "pointer-events-none opacity-70"
          : isFull
            ? "cursor-default opacity-50"
            : "cursor-pointer hover:bg-[var(--color-bg-active)]"
      }`}
    >
      {isJoining && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[var(--radius-md)]" style={{ background: "rgba(13,14,32,0.6)" }}>
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Entering...
          </div>
        </div>
      )}

      {/* Cover image — persistent rooms only */}
      {party.persistent && (
        <div className="relative h-[120px] w-full">
          <Image
            src={coverSrc}
            alt={world.label}
            fill
            sizes="(max-width: 640px) 100vw, 400px"
            className="object-cover"
          />
          {/* Gradient fade to card bg */}
          <div
            className="absolute inset-x-0 bottom-0 h-10"
            style={{
              background:
                "linear-gradient(to top, var(--color-bg-secondary), transparent)",
            }}
          />
        </div>
      )}

      {/* Card content */}
      <div className="p-4">
        {/* Status (non-persistent only) */}
        {!party.persistent && (
          <div className="mb-3 flex items-center justify-end">
            <span className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-tertiary)]">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: s.dot }}
              />
              {s.label}
            </span>
          </div>
        )}

        {/* Party name + duration */}
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-white">
            {party.name}
          </h3>
          <span className="ml-auto flex shrink-0 items-center gap-1 text-xs text-[var(--color-text-tertiary)]">
            <Clock size={12} strokeWidth={1.8} />
            {party.planned_duration_min}m
          </span>
        </div>

        {/* World description */}
        <p className="mt-0.5 line-clamp-1 text-xs text-[var(--color-text-tertiary)]">
          {world.description}
        </p>

        {/* Meta row */}
        <div className="mt-3 flex items-center gap-3 text-xs text-[var(--color-text-secondary)]">
          <span className="flex items-center gap-1.5">
            <Image
              src={hostConfig.avatarUrl}
              alt={hostConfig.hostName}
              width={16}
              height={16}
              className="rounded-full"
            />
            {hostConfig.hostName}
          </span>
          {party.persistent ? (
            <AvatarCluster
              participants={party.synthetic_participants}
              totalCount={party.participant_count}
            />
          ) : (
            <span className="flex items-center gap-1">
              <Users size={12} strokeWidth={1.8} />
              {party.participant_count}/{party.max_participants}
            </span>
          )}
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
