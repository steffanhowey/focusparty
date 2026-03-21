"use client";

import { ChevronDown, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AchievementShareMenu } from "@/components/achievements/AchievementShareMenu";
import { EvidencePreview } from "@/components/progress/EvidencePreview";
import { EvidenceStrengthenedSummary } from "@/components/progress/EvidenceStrengthenedSummary";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getProgressEvidenceRoute } from "@/lib/appRoutes";
import {
  formatEvidenceDate,
  formatEvidenceDuration,
  getEvidenceSummary,
} from "@/lib/evidencePresentation";
import type { ProfileAchievement } from "@/lib/useSkillProfile";

interface EvidenceArchiveCardProps {
  achievement: ProfileAchievement;
}

export function EvidenceArchiveCard({
  achievement,
}: EvidenceArchiveCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasReceipt = (achievement.skill_receipt?.skills ?? []).length > 0;
  const viewHref = achievement.share_slug
    ? getProgressEvidenceRoute(achievement.share_slug)
    : null;

  return (
    <Card className="overflow-hidden">
      <div className="grid gap-0 md:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)]">
        <EvidencePreview
          achievement={achievement}
          receipt={achievement.skill_receipt}
          compact
          className="rounded-none border-0 border-b md:border-b-0 md:border-r"
        />

        <div className="flex h-full flex-col justify-between gap-4 p-4 sm:p-5">
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--sg-shell-500)]">
                Completed work
              </div>
              <h3 className="text-xl font-semibold leading-tight text-[var(--sg-shell-900)]">
                {achievement.path_title}
              </h3>
            </div>

            <p className="text-sm leading-6 text-[var(--sg-shell-600)]">
              {getEvidenceSummary(achievement, achievement.skill_receipt)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--sg-shell-500)]">
            <span>{formatEvidenceDate(achievement.completed_at)}</span>
            <span className="text-[var(--sg-shell-300)]">•</span>
            <span>
              {achievement.items_completed}{" "}
              {achievement.items_completed === 1 ? "step" : "steps"}
            </span>
            <span className="text-[var(--sg-shell-300)]">•</span>
            <span>{formatEvidenceDuration(achievement.time_invested_seconds)}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {viewHref ? (
              <Link
                href={viewHref}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--sg-forest-500)] transition-colors hover:text-[var(--sg-shell-900)]"
              >
                View work
                <ExternalLink size={14} />
              </Link>
            ) : null}

            {achievement.share_slug ? (
              <AchievementShareMenu
                shareSlug={achievement.share_slug}
                pathTitle={achievement.path_title}
                pathTopics={achievement.path_topics}
                buttonLabel="Share"
                buttonVariant="ghost"
                buttonSize="xs"
                menuAlign="right"
              />
            ) : null}

            {hasReceipt ? (
              <Button
                variant="outline"
                size="xs"
                onClick={() => setIsOpen((previous) => !previous)}
                rightIcon={
                  <ChevronDown
                    size={14}
                    className="transition-transform"
                    style={{
                      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                  />
                }
                aria-expanded={isOpen}
              >
                Capability detail
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {isOpen && hasReceipt ? (
        <div className="border-t border-[var(--sg-shell-border)] bg-[var(--sg-shell-50)] px-4 py-4 sm:px-5">
          <EvidenceStrengthenedSummary
            receipt={achievement.skill_receipt}
            compact
          />
        </div>
      ) : null}
    </Card>
  );
}
