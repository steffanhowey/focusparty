"use client";

/**
 * Main skill profile page.
 * Shows summary stats, fluency distribution, and domain sections.
 */

import { Loader2, BookOpen, TrendingUp, Layers, Compass } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatsCard } from "@/components/progress/StatsCard";
import { useSkillProfile } from "@/lib/useSkillProfile";
import { useSkillMarketState } from "@/lib/useSkillMarketState";
import { SkillDomainSection } from "./SkillDomainSection";
import type { SkillFluency } from "@/lib/types/skills";

// ─── Fluency distribution bar ────────────────────────────────

const FLUENCY_BAR_SEGMENTS: {
  key: keyof Pick<
    ReturnType<typeof useSkillProfile>["summary"] & object,
    "skills_at_exploring" | "skills_at_practicing" | "skills_at_proficient" | "skills_at_advanced"
  >;
  level: SkillFluency;
  label: string;
  color: string;
}[] = [
  { key: "skills_at_advanced", level: "advanced", label: "Advanced", color: "var(--color-violet-700)" },
  { key: "skills_at_proficient", level: "proficient", label: "Proficient", color: "var(--color-green-700)" },
  { key: "skills_at_practicing", level: "practicing", label: "Practicing", color: "var(--color-cyan-700)" },
  { key: "skills_at_exploring", level: "exploring", label: "Exploring", color: "var(--color-text-tertiary)" },
];

// ─── Component ───────────────────────────────────────────────

export function SkillProfilePage() {
  const { domains, summary, isLoading, error } = useSkillProfile();
  const { states: marketStates } = useSkillMarketState();

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2
          size={24}
          className="animate-spin text-[var(--color-text-tertiary)]"
        />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-2">
        <p className="text-sm text-[var(--color-text-tertiary)]">
          Failed to load skill profile.
        </p>
      </div>
    );
  }

  // Empty state — no skills started yet
  if (!summary || summary.total_skills_started === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: "var(--color-bg-hover)" }}
        >
          <Compass
            size={24}
            className="text-[var(--color-text-tertiary)]"
          />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Your skill profile starts here
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-tertiary)] max-w-sm">
            Complete learning paths to develop verified AI skills and build your professional skill portfolio.
          </p>
        </div>
        <a href="/learn">
          <Button variant="primary" size="default" leftIcon={<BookOpen size={16} />}>
            Browse Paths
          </Button>
        </a>
      </div>
    );
  }

  const totalStarted = summary.total_skills_started;
  const practicingPlus =
    summary.skills_at_practicing +
    summary.skills_at_proficient +
    summary.skills_at_advanced;
  const activeDomains = domains.filter((d) => d.active_count > 0).length;

  return (
    <div className="space-y-6">
      {/* Subtitle */}
      <p className="text-sm text-[var(--color-text-tertiary)]">
        Your AI skill portfolio
      </p>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatsCard
          label="Skills"
          value={totalStarted}
          sublabel={`of ${summary.total_skills_available}`}
          icon={<Layers size={18} />}
        />
        <StatsCard
          label="Paths Completed"
          value={summary.total_paths_completed}
          icon={<BookOpen size={18} />}
        />
        <StatsCard
          label="Practicing+"
          value={practicingPlus}
          sublabel={practicingPlus > 0 ? "beyond exploring" : undefined}
          icon={<TrendingUp size={18} />}
        />
        <StatsCard
          label="Domains"
          value={activeDomains}
          sublabel={`of ${domains.length}`}
          icon={<Compass size={18} />}
        />
      </div>

      {/* Fluency distribution bar — only if 2+ skills */}
      {totalStarted >= 2 && (
        <div className="space-y-2">
          {/* Stacked bar */}
          <div
            className="flex h-3 w-full overflow-hidden rounded-full"
            style={{ background: "var(--color-bg-hover)" }}
          >
            {FLUENCY_BAR_SEGMENTS.map(({ key, color }) => {
              const count = summary[key];
              if (count === 0) return null;
              const pct = (count / totalStarted) * 100;
              return (
                <div
                  key={key}
                  className="h-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: color }}
                />
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {FLUENCY_BAR_SEGMENTS.map(({ key, label, color }) => {
              const count = summary[key];
              if (count === 0) return null;
              return (
                <div key={key} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: color }}
                  />
                  <span className="text-xs text-[var(--color-text-tertiary)]">
                    {label} ({count})
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Domain sections */}
      <div className="divide-y divide-[var(--color-border-default)]">
        {domains.map((domain, i) => (
          <SkillDomainSection
            key={domain.domain.slug}
            domain={domain}
            index={i}
            marketStates={marketStates}
          />
        ))}
      </div>
    </div>
  );
}
