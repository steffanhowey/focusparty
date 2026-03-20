"use client";

/**
 * Main skill profile page.
 * Shows summary stats, fluency distribution, and domain sections.
 */

import Link from "next/link";
import { Loader2, BookOpen, TrendingUp, Layers, Compass } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatsCard } from "@/components/progress/StatsCard";
import { useSkillProfile } from "@/lib/useSkillProfile";
import { useSkillMarketState } from "@/lib/useSkillMarketState";
import { SkillDomainSection } from "./SkillDomainSection";
import { GapSummary } from "./GapSummary";
import { AchievementHistory } from "./AchievementHistory";
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
  { key: "skills_at_advanced", level: "advanced", label: "Advanced", color: "var(--sg-gold-600)" },
  { key: "skills_at_proficient", level: "proficient", label: "Proficient", color: "var(--sg-forest-400)" },
  { key: "skills_at_practicing", level: "practicing", label: "Practicing", color: "var(--sg-teal-500)" },
  { key: "skills_at_exploring", level: "exploring", label: "Exploring", color: "var(--sg-sage-500)" },
];

// ─── Component ───────────────────────────────────────────────

interface SkillProfilePageProps {
  showSubtitle?: boolean;
  showAchievementHistory?: boolean;
  showGapSummary?: boolean;
  showDomainSections?: boolean;
}

export function SkillProfilePage({
  showSubtitle = true,
  showAchievementHistory = true,
  showGapSummary = true,
  showDomainSections = true,
}: SkillProfilePageProps) {
  const { domains, summary, gaps, achievements, isLoading, error } = useSkillProfile();
  const { states: marketStates } = useSkillMarketState();

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2
          size={24}
          className="animate-spin text-[var(--sg-shell-400)]"
        />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-2">
        <p className="text-sm text-[var(--sg-shell-500)]">
          Failed to load skill profile.
        </p>
      </div>
    );
  }

  // Empty state — no skills started yet
  if (!summary || summary.total_skills_started === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--sg-shell-100)]">
          <Compass
            size={24}
            className="text-[var(--sg-shell-500)]"
          />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[var(--sg-shell-900)]">
            Your capability record starts here
          </h2>
          <p className="mt-1 text-sm text-[var(--sg-shell-500)] max-w-sm">
            Complete missions to develop verified AI skills and build a durable capability record.
          </p>
        </div>
        <Link href="/missions">
          <Button variant="primary" size="default" leftIcon={<BookOpen size={16} />}>
            Browse Missions
          </Button>
        </Link>
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
      {showSubtitle && (
        <p className="text-sm text-[var(--sg-shell-500)]">
          Your capability record and recent evidence
        </p>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatsCard
          label="Capabilities"
          value={totalStarted}
          sublabel={`of ${summary.total_skills_available}`}
          icon={<Layers size={18} />}
        />
        <StatsCard
          label="Missions Completed"
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
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--sg-shell-200)]">
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
                  <span className="text-xs text-[var(--sg-shell-500)]">
                    {label} ({count})
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Gap summary */}
      {showGapSummary && gaps && <GapSummary gaps={gaps} />}

      {/* Achievement history */}
      {showAchievementHistory && (
        <AchievementHistory achievements={achievements} />
      )}

      {/* Domain sections */}
      {showDomainSections && (
        <div className="divide-y divide-[var(--sg-shell-border)]">
          {domains.map((domain, i) => (
            <SkillDomainSection
              key={domain.domain.slug}
              domain={domain}
              index={i}
              marketStates={marketStates}
            />
          ))}
        </div>
      )}
    </div>
  );
}
