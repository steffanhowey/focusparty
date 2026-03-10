"use client";

import Image from "next/image";
import { Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { getWorldConfig } from "@/lib/worlds";
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
  const coverSrc = aiBg?.thumbUrl ?? null;
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

  const cardContent = party.persistent ? (
    <div
      className={`transition-all duration-150 ${
        isJoining ? "pointer-events-none opacity-70" : "cursor-pointer"
      }`}
    >
      {/* Image card */}
      <div className="relative h-[200px] w-full overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border-default)] shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]">
        {isJoining && (
          <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ background: "rgba(10,10,10,0.6)" }}>
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Entering...
            </div>
          </div>
        )}
        {coverSrc ? (
          <Image
            src={coverSrc}
            alt={world.label}
            fill
            sizes="(max-width: 640px) 100vw, 400px"
            className="object-cover"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: world.placeholderGradient }}
          />
        )}
      </div>

      {/* Text + avatars outside card */}
      <div className="flex items-center gap-2 px-1 pt-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-white">
            {party.name}
          </h3>
          <p className="mt-0.5 line-clamp-1 text-xs text-[var(--color-text-tertiary)]">
            {world.description}
          </p>
        </div>
        <AvatarCluster
          participants={party.synthetic_participants}
          totalCount={party.participant_count}
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
            : "cursor-pointer hover:bg-[var(--color-bg-active)]"
      }`}
    >
      {isJoining && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[var(--radius-md)]" style={{ background: "rgba(10,10,10,0.6)" }}>
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Entering...
          </div>
        </div>
      )}

      <div className="p-4">
        <div className="mb-3 flex items-center justify-end">
          <span className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-tertiary)]">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: s.dot }}
            />
            {s.label}
          </span>
        </div>

        <h3 className="truncate text-sm font-semibold text-white">
          {party.name}
        </h3>

        <p className="mt-0.5 line-clamp-1 text-xs text-[var(--color-text-tertiary)]">
          {world.description}
        </p>

        <div className="mt-3 flex items-center gap-3 text-xs text-[var(--color-text-secondary)]">
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
