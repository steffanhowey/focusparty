"use client";

import { FLUENCY_OPTIONS, type FluencyLevel } from "@/lib/onboarding/types";

interface FluencyStepProps {
  onSelect: (level: FluencyLevel, notSure?: boolean) => void;
}

export default function FluencyStep({ onSelect }: FluencyStepProps) {
  return (
    <>
      <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
        Where are you with AI right now?
      </h1>
      <p className="mt-2 text-[var(--color-text-secondary)]">
        No wrong answer — this helps us calibrate your first experience.
      </p>

      <div className="mt-8 flex flex-col gap-3">
        {FLUENCY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onSelect(opt.value)}
            className="group flex flex-col gap-1.5 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-hover)] px-5 py-4 text-left transition-all hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-bg-active)]"
          >
            <span className="text-sm font-semibold text-[var(--color-text-primary)] transition-colors group-hover:text-[var(--color-accent-primary)]">
              {opt.label}
            </span>
            <span className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
              {opt.anchor}
            </span>
          </button>
        ))}
      </div>

      <button
        onClick={() => onSelect("practicing", true)}
        className="mx-auto mt-5 block text-xs text-[var(--color-text-tertiary)] underline decoration-[var(--color-border-default)] underline-offset-2 transition-colors hover:text-[var(--color-text-secondary)]"
      >
        I&apos;m not sure — just get me started
      </button>
    </>
  );
}
