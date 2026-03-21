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
import { getWhyThisNextLine } from "@/lib/missionLanguage";
import { getMissionFraming, getMissionRepSummary } from "@/lib/missionPresentation";

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
    label: "Strengthen",
    color: "var(--sg-forest-300)",
  },
  function_gap: {
    icon: Target,
    label: "Key area",
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
  featured = false,
}: {
  rec: SkillRecommendation;
  index: number;
  featured?: boolean;
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
      className={`space-y-3 animate-fade-in cursor-pointer transition-colors hover:bg-shell-50 ${
        featured ? "border-forest-200 bg-shell-50 p-5 sm:p-6" : "p-4"
      }`}
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

      {/* Mission-first heading */}
      <div className="space-y-0.5">
        <h4 className={`${featured ? "text-base sm:text-lg" : "text-sm"} font-medium leading-snug text-shell-900`}>
          {topPath.title}
        </h4>
        <p className="text-xs text-shell-600 line-clamp-2">
          {getMissionFraming(topPath)}
        </p>
      </div>

      <p className="text-xs text-shell-500 line-clamp-2">
        {getWhyThisNextLine(rec.reason_text)}
      </p>

      {/* Primary CTA + optional room hint */}
      <div className="flex items-center justify-between pt-1 border-t border-shell-200">
        <div className="min-w-0 space-y-1">
          <p className="text-xs text-shell-500">
            {getMissionRepSummary(topPath)}
          </p>
          {action?.room_name ? (
            <div className="flex items-center gap-1 text-[10px] text-shell-400">
              <Users size={9} />
              <span className="truncate max-w-[120px]">
                {action.room_name}
              </span>
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
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
      </div>
    </Card>
  );
}

// ─── Main Component ─────────────────────────────────────────

interface SkillRecommendationsProps {
  recommendations: SkillRecommendation[];
  title?: string;
  featuredFirst?: boolean;
}

export function SkillRecommendations({
  recommendations,
  title = "Recommended Missions",
  featuredFirst = false,
}: SkillRecommendationsProps) {
  if (recommendations.length === 0) return null;

  const [featuredRecommendation, ...remainingRecommendations] = recommendations.slice(0, 6);

  return (
    <div className="space-y-3 mb-6">
      <h3 className="text-sm font-medium text-shell-600">
        {title}
      </h3>
      {featuredFirst && featuredRecommendation ? (
        <div className="space-y-4">
          <RecommendationCard
            key={featuredRecommendation.skill.slug}
            rec={featuredRecommendation}
            index={0}
            featured
          />
          {remainingRecommendations.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {remainingRecommendations.slice(0, 2).map((rec, index) => (
                <RecommendationCard
                  key={rec.skill.slug}
                  rec={rec}
                  index={index + 1}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recommendations.slice(0, 6).map((rec, i) => (
            <RecommendationCard key={rec.skill.slug} rec={rec} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
