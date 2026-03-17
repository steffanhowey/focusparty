"use client";

import { FLUENCY_OPTIONS, type FluencyLevel } from "@/lib/onboarding/types";

interface FluencyStepProps {
  onSelect: (level: FluencyLevel, notSure?: boolean) => void;
}

export default function FluencyStep({ onSelect }: FluencyStepProps) {
  return (
    <>
      <h1 className="text-2xl font-semibold text-[var(--sg-shell-900)]">
        Where are you with AI right now?
      </h1>
      <p className="mt-2 text-[var(--sg-shell-600)]">
        No wrong answer — this helps us calibrate your first experience.
      </p>

      <div className="mt-8 flex flex-col gap-3">
        {FLUENCY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onSelect(opt.value)}
            className="group flex flex-col gap-1.5 rounded-xl border border-[var(--sg-shell-border)] bg-[var(--sg-shell-100)] px-5 py-4 text-left transition-all hover:border-[var(--sg-forest-500)] hover:bg-[var(--sg-shell-200)]"
          >
            <span className="text-sm font-semibold text-[var(--sg-shell-900)] transition-colors group-hover:text-[var(--sg-forest-500)]">
              {opt.label}
            </span>
            <span className="text-sm leading-relaxed text-[var(--sg-shell-600)]">
              {opt.anchor}
            </span>
          </button>
        ))}
      </div>

      <button
        onClick={() => onSelect("practicing", true)}
        className="mx-auto mt-5 block text-xs text-[var(--sg-shell-500)] underline decoration-[var(--sg-shell-border)] underline-offset-2 transition-colors hover:text-[var(--sg-shell-600)]"
      >
        I&apos;m not sure — just get me started
      </button>
    </>
  );
}
