"use client";

/**
 * Skill-based recommendation cards for the Learn page.
 *
 * Shows personalized path recommendations based on the user's skill profile.
 * Three recommendation types, each with a distinct visual treatment:
 * - Level-up: highlighted, most prominent (you're almost there)
 * - Function gap: standard weight (you should know this)
 * - Domain expansion: subtle (broaden your capabilities)
 */

import { Card } from "@/components/ui/Card";
import { TrendingUp, Target, Compass, ArrowRight, Flame } from "lucide-react";
import { useRouter } from "next/navigation";
import type { SkillRecommendation } from "@/lib/useSkillRecommendations";

// ─── Reason config ──────────────────────────────────────────

const REASON_CONFIG: Record<
  string,
  { icon: typeof TrendingUp; label: string; color: string }
> = {
  level_up: {
    icon: TrendingUp,
    label: "Level up",
    color: "var(--sg-forest-300)",
  },
  function_gap: {
    icon: Target,
    label: "Key skill",
    color: "var(--sg-teal-600)",
  },
  domain_expansion: {
    icon: Compass,
    label: "Explore",
    color: "var(--sg-shell-500)",
  },
  market_demand: {
    icon: Flame,
    label: "In Demand",
    color: "var(--sg-gold-600)",
  },
};

// ─── Recommendation Card ────────────────────────────────────

function RecommendationCard({
  rec,
  index,
}: {
  rec: SkillRecommendation;
  index: number;
}) {
  const router = useRouter();
  const config = REASON_CONFIG[rec.reason] ?? REASON_CONFIG.function_gap;
  const Icon = config.icon;
  const topPath = rec.paths[0];

  if (!topPath) return null;

  return (
    <Card
      className="p-4 space-y-3 animate-fade-in cursor-pointer transition-colors hover:bg-shell-50"
      style={{
        animationDelay: `${index * 100}ms`,
        animationFillMode: "backwards",
      }}
      onClick={() => router.push(`/learn/paths/${topPath.id}`)}
    >
      {/* Reason badge */}
      <div className="flex items-center gap-1.5">
        <Icon size={12} style={{ color: config.color }} />
        <span
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: config.color }}
        >
          {config.label}
        </span>
      </div>

      {/* Skill + reasoning */}
      <div className="space-y-0.5">
        <h4 className="text-sm font-medium text-shell-900 leading-snug">
          {rec.skill.name}
        </h4>
        <p className="text-xs text-shell-500">
          {rec.reason_text}
        </p>
      </div>

      {/* Top path */}
      <div className="flex items-center justify-between pt-1">
        <p className="text-xs text-shell-600 truncate pr-2">
          {topPath.title}
        </p>
        <ArrowRight
          size={12}
          className="text-shell-500 shrink-0"
        />
      </div>
    </Card>
  );
}

// ─── Main Component ─────────────────────────────────────────

interface SkillRecommendationsProps {
  recommendations: SkillRecommendation[];
}

export function SkillRecommendations({
  recommendations,
}: SkillRecommendationsProps) {
  if (recommendations.length === 0) return null;

  return (
    <div className="space-y-3 mb-6">
      <h3 className="text-sm font-medium text-shell-600">
        Recommended for you
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {recommendations.slice(0, 6).map((rec, i) => (
          <RecommendationCard key={rec.skill.slug} rec={rec} index={i} />
        ))}
      </div>
    </div>
  );
}
