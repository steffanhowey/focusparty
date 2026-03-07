"use client";

import Link from "next/link";

const OUTCOMES = ["Done", "Mostly", "Partial", "Stuck"] as const;

interface ReviewCardProps {
  goal: string;
  onAnotherRound: () => void;
  onTakeBreak: () => void;
  onOutcome?: (outcome: string) => void;
}

export function ReviewCard({
  goal,
  onAnotherRound,
  onTakeBreak,
  onOutcome,
}: ReviewCardProps) {
  return (
    <div
      className="absolute bottom-6 left-1/2 w-[calc(100%-2rem)] max-w-[420px] -translate-x-1/2 rounded-2xl border border-[var(--color-border-default)] p-4 md:p-6"
      style={{
        zIndex: 20,
        background: "rgba(13,14,32,0.35)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        textShadow: "0 1px 4px rgba(0,0,0,0.6)",
      }}
    >
      <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
        How&apos;d the{" "}
        {goal || "session"} go?
      </p>
      <div className="mb-5 flex flex-wrap gap-2">
        {OUTCOMES.map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => onOutcome?.(label)}
            className="rounded-full border border-[var(--color-border-default)] bg-white/[0.06] px-4 py-2 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent-primary)] hover:text-white"
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
