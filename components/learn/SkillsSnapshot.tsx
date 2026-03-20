"use client";

/**
 * Compact capability snapshot card shown on mission-focused surfaces.
 * Displays the user's top active skills with fluency badges.
 */

import Link from "next/link";
import { useSkillProfile } from "@/lib/useSkillProfile";
import { FluencyBadge } from "@/components/skills/FluencyBadge";
import { TrendingUp } from "lucide-react";
import { formatMissionUnit } from "@/lib/missionLanguage";
import type { SkillFluency } from "@/lib/types/skills";

export function SkillsSnapshot() {
  const { domains, summary, isLoading } = useSkillProfile();

  // Don't render if loading or user has no skills yet
  if (isLoading || !summary || summary.total_skills_started === 0) {
    return null;
  }

  // Collect all active skills across domains, sorted by fluency desc
  const activeSkills = domains
    .flatMap((d) =>
      d.skills
        .filter((s) => s.progress)
        .map((s) => ({
          name: s.skill.name,
          fluency: s.progress!.fluency_level,
          paths: s.progress!.paths_completed,
          domainIcon: d.domain.icon,
        })),
    )
    .sort((a, b) => {
      const order: Record<SkillFluency, number> = {
        advanced: 3,
        proficient: 2,
        practicing: 1,
        exploring: 0,
      };
      return order[b.fluency] - order[a.fluency];
    })
    .slice(0, 3);

  if (activeSkills.length === 0) return null;

  return (
    <section className="rounded-lg border border-shell-border bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp
            size={14}
            className="text-shell-500"
          />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-shell-500">
            Capability Snapshot
          </h3>
        </div>
        <Link
          href="/progress"
          className="text-xs font-medium hover:underline"
          style={{ color: "var(--sg-forest-500)" }}
        >
          Open progress
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        {activeSkills.map((skill) => (
          <div
            key={skill.name}
            className="flex items-center justify-between"
          >
            <span className="text-sm text-shell-800 truncate mr-3">
              {skill.name}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-shell-500">
                {formatMissionUnit(skill.paths)}
              </span>
              <FluencyBadge level={skill.fluency} size="sm" />
            </div>
          </div>
        ))}
      </div>

      {summary.total_paths_completed > 0 && (
        <div className="mt-3 pt-3 border-t border-shell-200 text-xs text-shell-500">
          {formatMissionUnit(summary.total_paths_completed)} completed across {summary.total_skills_started} skills
        </div>
      )}
    </section>
  );
}
