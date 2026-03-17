"use client";

/**
 * Public skill detail page content.
 * Shows market state, practitioner stats, related insights, and related paths.
 */

import { Card } from "@/components/ui/Card";
import { TrendingUp, TrendingDown, Sparkles, Minus, Users, BookOpen } from "lucide-react";
import type { SkillMarketState, SkillIntelligence } from "@/lib/types/intelligence";
import type { LearningPath } from "@/lib/types";

// ─── Direction config ────────────────────────────────────

const DIR_CONFIG: Record<
  string,
  { icon: typeof TrendingUp; color: string; label: string }
> = {
  rising: { icon: TrendingUp, color: "var(--sg-forest-400)", label: "Rising" },
  emerging: { icon: Sparkles, color: "var(--sg-teal-500)", label: "Emerging" },
  declining: { icon: TrendingDown, color: "var(--sg-gold-600)", label: "Declining" },
  stable: { icon: Minus, color: "var(--sg-shell-500)", label: "Stable" },
};

// ─── Component ───────────────────────────────────────────

interface SkillDetailPageProps {
  skillName: string;
  skillSlug: string;
  domainName: string;
  marketState: SkillMarketState | null;
  insights: SkillIntelligence[];
  paths: LearningPath[];
}

export function SkillDetailPage({
  skillName,
  skillSlug,
  domainName,
  marketState,
  insights,
  paths,
}: SkillDetailPageProps) {
  const dir = marketState
    ? DIR_CONFIG[marketState.direction] ?? DIR_CONFIG.stable
    : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-[var(--sg-shell-500)] uppercase tracking-wider">
          {domainName}
        </p>
        <h1 className="text-2xl font-bold text-[var(--sg-shell-900)] md:text-3xl">
          {skillName}
        </h1>
        {dir && marketState && (
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
              style={{
                background: `color-mix(in srgb, ${dir.color} 15%, transparent)`,
                color: dir.color,
              }}
            >
              <dir.icon size={12} />
              {dir.label}
            </span>
            {marketState.market_percentile >= 70 && (
              <span className="text-xs text-[var(--sg-shell-500)]">
                Top {100 - marketState.market_percentile}% demand
              </span>
            )}
          </div>
        )}
      </div>

      {/* Market state cards */}
      {marketState && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card className="p-4 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--sg-shell-500)]">
              Heat Score
            </p>
            <p className="text-2xl font-bold text-[var(--sg-shell-900)]">
              {marketState.heat_score.toFixed(2)}
            </p>
          </Card>
          <Card className="p-4 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--sg-shell-500)]">
              Velocity
            </p>
            <p className="text-2xl font-bold text-[var(--sg-shell-900)]">
              {marketState.velocity > 0 ? "+" : ""}
              {marketState.velocity.toFixed(2)}
            </p>
          </Card>
          <Card className="p-4 space-y-1">
            <div className="flex items-center gap-1">
              <Users size={10} className="text-[var(--sg-shell-500)]" />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--sg-shell-500)]">
                Practitioners
              </p>
            </div>
            <p className="text-2xl font-bold text-[var(--sg-shell-900)]">
              {marketState.practitioner_count.toLocaleString()}
            </p>
          </Card>
          <Card className="p-4 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--sg-shell-500)]">
              Demand Gap
            </p>
            <p className="text-2xl font-bold text-[var(--sg-shell-900)]">
              {marketState.demand_supply_gap > 0 ? "+" : ""}
              {marketState.demand_supply_gap.toFixed(1)}
            </p>
          </Card>
        </div>
      )}

      {/* Fluency distribution */}
      {marketState && marketState.practitioner_count > 0 && (
        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-medium text-[var(--sg-shell-600)]">
            Practitioner Distribution
          </h3>
          <div className="flex gap-1 h-6 rounded-full overflow-hidden">
            {(
              [
                { key: "exploring", label: "Exploring", color: "var(--sg-sage-500)" },
                { key: "practicing", label: "Practicing", color: "var(--sg-teal-500)" },
                { key: "proficient", label: "Proficient", color: "var(--sg-forest-400)" },
                { key: "advanced", label: "Advanced", color: "var(--sg-gold-600)" },
              ] as const
            ).map((level) => {
              const count =
                marketState.fluency_distribution[level.key] ?? 0;
              const pct =
                marketState.practitioner_count > 0
                  ? (count / marketState.practitioner_count) * 100
                  : 0;
              if (pct === 0) return null;
              return (
                <div
                  key={level.key}
                  className="flex items-center justify-center text-[10px] font-medium text-white"
                  style={{
                    width: `${pct}%`,
                    background: level.color,
                    minWidth: pct > 5 ? undefined : "20px",
                  }}
                  title={`${level.label}: ${count}`}
                >
                  {pct >= 10 ? level.label : ""}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-[var(--sg-shell-500)]">
            <span>Exploring: {marketState.fluency_distribution.exploring}</span>
            <span>Practicing: {marketState.fluency_distribution.practicing}</span>
            <span>Proficient: {marketState.fluency_distribution.proficient}</span>
            <span>Advanced: {marketState.fluency_distribution.advanced}</span>
          </div>
        </Card>
      )}

      {/* Related insights */}
      {insights.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--sg-shell-900)]">
            Intelligence
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {insights.map((insight) => (
              <Card key={insight.id} className="p-4 space-y-2">
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--sg-teal-500)" }}
                >
                  {insight.insight_type.replace(/_/g, " ")}
                </span>
                <h4 className="text-sm font-medium text-[var(--sg-shell-900)]">
                  {insight.headline}
                </h4>
                <p className="text-xs text-[var(--sg-shell-500)] line-clamp-3">
                  {insight.analysis}
                </p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Related paths */}
      {paths.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--sg-shell-900)]">
            Learning Paths
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {paths.map((path) => (
              <a key={path.id} href={`/learn/paths/${path.id}`}>
                <Card className="p-4 space-y-2 transition-colors hover:bg-[var(--sg-shell-50)] cursor-pointer">
                  <div className="flex items-center gap-1.5">
                    <BookOpen
                      size={12}
                      className="text-[var(--sg-shell-400)]"
                    />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--sg-shell-500)]">
                      {Math.ceil(path.estimated_duration_seconds / 60)} min
                    </span>
                  </div>
                  <h4 className="text-sm font-medium text-[var(--sg-shell-900)] leading-snug">
                    {path.title}
                  </h4>
                  <p className="text-xs text-[var(--sg-shell-500)] line-clamp-2">
                    {path.description}
                  </p>
                </Card>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="text-center py-8 space-y-3">
        <p className="text-sm text-[var(--sg-shell-500)]">
          Start developing {skillName} today.
        </p>
        <a
          href="/learn"
          className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:opacity-90"
          style={{ background: "var(--sg-forest-500)" }}
        >
          Start Learning
        </a>
      </div>
    </div>
  );
}
