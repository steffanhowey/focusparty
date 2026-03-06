"use client";

import type { CharacterId } from "@/lib/types";
import { CHARACTERS } from "@/lib/constants";
import Link from "next/link";

const OUTCOMES = ["Done", "Mostly", "Partial", "Stuck"] as const;

interface ReviewCardProps {
  character: CharacterId;
  goal: string;
  onAnotherRound: () => void;
  onTakeBreak: () => void;
  onOutcome?: (outcome: string) => void;
}

export function ReviewCard({
  character,
  goal,
  onAnotherRound,
  onTakeBreak,
  onOutcome,
}: ReviewCardProps) {
  const c = CHARACTERS[character];

  return (
    <div
      className="absolute bottom-6 left-1/2 w-[calc(100%-2rem)] max-w-[420px] -translate-x-1/2 rounded-2xl border border-[var(--color-border-default)] p-4 backdrop-blur-xl md:p-6"
      style={{
        background: "rgba(13,14,32,0.92)",
        zIndex: 20,
      }}
    >
      <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
        <span style={{ color: c.primary }}>{c.name}:</span> How&apos;d the{" "}
        {goal || "session"} go?
      </p>
      <div className="mb-5 flex flex-wrap gap-2">
        {OUTCOMES.map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => onOutcome?.(label)}
            className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-4 py-2 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent-primary)] hover:text-white"
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onAnotherRound}
          className="rounded-lg bg-[var(--color-accent-primary)] py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Another round
        </button>
        <button
          type="button"
          onClick={onTakeBreak}
          className="rounded-lg border border-[var(--color-border-default)] py-3 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-white/5"
        >
          Take a break
        </button>
        <Link
          href="/party"
          className="rounded-lg py-3 text-center text-sm text-[var(--color-text-tertiary)] transition-colors hover:text-white"
        >
          Call it a day
        </Link>
      </div>
    </div>
  );
}
