"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { FlameIcon } from "@/components/ui/FlameIcon";
import { CHARACTERS } from "@/lib/constants";
import type { PartyWithCount } from "@/lib/parties";

interface PartyCardProps {
  party: PartyWithCount;
}

export function PartyCard({ party }: PartyCardProps) {
  const c = CHARACTERS[party.character];
  const isFull = party.participant_count >= party.max_participants;

  return (
    <Link href={`/party/${party.id}`} className="block">
      <Card
        variant="character"
        character={party.character}
        className={`cursor-pointer p-4 transition-all duration-150 hover:bg-[var(--color-bg-active)] ${isFull ? "opacity-60" : ""}`}
      >
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-white">
              {party.name}
            </h3>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
              {party.planned_duration_min}m &middot; {c.name}
            </p>
          </div>
          <FlameIcon character={party.character} size={22} />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-[var(--color-text-tertiary)]">
            {party.participant_count}/{party.max_participants} joined
          </span>
          {isFull ? (
            <span className="text-xs font-medium text-[var(--color-text-tertiary)]">
              Full
            </span>
          ) : (
            <span className="text-xs font-medium" style={{ color: c.primary }}>
              Waiting&hellip;
            </span>
          )}
        </div>
      </Card>
    </Link>
  );
}
