"use client";

import { CHARACTERS } from "@/lib/constants";
import { PARTICIPANT_STATUS_CONFIG, phaseToStatus } from "@/lib/presence";
import { Button } from "@/components/ui/Button";
import type { SessionRow, CharacterId } from "@/lib/types";

interface ResumeSessionCardProps {
  session: SessionRow;
  onResume: () => void;
  onAbandon: () => void;
}

export function ResumeSessionCard({
  session,
  onResume,
  onAbandon,
}: ResumeSessionCardProps) {
  const character = (session.character as CharacterId) ?? "ember";
  const charDef = CHARACTERS[character];
  const status = phaseToStatus(session.phase);
  const statusCfg = PARTICIPANT_STATUS_CONFIG[status];

  const goalText = session.goal_text
    ? session.goal_text.length > 60
      ? session.goal_text.slice(0, 57) + "..."
      : session.goal_text
    : null;

  return (
    <div
      className="relative overflow-hidden rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]"
    >
      {/* Character-colored left stripe */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: charDef.primary }}
      />

      <div className="p-4 pl-5">
        <div className="mb-2 flex items-center gap-2">
          <p className="text-sm font-medium text-white">
            Active session in progress
          </p>
          <span
            className="rounded-full px-2 py-0.5 text-2xs font-semibold uppercase"
            style={{
              background: `${statusCfg.color}20`,
              color: statusCfg.color,
            }}
          >
            {statusCfg.label}
          </span>
        </div>

        {goalText && (
          <p className="mb-3 text-sm text-[var(--color-text-secondary)]">
            {goalText}
          </p>
        )}

        <div className="flex gap-2">
          <Button variant="primary" size="sm" onClick={onResume}>
            Resume Session
          </Button>
          <Button variant="ghost" size="sm" onClick={onAbandon}>
            Start Fresh
          </Button>
        </div>
      </div>
    </div>
  );
}
