"use client";

import type { ReactNode } from "react";
import { FluencyBadge } from "@/components/skills/FluencyBadge";
import { Card } from "@/components/ui/Card";
import type { ProfileAchievement, SkillGaps } from "@/lib/useSkillProfile";

interface CapabilitySnapshotProps {
  gaps: SkillGaps | null;
  achievements: ProfileAchievement[];
  isLoading?: boolean;
}

function SnapshotSkeleton() {
  return (
    <Card className="p-5 sm:p-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="h-5 w-40 animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
          <div className="h-4 w-full max-w-lg animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="space-y-3">
              <div className="h-4 w-28 animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((__, innerIndex) => (
                  <div
                    key={innerIndex}
                    className="h-16 animate-pulse rounded-[var(--sg-radius-lg)] bg-[var(--sg-shell-50)]"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function dedupeRecentLevelUps(achievements: ProfileAchievement[]) {
  const seen = new Set<string>();

  return achievements
    .flatMap((achievement) => achievement.skill_receipt?.skills ?? [])
    .filter((entry) => entry.leveled_up)
    .filter((entry) => {
      if (seen.has(entry.skill.slug)) return false;
      seen.add(entry.skill.slug);
      return true;
    })
    .slice(0, 3);
}

function SnapshotItem({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle: string;
  badge?: ReactNode;
}) {
  return (
    <div className="rounded-[var(--sg-radius-lg)] border border-[var(--sg-shell-border)] bg-[var(--sg-shell-50)] px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--sg-shell-900)]">
            {title}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--sg-shell-500)]">
            {subtitle}
          </p>
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>
    </div>
  );
}

function SnapshotColumn({
  title,
  items,
  emptyCopy,
}: {
  title: string;
  items: ReactNode[];
  emptyCopy: string;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-[var(--sg-shell-900)]">
        {title}
      </h3>
      <div className="space-y-2">
        {items.length > 0 ? (
          items
        ) : (
          <div className="rounded-[var(--sg-radius-lg)] border border-dashed border-[var(--sg-shell-border)] px-3 py-4 text-sm leading-6 text-[var(--sg-shell-500)]">
            {emptyCopy}
          </div>
        )}
      </div>
    </div>
  );
}

function growthSubtitle(pathsToNext: number, nextLevel: string): string {
  const pathLabel = pathsToNext === 1 ? "1 mission" : `${pathsToNext} missions`;
  return `${pathLabel} to ${nextLevel}`;
}

export function CapabilitySnapshot({
  gaps,
  achievements,
  isLoading = false,
}: CapabilitySnapshotProps) {
  if (isLoading && !gaps) {
    return <SnapshotSkeleton />;
  }

  const strongestItems =
    gaps?.strongest.slice(0, 3).map((skill) => (
      <SnapshotItem
        key={skill.skill_slug}
        title={skill.skill_name}
        subtitle={skill.domain_name}
        badge={<FluencyBadge level={skill.fluency_level} size="sm" />}
      />
    )) ?? [];

  const recentLevelUps = dedupeRecentLevelUps(achievements);
  const growthItems =
    recentLevelUps.length > 0
      ? recentLevelUps.map((entry) => (
          <SnapshotItem
            key={`${entry.skill.slug}-${entry.after.fluency_level}`}
            title={entry.skill.name}
            subtitle={`Now at ${entry.after.fluency_level}`}
            badge={<FluencyBadge level={entry.after.fluency_level} size="sm" />}
          />
        ))
      : (gaps?.active_progression.slice(0, 3).map((skill) => (
          <SnapshotItem
            key={skill.skill_slug}
            title={skill.skill_name}
            subtitle={growthSubtitle(skill.paths_to_next, skill.next_level)}
            badge={<FluencyBadge level={skill.fluency_level} size="sm" />}
          />
        )) ?? []);

  const nextToStrengthenItems =
    gaps?.function_gaps.slice(0, 3).map((skill) => (
      <SnapshotItem
        key={skill.skill_slug}
        title={skill.skill_name}
        subtitle={skill.domain_name}
      />
    )) ?? [];

  return (
    <Card className="p-5 sm:p-6">
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-[var(--sg-shell-900)]">
            Capability Snapshot
          </h2>
          <p className="text-sm leading-6 text-[var(--sg-shell-500)]">
            What is already strong, and what is moving now.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <SnapshotColumn
            title="Strongest in"
            items={strongestItems}
            emptyCopy="Complete a mission to start surfacing your strongest areas."
          />
          <SnapshotColumn
            title="Growing now"
            items={growthItems}
            emptyCopy="As you finish more missions, this will show the capabilities that are moving."
          />
        </div>

        {nextToStrengthenItems.length > 0 ? (
          <div className="space-y-3 border-t border-[var(--sg-shell-border)] pt-4">
            <h3 className="text-sm font-semibold text-[var(--sg-shell-900)]">
              Next to strengthen
            </h3>
            <div className="grid gap-2 lg:grid-cols-3">
              {nextToStrengthenItems}
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
