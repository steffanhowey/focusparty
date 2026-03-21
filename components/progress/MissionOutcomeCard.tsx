"use client";

import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Clock3 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { AchievementSummary } from "@/lib/types";
import type { SkillReceipt } from "@/lib/types/skills";
import { getProgressEvidenceRoute } from "@/lib/appRoutes";

interface MissionOutcomeCardProps {
  achievement: AchievementSummary;
  skillReceipt?: SkillReceipt | null;
  compact?: boolean;
  showViewLink?: boolean;
  label?: string;
  summary?: string | null;
  emphasis?: "default" | "featured";
  className?: string;
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

function getPrimarySkills(skillReceipt: SkillReceipt | null | undefined): string[] {
  const skills = skillReceipt?.skills ?? [];
  const primary = skills
    .filter((entry) => entry.relevance === "primary")
    .map((entry) => entry.skill.name);

  if (primary.length > 0) return primary;

  return skills.slice(0, 2).map((entry) => entry.skill.name);
}

export function MissionOutcomeCard({
  achievement,
  skillReceipt = null,
  compact = false,
  showViewLink = true,
  label = "Completed work",
  summary = null,
  emphasis = "default",
  className = "",
}: MissionOutcomeCardProps) {
  const resolvedSkillReceipt =
    skillReceipt ??
    ((achievement as AchievementSummary & { skill_receipt?: SkillReceipt | null }).skill_receipt ?? null);
  const demonstratedSkills = getPrimarySkills(resolvedSkillReceipt);
  const viewHref = achievement.share_slug
    ? getProgressEvidenceRoute(achievement.share_slug)
    : null;
  const resolvedSummary = summary ??
    (demonstratedSkills.length > 0
      ? `Demonstrated in practice: ${demonstratedSkills.slice(0, 2).join(", ")}.`
      : "Completed work captured in practice.");
  const rootClassName = emphasis === "featured"
    ? "border-forest-200 bg-shell-50 p-5"
    : compact
      ? "p-3"
      : "p-4";
  const titleClassName = emphasis === "featured" && !compact
    ? "text-base"
    : "text-sm";

  return (
    <Card className={`${rootClassName} ${className}`.trim()}>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-forest-500">
              <CheckCircle2 size={12} />
              {label}
            </div>
            <h3 className={`${titleClassName} font-semibold leading-snug text-shell-900`}>
              {achievement.path_title}
            </h3>
          </div>
          <span className="shrink-0 text-xs text-shell-500">
            {formatDate(achievement.completed_at)}
          </span>
        </div>

        <p className="text-sm leading-6 text-shell-600">
          {resolvedSummary}
        </p>

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

        <div className="flex flex-wrap items-center gap-2 text-xs text-shell-500">
          <span>{achievement.items_completed} step{achievement.items_completed === 1 ? "" : "s"}</span>
          {achievement.time_invested_seconds > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Clock3 size={11} />
              {formatTime(achievement.time_invested_seconds)}
            </span>
          ) : null}
        </div>

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
