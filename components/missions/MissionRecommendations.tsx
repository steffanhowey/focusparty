"use client";

import { MissionCard } from "@/components/missions/MissionCard";
import { getMissionRepSummary } from "@/lib/missionPresentation";
import type { MissionRecommendationViewModel } from "@/lib/missionRecommendations";

interface MissionRecommendationsProps {
  recommendations: MissionRecommendationViewModel[];
  title?: string;
  description?: string;
  featuredFirst?: boolean;
  badgeLabel?: string;
}

function formatRecommendationMeta(
  recommendation: MissionRecommendationViewModel,
): string {
  const parts = [
    getMissionRepSummary(recommendation.path),
    recommendation.launchDomain.shortLabel,
    recommendation.roomHint,
  ];

  return parts.filter((part): part is string => Boolean(part)).join(" · ");
}

export function MissionRecommendations({
  recommendations,
  title = "Recommended Missions",
  description,
  featuredFirst = false,
  badgeLabel = "Recommended",
}: MissionRecommendationsProps) {
  if (recommendations.length === 0) return null;

  const [featuredRecommendation, ...remainingRecommendations] =
    recommendations.slice(0, 6);

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-shell-900">
          {title}
        </h3>
        {description ? (
          <p className="text-sm text-shell-500">
            {description}
          </p>
        ) : null}
      </div>

      {featuredFirst && featuredRecommendation ? (
        <div className="space-y-4">
          <MissionCard
            path={featuredRecommendation.path}
            featured
            badgeLabelOverride={badgeLabel}
            supportLineOverride={featuredRecommendation.explanation}
            metaLineOverride={formatRecommendationMeta(featuredRecommendation)}
          />

          {remainingRecommendations.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {remainingRecommendations.slice(0, 2).map((recommendation) => (
                <MissionCard
                  key={recommendation.path.id}
                  path={recommendation.path}
                  compact
                  badgeLabelOverride={badgeLabel}
                  supportLineOverride={recommendation.explanation}
                  metaLineOverride={formatRecommendationMeta(recommendation)}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recommendations.slice(0, 6).map((recommendation) => (
            <MissionCard
              key={recommendation.path.id}
              path={recommendation.path}
              compact
              badgeLabelOverride={badgeLabel}
              supportLineOverride={recommendation.explanation}
              metaLineOverride={formatRecommendationMeta(recommendation)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
