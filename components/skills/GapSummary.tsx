"use client";

/**
 * Skill gap summary for the Skills profile page.
 *
 * Three sections:
 * 1. Strongest Skills — identity/pride signal ("this is what you're good at")
 * 2. Closing Now — skills actively progressing toward next level
 * 3. Gaps for Your Role — function-relevant skills not yet started
 */

import { FluencyBadge } from "@/components/skills/FluencyBadge";
import {
  Trophy,
  TrendingUp,
  Target,
  ArrowRight,
} from "lucide-react";
import type {
  SkillGaps,
} from "@/lib/useSkillProfile";
import { getMissionSearchRoute } from "@/lib/appRoutes";

interface GapSummaryProps {
  gaps: SkillGaps;
}

export function GapSummary({ gaps }: GapSummaryProps) {
  const { strongest, active_progression, function_gaps, user_function } = gaps;

  // Don't render if there's nothing to show
  if (
    strongest.length === 0 &&
    active_progression.length === 0 &&
    function_gaps.length === 0
  ) {
    return null;
  }

  const fnLabel = user_function
    ? user_function.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : null;

  return (
    <div className="space-y-5">
      {/* Strongest skills */}
      {strongest.length > 0 && (
        <section>
          <div className="flex items-center gap-1.5 mb-2.5">
            <Trophy size={13} style={{ color: "var(--sg-gold-600)" }} />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-shell-500">
              Strongest
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {strongest.map((s) => (
              <div
                key={s.skill_slug}
                className="flex items-center gap-2 rounded-md border border-shell-border bg-white px-3 py-1.5"
              >
                <span className="text-sm text-shell-800">
                  {s.skill_name}
                </span>
                <FluencyBadge level={s.fluency_level} size="sm" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active progression */}
      {active_progression.length > 0 && (
        <section>
          <div className="flex items-center gap-1.5 mb-2.5">
            <TrendingUp size={13} style={{ color: "var(--sg-forest-400)" }} />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-shell-500">
              Closing Now
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {active_progression.map((p) => (
              <div
                key={p.skill_slug}
                className="flex items-center justify-between rounded-md border border-shell-border bg-white px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FluencyBadge level={p.fluency_level} size="sm" />
                  <span className="text-sm text-shell-800 truncate">
                    {p.skill_name}
                  </span>
                </div>
                <span
                  className="text-xs font-medium shrink-0 ml-2"
                  style={{ color: "var(--sg-forest-500)" }}
                >
                  {p.paths_to_next} to {p.next_level}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Function gaps */}
      {function_gaps.length > 0 && fnLabel && (
        <section>
          <div className="flex items-center gap-1.5 mb-2.5">
            <Target size={13} style={{ color: "var(--sg-teal-600)" }} />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-shell-500">
              Gaps for {fnLabel}
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {function_gaps.map((g) => (
              <a
                key={g.skill_slug}
                href={getMissionSearchRoute(g.skill_name)}
                className="flex items-center gap-1.5 rounded-md border border-dashed border-shell-300 px-3 py-1.5 text-sm text-shell-500 hover:text-shell-700 hover:border-shell-400 transition-colors"
              >
                {g.skill_name}
                <ArrowRight size={11} className="opacity-40" />
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
