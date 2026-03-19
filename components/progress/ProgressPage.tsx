"use client";

import { BarChart3 } from "lucide-react";
import { SkillRecommendations } from "@/components/learn/SkillRecommendations";
import { SkillProfilePage } from "@/components/skills/SkillProfilePage";
import { ProgressDashboard } from "@/components/progress/ProgressDashboard";
import { useSkillRecommendations } from "@/lib/useSkillRecommendations";
import { useSkillProfile } from "@/lib/useSkillProfile";
import { MissionOutcomeCard } from "@/components/progress/MissionOutcomeCard";
import { Card } from "@/components/ui/Card";

export function ProgressPage() {
  const { recommendations } = useSkillRecommendations();
  const { achievements, isLoading } = useSkillProfile();

  return (
    <div className="space-y-8">
      <div className="max-w-2xl">
        <p className="text-sm leading-6 text-shell-600">
          Capability, recent outcomes, and the next reps that will move you forward.
        </p>
      </div>

      <SkillProfilePage showSubtitle={false} showAchievementHistory={false} />

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-shell-900">
            Recent Evidence
          </h2>
          <p className="text-sm text-shell-500">
            Completed missions that now count as visible proof of progress.
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

      {recommendations.length > 0 && (
        <SkillRecommendations
          recommendations={recommendations.slice(0, 3)}
          title="Recommended Next Reps"
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
