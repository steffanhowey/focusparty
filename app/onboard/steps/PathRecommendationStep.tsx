"use client";

import { useEffect, useState } from "react";
import { Clock, BookOpen, Loader2, Users } from "lucide-react";
import { fetchOnboardingPicks } from "@/lib/onboarding/picks";
import type {
  OnboardingPick,
  ProfessionalFunction,
  FluencyLevel,
} from "@/lib/onboarding/types";

interface PathRecommendationStepProps {
  primaryFunction: ProfessionalFunction;
  fluencyLevel: FluencyLevel;
  secondaryFunctions: ProfessionalFunction[];
  onStartPath: (pick: OnboardingPick) => void;
  onBrowse: () => void;
}

export default function PathRecommendationStep({
  primaryFunction,
  fluencyLevel,
  secondaryFunctions,
  onStartPath,
  onBrowse,
}: PathRecommendationStepProps) {
  const [hero, setHero] = useState<OnboardingPick | null>(null);
  const [also, setAlso] = useState<OnboardingPick[]>([]);
  const [loading, setLoading] = useState(true);
  // Stable synthetic social proof count (doesn't flicker on re-render)
  const [socialCount] = useState(() => Math.floor(Math.random() * 23 + 8));

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setLoading(true);
      const picks = await fetchOnboardingPicks(
        primaryFunction,
        fluencyLevel,
        secondaryFunctions
      );
      if (cancelled) return;
      setHero(picks.hero);
      setAlso(picks.also);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [primaryFunction, fluencyLevel, secondaryFunctions]);

  /** Swap an "also" pick into the hero slot. */
  function promoteToHero(pick: OnboardingPick): void {
    if (!hero) return;
    setAlso((prev) => [hero, ...prev.filter((p) => p.id !== pick.id)].slice(0, 2));
    setHero(pick);
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <Loader2
          size={28}
          className="animate-spin text-[var(--sg-shell-500)]"
        />
        <p className="text-sm text-[var(--sg-shell-600)]">
          Personalizing your first path...
        </p>
      </div>
    );
  }

  if (!hero) {
    // No editorial picks available — go straight to browse
    return (
      <>
        <h1 className="text-2xl font-semibold text-[var(--sg-shell-900)]">
          You&apos;re ready to explore
        </h1>
        <p className="mt-2 text-[var(--sg-shell-600)]">
          We&apos;re still curating paths for your profile. Browse what&apos;s
          available and dive in.
        </p>
        <button
          onClick={onBrowse}
          className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-full bg-[var(--sg-forest-500)] font-medium text-white transition-opacity hover:opacity-85 active:opacity-75"
        >
          Browse paths
        </button>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-[var(--sg-shell-900)]">
        Here&apos;s where you start
      </h1>
      <p className="mt-2 text-[var(--sg-shell-600)]">
        Based on your role and experience, we think this is the best first step.
      </p>

      {/* Hero path card */}
      <div className="mt-8 rounded-xl border border-[var(--sg-shell-border)] bg-[var(--sg-shell-100)] p-6">
        <h2 className="text-lg font-semibold text-[var(--sg-shell-900)]">
          {hero.display_title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--sg-shell-600)]">
          {hero.display_description}
        </p>

        <div className="mt-4 flex items-center gap-4 text-xs text-[var(--sg-shell-500)]">
          <span className="inline-flex items-center gap-1">
            <Clock size={13} strokeWidth={1.8} />
            {hero.time_estimate_min} min
          </span>
          <span className="inline-flex items-center gap-1">
            <BookOpen size={13} strokeWidth={1.8} />
            {hero.module_count} modules
          </span>
          <span className="inline-flex items-center gap-1">
            <Users size={13} strokeWidth={1.8} />
            {socialCount} learning now
          </span>
        </div>

        {hero.tool_names.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {hero.tool_names.map((tool) => (
              <span
                key={tool}
                className="rounded-full border border-[var(--sg-shell-border)] px-2.5 py-0.5 text-[11px] text-[var(--sg-shell-500)]"
              >
                {tool}
              </span>
            ))}
          </div>
        )}

        <button
          onClick={() => onStartPath(hero)}
          className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-[var(--sg-forest-500)] font-medium text-white transition-opacity hover:opacity-85 active:opacity-75"
        >
          Start learning
        </button>
      </div>

      {/* Also for you */}
      {also.length > 0 && (
        <div className="mt-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--sg-shell-500)]">
            Also for you
          </p>
          <div className="flex flex-col gap-2">
            {also.map((pick) => (
              <button
                key={pick.id}
                onClick={() => promoteToHero(pick)}
                className="flex items-center justify-between rounded-lg border border-[var(--sg-shell-border)] bg-[var(--sg-shell-100)] px-4 py-3 text-left transition-all hover:border-[var(--sg-forest-500)] hover:bg-[var(--sg-shell-200)]"
              >
                <span className="text-sm font-medium text-[var(--sg-shell-900)]">
                  {pick.display_title}
                </span>
                <span className="ml-3 shrink-0 text-xs text-[var(--sg-shell-500)]">
                  {pick.time_estimate_min} min
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Browse more */}
      <button
        onClick={onBrowse}
        className="mx-auto mt-5 block text-sm text-[var(--sg-shell-500)] underline decoration-[var(--sg-shell-border)] underline-offset-2 transition-colors hover:text-[var(--sg-shell-600)]"
      >
        Browse more paths
      </button>
    </>
  );
}
