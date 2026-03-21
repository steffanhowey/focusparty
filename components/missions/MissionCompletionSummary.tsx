"use client";

import { Card } from "@/components/ui/Card";
import { AchievementShareMenu } from "@/components/achievements/AchievementShareMenu";
import { SkillReceipt } from "@/components/learn/SkillReceipt";
import { RoomStagePanel } from "@/components/learn/RoomStageScaffold";
import { MissionCard } from "@/components/missions/MissionCard";
import { MissionOutcomeCard } from "@/components/progress/MissionOutcomeCard";
import {
  formatAchievementDate,
  formatAchievementDuration,
} from "@/lib/achievements/achievementModel";
import type {
  AchievementSummary,
  LearningPath,
  LearningProgress,
  SkillReceipt as SkillReceiptType,
} from "@/lib/types";

interface MissionCompletionSummaryProps {
  path: LearningPath;
  progress: LearningProgress | null;
  achievement: AchievementSummary | null;
  skillReceipt: SkillReceiptType | null;
  artifactExpectation: string;
  recommendedPaths: LearningPath[];
  recommendationsLoading?: boolean;
  variant?: "standalone" | "overlay";
}

function CompletionSectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-1">
      <h3 className="text-base font-semibold text-white">
        {title}
      </h3>
      {description ? (
        <p className="text-sm leading-6 text-white/55">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function formatCompletionMeta(
  progress: LearningProgress | null,
  itemCount: number,
): string[] {
  const completedAt = progress?.completed_at;
  const itemsCompleted = progress?.items_completed ?? itemCount;
  const parts = [
    completedAt ? `Completed ${formatAchievementDate(completedAt, "short")}` : null,
    `${itemsCompleted}/${itemCount} steps finished`,
    progress?.time_invested_seconds
      ? `${formatAchievementDuration(progress.time_invested_seconds)} invested`
      : null,
  ];

  return parts.filter((part): part is string => Boolean(part));
}

export function MissionCompletionSummary({
  path,
  progress,
  achievement,
  skillReceipt,
  artifactExpectation,
  recommendedPaths,
  recommendationsLoading = false,
  variant = "standalone",
}: MissionCompletionSummaryProps) {
  const [featuredPath, ...secondaryPaths] = recommendedPaths;
  const metaItems = formatCompletionMeta(progress, path.items.length);

  return (
    <div className="space-y-5">
      <RoomStagePanel className="space-y-4">
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--sg-forest-300)]">
            Mission Outcome
          </p>
          <h3 className="text-lg font-semibold text-white">
            {path.title}
          </h3>
          <p className="text-sm leading-6 text-white/72">
            {artifactExpectation}
          </p>
        </div>

        {metaItems.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/45">
            {metaItems.map((item) => (
              <span
                key={item}
                className="inline-flex items-center rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-1"
              >
                {item}
              </span>
            ))}
          </div>
        ) : null}
      </RoomStagePanel>

      <section className="space-y-3">
        <CompletionSectionHeader
          title="Evidence"
          description="Completed work captured in practice from this mission."
        />

        {achievement ? (
          <MissionOutcomeCard
            achievement={achievement}
            skillReceipt={skillReceipt}
            label="Completed work"
            summary={artifactExpectation}
            emphasis={variant === "standalone" ? "featured" : "default"}
            showViewLink={false}
          />
        ) : (
          <Card className="p-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-shell-900">
                Preparing evidence
              </p>
              <p className="text-sm leading-6 text-shell-500">
                We&apos;re packaging the completed work from this mission into a shareable evidence view.
              </p>
            </div>
          </Card>
        )}

        <div className="flex justify-start">
          <AchievementShareMenu
            shareSlug={achievement?.share_slug}
            pathTitle={path.title}
            pathTopics={path.topics}
          />
        </div>
      </section>

      <section className="space-y-3">
        <CompletionSectionHeader
          title="What This Strengthened"
          description="The capability snapshot captured from this finished mission."
        />

        {skillReceipt ? (
          <SkillReceipt
            receipt={skillReceipt}
            title="What This Strengthened"
            subtitle="Capability captured from this mission."
            showFirstReceiptNote={false}
            className="max-w-none"
          />
        ) : (
          <Card className="p-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-shell-900">
                Updating the capability snapshot
              </p>
              <p className="text-sm leading-6 text-shell-500">
                We&apos;re finalizing what this mission strengthened so it shows up cleanly in your progress record.
              </p>
            </div>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <CompletionSectionHeader
          title="Recommended Next Rep"
          description="If you want to keep going, start with the mission that best builds on this completed work."
        />

        {recommendationsLoading ? (
          <RoomStagePanel className="text-sm leading-6 text-white/55">
            We&apos;re lining up the next mission that builds on what you just finished.
          </RoomStagePanel>
        ) : featuredPath ? (
          <div className="space-y-4">
            <MissionCard
              path={featuredPath}
              featured={variant === "standalone"}
            />

            {secondaryPaths.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {secondaryPaths.slice(0, 2).map((recommendedPath) => (
                  <MissionCard
                    key={recommendedPath.id}
                    path={recommendedPath}
                    compact
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <RoomStagePanel className="text-sm leading-6 text-white/55">
            More missions are ready whenever you want another focused round of work.
          </RoomStagePanel>
        )}
      </section>
    </div>
  );
}
