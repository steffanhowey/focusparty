"use client";

import Link from "next/link";
import { Users, Clock, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { getWorldConfig } from "@/lib/worlds";
import { getHostConfig } from "@/lib/hosts";
import { getPartyHostPersonality } from "@/lib/worlds";
import type { PartyWithCount } from "@/lib/parties";

interface RoomCardProps {
  party: PartyWithCount;
}

export function RoomCard({ party }: RoomCardProps) {
  const world = getWorldConfig(party.world_key);
  const hostConfig = getHostConfig(getPartyHostPersonality(party));
  const isFull = party.participant_count >= party.max_participants;

  // Status: active > waiting > full
  const status = isFull
    ? "full"
    : party.status === "active"
      ? "active"
      : "waiting";

  const statusConfig = {
    active: { dot: "#10B981", label: "Active" },
    waiting: { dot: "#F59E0B", label: "Waiting" },
    full: { dot: "#6B7280", label: "Full" },
  } as const;

  const s = statusConfig[status];

  const cardContent = (
    <Card
      variant="default"
      className={`p-4 transition-all duration-150 ${
        isFull
          ? "cursor-default opacity-50"
          : "cursor-pointer hover:bg-[var(--color-bg-active)]"
      }`}
    >
      {/* Top row: world pill + status dot */}
      <div className="mb-3 flex items-center justify-between">
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{
            color: world.accentColor,
            background: `${world.accentColor}18`,
          }}
        >
          {world.label}
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-tertiary)]">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: s.dot }}
          />
          {s.label}
        </span>
      </div>

      {/* Party name */}
      <h3 className="truncate text-sm font-semibold text-white">
        {party.name}
      </h3>

      {/* World description */}
      <p className="mt-0.5 line-clamp-1 text-xs text-[var(--color-text-tertiary)]">
        {world.description}
      </p>

      {/* Meta row */}
      <div className="mt-3 flex items-center gap-3 text-xs text-[var(--color-text-secondary)]">
        <span className="flex items-center gap-1">
          <Sparkles size={12} strokeWidth={1.8} style={{ color: world.accentColor }} />
          {hostConfig.hostName}
        </span>
        <span className="flex items-center gap-1">
          <Clock size={12} strokeWidth={1.8} />
          {party.planned_duration_min}m
        </span>
        <span className="flex items-center gap-1">
          <Users size={12} strokeWidth={1.8} />
          {party.participant_count}/{party.max_participants}
        </span>
      </div>
    </Card>
  );

  if (isFull) {
    return <div className="block">{cardContent}</div>;
  }

  return (
    <Link href={`/party/${party.id}`} className="block">
      {cardContent}
    </Link>
  );
}
