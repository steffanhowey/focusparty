"use client";

import { BarChart3 } from "lucide-react";
import { SkillProfilePage } from "@/components/skills/SkillProfilePage";
import { ProgressDashboard } from "@/components/progress/ProgressDashboard";
import { useSkillProfile } from "@/lib/useSkillProfile";
import { MissionOutcomeCard } from "@/components/progress/MissionOutcomeCard";
import { Card } from "@/components/ui/Card";
import { ProgressMovementSummary } from "@/components/progress/ProgressMovementSummary";
import { useMissionRecommendations } from "@/lib/useMissionRecommendations";
import { MissionRecommendations } from "@/components/missions/MissionRecommendations";

export function ProgressPage() {
  const { recommendations } = useMissionRecommendations({
    surface: "progress",
  });
  const { achievements, gaps, isLoading } = useSkillProfile();

  return (
    <div className="space-y-8">
      <div className="max-w-2xl">
        <p className="text-sm leading-6 text-shell-600">
          A capability record grounded in completed mission work, visible evidence, and what to strengthen next.
        </p>
      </div>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-shell-900">
            Capability Summary
          </h2>
          <p className="text-sm text-shell-500">
            Where your capability stands right now, based on the mission work you have already finished.
          </p>
        </div>
        <SkillProfilePage
          showSubtitle={false}
          showAchievementHistory={false}
          showGapSummary={false}
          showDomainSections={false}
        />
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-shell-900">
            Recent Evidence
          </h2>
          <p className="text-sm text-shell-500">
            Completed mission work captured in practice.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-shell-300 border-t-forest-500" />
          </div>
        ) : achievements.length > 0 ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {achievements.slice(0, 4).map((achievement) => (
              <MissionOutcomeCard
                key={achievement.id}
                achievement={achievement}
              />
            ))}
          </div>
        ) : (
          <Card className="p-5 text-sm text-shell-500">
            Finish your first mission to start a visible evidence trail.
          </Card>
        )}
      </section>

      <ProgressMovementSummary gaps={gaps} achievements={achievements} />

      {recommendations.length > 0 && (
        <MissionRecommendations
          recommendations={recommendations.slice(0, 3)}
          title="Recommended Next Rep"
          featuredFirst
          badgeLabel="Next Rep"
        />
      )}

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 size={14} className="text-shell-500" />
          <h2 className="text-sm font-semibold text-shell-600">
            Room Activity
          </h2>
        </div>
        <ProgressDashboard />
      </section>
    </div>
  );
}
