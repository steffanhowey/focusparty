"use client";

import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Clock3, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { ProfileAchievement } from "@/lib/useSkillProfile";
import { getProgressEvidenceRoute } from "@/lib/appRoutes";

interface MissionOutcomeCardProps {
  achievement: ProfileAchievement;
  compact?: boolean;
  showViewLink?: boolean;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return "<1m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getPrimarySkills(achievement: ProfileAchievement): string[] {
  const skills = achievement.skill_receipt?.skills ?? [];
  const primary = skills
    .filter((entry) => entry.relevance === "primary")
    .map((entry) => entry.skill.name);

  if (primary.length > 0) return primary;

  return skills.slice(0, 2).map((entry) => entry.skill.name);
}

function getLevelUpCount(achievement: ProfileAchievement): number {
  return (
    achievement.skill_receipt?.skills.filter((entry) => entry.leveled_up).length ??
    0
  );
}

export function MissionOutcomeCard({
  achievement,
  compact = false,
  showViewLink = true,
}: MissionOutcomeCardProps) {
  const demonstratedSkills = getPrimarySkills(achievement);
  const levelUpCount = getLevelUpCount(achievement);
  const viewHref = achievement.share_slug
    ? getProgressEvidenceRoute(achievement.share_slug)
    : null;

  return (
    <Card className={compact ? "p-3" : "p-4"}>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-forest-500">
              <CheckCircle2 size={12} />
              Mission Outcome
            </div>
            <h3 className="text-sm font-semibold leading-snug text-shell-900">
              {achievement.path_title}
            </h3>
          </div>
          <span className="shrink-0 text-xs text-shell-500">
            {formatDate(achievement.completed_at)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-shell-500">
          <span className="inline-flex items-center gap-1">
            <Clock3 size={11} />
            {formatTime(achievement.time_invested_seconds)}
          </span>
          <span>{achievement.items_completed} completed</span>
          {levelUpCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[var(--sg-gold-600)]">
              <Sparkles size={11} />
              {levelUpCount} level-up{levelUpCount > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {demonstratedSkills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {demonstratedSkills.slice(0, compact ? 2 : 3).map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center rounded-full bg-shell-100 px-2 py-1 text-[11px] font-medium text-shell-600"
              >
                {skill}
              </span>
            ))}
          </div>
        )}

        {showViewLink && viewHref && (
          <div className="pt-1">
            <Link
              href={viewHref}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-forest-500 transition-colors hover:text-shell-900"
            >
              View evidence
              <ArrowUpRight size={12} />
            </Link>
          </div>
        )}
      </div>
    </Card>
  );
}
