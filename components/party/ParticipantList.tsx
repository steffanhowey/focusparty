"use client";

import type { CharacterId } from "@/lib/types";
import { CHARACTERS } from "@/lib/constants";
import type { PartyParticipant } from "@/lib/parties";

interface ParticipantListProps {
  participants: PartyParticipant[];
  maxParticipants: number;
  creatorId: string;
  character: CharacterId;
}

export function ParticipantList({
  participants,
  maxParticipants,
  creatorId,
  character,
}: ParticipantListProps) {
  const c = CHARACTERS[character];
  const emptySlots = Math.max(0, maxParticipants - participants.length);

  return (
    <div className="space-y-2">
      {participants.map((p) => {
        const initial = p.display_name.charAt(0).toUpperCase();
        const isCreator = p.user_id === creatorId;
        return (
          <div
            key={p.id}
            className="flex items-center gap-3 rounded-md px-3 py-2"
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold"
              style={{
                borderColor: c.primary,
                color: c.primary,
                background: `${c.primary}15`,
              }}
            >
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-sm font-medium text-white">
                {p.display_name}
              </span>
              {isCreator && (
                <span
                  className="ml-2 rounded-full px-2 py-0.5 text-2xs font-semibold uppercase"
                  style={{ background: `${c.primary}25`, color: c.primary }}
                >
                  Host
                </span>
              )}
            </div>
          </div>
        );
      })}

      {Array.from({ length: emptySlots }).map((_, i) => (
        <div
          key={`empty-${i}`}
          className="flex items-center gap-3 rounded-md px-3 py-2"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--color-border-default)]">
            <span className="text-xs text-[var(--color-text-tertiary)]">?</span>
          </div>
          <span className="text-sm text-[var(--color-text-tertiary)]">
            Waiting&hellip;
          </span>
        </div>
      ))}
    </div>
  );
}
