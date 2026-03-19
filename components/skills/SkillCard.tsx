"use client";

/**
 * Individual skill card — two visual states:
 * - Active (has progress): solid border, skill name + FluencyBadge + paths count
 * - Undiscovered (no progress): dashed border, dimmed, links to /learn search
 */

import { TrendingUp, TrendingDown, Sparkles, Minus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { FluencyBadge } from "./FluencyBadge";
import type { SkillProfileSkill } from "@/lib/useSkillProfile";
import type { SkillMarketState } from "@/lib/types/intelligence";
import { getMissionSearchRoute } from "@/lib/appRoutes";

interface SkillCardProps {
  skill: SkillProfileSkill;
  onNavigate?: (href: string) => void;
  marketState?: SkillMarketState | null;
}

const TREND_CONFIG = {
  rising: { Icon: TrendingUp, color: "var(--sg-forest-400)", label: "Rising" },
  declining: { Icon: TrendingDown, color: "var(--sg-gold-600)", label: "Declining" },
  emerging: { Icon: Sparkles, color: "var(--sg-teal-500)", label: "Emerging" },
  stable: { Icon: Minus, color: "var(--sg-shell-500)", label: "Stable" },
} as const;

export function SkillCard({ skill, onNavigate, marketState }: SkillCardProps) {
  const { progress } = skill;
  const isActive = progress !== null;

  if (!isActive) {
    return (
      <button
        type="button"
        className="w-full rounded-xl p-3 text-left transition-colors hover:bg-[var(--sg-shell-50)]"
        style={{
          border: "1px dashed var(--sg-shell-border)",
          background: "transparent",
        }}
        onClick={() => {
          const href = getMissionSearchRoute(skill.skill.name);
          if (onNavigate) {
            onNavigate(href);
          } else {
            window.location.href = href;
          }
        }}
      >
        <p className="text-sm font-medium text-[var(--sg-shell-400)]">
          {skill.skill.name}
        </p>
        <p className="mt-0.5 text-xs text-[var(--sg-shell-400)] opacity-60">
          Start exploring
        </p>
      </button>
    );
  }

  return (
    <Card variant="default" className="p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-[var(--sg-shell-900)] truncate">
          {skill.skill.name}
        </p>
        <FluencyBadge level={progress.fluency_level} size="sm" />
      </div>
      <div className="mt-1 flex items-center gap-2">
        {progress.paths_completed > 0 && (
          <span className="text-xs text-[var(--sg-shell-500)]">
            {progress.paths_completed} path{progress.paths_completed !== 1 ? "s" : ""}
          </span>
        )}
        {marketState && marketState.direction !== "stable" && (() => {
          const cfg = TREND_CONFIG[marketState.direction];
          return (
            <span
              className="inline-flex items-center gap-0.5 text-[10px] font-medium"
              style={{ color: cfg.color }}
            >
              <cfg.Icon size={10} />
              {cfg.label}
            </span>
          );
        })()}
        {marketState && marketState.market_percentile >= 70 && (
          <span className="text-[10px] text-[var(--sg-shell-500)]">
            Top {100 - marketState.market_percentile}% demand
          </span>
        )}
      </div>
    </Card>
  );
}
