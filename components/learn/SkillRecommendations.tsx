"use client";

/**
 * Skill-based recommendation cards for the Learn page.
 *
 * Shows personalized path recommendations based on the user's skill profile.
 * Five recommendation types, each with a distinct visual treatment.
 * Each card has a deterministic primary CTA: Start Path, Continue Path,
 * or Practice in Room — resolved server-side based on real user state.
 */

import { Card } from "@/components/ui/Card";
import {
  TrendingUp,
  Target,
  Compass,
  ArrowRight,
  Flame,
  Zap,
  Users,
  Play,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { SkillRecommendation } from "@/lib/useSkillRecommendations";
import { getMissionRoute } from "@/lib/appRoutes";

// ─── Reason config ──────────────────────────────────────────

const REASON_CONFIG: Record<
  string,
  { icon: typeof TrendingUp; label: string; color: string }
> = {
  continue_momentum: {
    icon: Zap,
    label: "Keep going",
    color: "var(--sg-forest-500)",
  },
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
  const action = rec.action;

  if (!topPath) return null;

  const isContinue = action?.type === "continue_path";
  const ctaHref = action?.href ?? getMissionRoute(topPath.id);
  const ctaLabel =
    action?.type === "continue_path"
      ? "Continue mission"
      : action?.type === "join_room"
        ? "Open room"
        : "Start mission";

  return (
    <Card
      className="p-4 space-y-3 animate-fade-in cursor-pointer transition-colors hover:bg-shell-50"
      style={{
        animationDelay: `${index * 100}ms`,
        animationFillMode: "backwards",
      }}
      onClick={() => router.push(ctaHref)}
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

      {/* Path title */}
      <p className="text-xs text-shell-600 truncate">
        {topPath.title}
      </p>

      {/* Primary CTA + optional room hint */}
      <div className="flex items-center justify-between pt-1 border-t border-shell-200">
        <div className="flex items-center gap-1.5">
          {isContinue ? (
            <Play size={11} style={{ color: "var(--sg-forest-500)" }} />
          ) : (
            <ArrowRight size={11} className="text-shell-500" />
          )}
          <span
            className="text-xs font-medium"
            style={{
              color: isContinue
                ? "var(--sg-forest-500)"
                : "var(--sg-shell-700)",
            }}
          >
            {ctaLabel}
          </span>
        </div>
        {action?.room_name && (
          <div className="flex items-center gap-1 text-[10px] text-shell-400">
            <Users size={9} />
            <span className="truncate max-w-[100px]">
              {action.room_name}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── Main Component ─────────────────────────────────────────

interface SkillRecommendationsProps {
  recommendations: SkillRecommendation[];
  title?: string;
}

export function SkillRecommendations({
  recommendations,
  title = "Next Best Reps",
}: SkillRecommendationsProps) {
  if (recommendations.length === 0) return null;

  return (
    <div className="space-y-3 mb-6">
      <h3 className="text-sm font-medium text-shell-600">
        {title}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {recommendations.slice(0, 6).map((rec, i) => (
          <RecommendationCard key={rec.skill.slug} rec={rec} index={i} />
        ))}
      </div>
    </div>
  );
}
