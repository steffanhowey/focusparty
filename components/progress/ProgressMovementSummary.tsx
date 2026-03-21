"use client";

import { Sparkles, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { FluencyBadge } from "@/components/skills/FluencyBadge";
import { formatMissionUnit } from "@/lib/missionLanguage";
import type {
  ProfileAchievement,
  SkillGaps,
} from "@/lib/useSkillProfile";

interface ProgressMovementSummaryProps {
  gaps: SkillGaps | null;
  achievements: ProfileAchievement[];
}

function getRecentLevelUps(achievements: ProfileAchievement[]) {
  return achievements
    .flatMap((achievement) => achievement.skill_receipt?.skills ?? [])
    .filter((entry) => entry.leveled_up)
    .slice(0, 3);
}

export function ProgressMovementSummary({
  gaps,
  achievements,
}: ProgressMovementSummaryProps) {
  const activeProgression = gaps?.active_progression.slice(0, 4) ?? [];
  const strongest = gaps?.strongest.slice(0, 4) ?? [];
  const recentLevelUps = getRecentLevelUps(achievements);

  if (
    activeProgression.length === 0 &&
    strongest.length === 0 &&
    recentLevelUps.length === 0
  ) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-shell-900">
          What&apos;s Moving
        </h2>
        <p className="text-sm text-shell-500">
          The capabilities getting stronger through your recent completed mission work.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {activeProgression.length > 0 ? (
          <Card className="p-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp size={14} className="text-forest-500" />
                <h3 className="text-sm font-semibold text-shell-900">
                  Strengthening now
                </h3>
              </div>
              <div className="space-y-2">
                {activeProgression.map((progression) => (
                  <div
                    key={progression.skill_slug}
                    className="flex items-center justify-between gap-3 rounded-[var(--sg-radius-lg)] bg-shell-50 px-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-shell-900">
                        {progression.skill_name}
                      </p>
                      <p className="text-xs text-shell-500">
                        {formatMissionUnit(progression.paths_to_next)} to {progression.next_level}
                      </p>
                    </div>
                    <FluencyBadge level={progression.fluency_level} size="sm" />
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ) : null}

        {recentLevelUps.length > 0 ? (
          <Card className="p-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles size={14} style={{ color: "var(--sg-gold-600)" }} />
                <h3 className="text-sm font-semibold text-shell-900">
                  Recently strengthened
                </h3>
              </div>
              <div className="space-y-2">
                {recentLevelUps.map((entry) => (
                  <div
                    key={`${entry.skill.slug}-${entry.after.fluency_level}`}
                    className="flex items-center justify-between gap-3 rounded-[var(--sg-radius-lg)] bg-shell-50 px-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-shell-900">
                        {entry.skill.name}
                      </p>
                      <p className="text-xs text-shell-500">
                        Now showing at {entry.after.fluency_level}
                      </p>
                    </div>
                    <FluencyBadge level={entry.after.fluency_level} size="sm" />
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ) : strongest.length > 0 ? (
          <Card className="p-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-shell-500" />
                <h3 className="text-sm font-semibold text-shell-900">
                  Most established
                </h3>
              </div>
              <div className="space-y-2">
                {strongest.map((skill) => (
                  <div
                    key={skill.skill_slug}
                    className="flex items-center justify-between gap-3 rounded-[var(--sg-radius-lg)] bg-shell-50 px-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-shell-900">
                        {skill.skill_name}
                      </p>
                      <p className="text-xs text-shell-500">
                        {formatMissionUnit(skill.paths_completed)} completed
                      </p>
                    </div>
                    <FluencyBadge level={skill.fluency_level} size="sm" />
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ) : null}
      </div>
    </section>
  );
}
