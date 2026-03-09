"use client";

import { Card } from "@/components/ui/Card";
import { CHARACTERS } from "@/lib/constants";
import { FlameIcon } from "@/components/ui/FlameIcon";
import type { FavoritePartyStat, CharacterId } from "@/lib/types";

interface FavoritePartiesCardProps {
  parties: FavoritePartyStat[];
}

export function FavoritePartiesCard({ parties }: FavoritePartiesCardProps) {
  if (parties.length === 0) {
    return (
      <Card variant="default" className="p-5">
        <p className="text-center text-sm text-[var(--color-text-tertiary)]">
          Join a party and complete a session to see your favorites
        </p>
      </Card>
    );
  }

  return (
    <Card variant="default" className="p-4">
      <div className="space-y-3">
        {parties.map((p) => {
          const charId = (p.character as CharacterId) ?? "ember";
          const charDef = CHARACTERS[charId] ?? CHARACTERS.ember;

          return (
            <div
              key={p.partyId}
              className="flex items-center gap-3 rounded-[var(--radius-md)] px-2 py-1.5"
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{ background: `${charDef.primary}20` }}
              >
                <FlameIcon character={charId} size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {p.partyName}
                </p>
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  {p.sessionCount} session{p.sessionCount !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
