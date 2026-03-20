"use client";

/**
 * Achievement history section for the Skills profile page.
 *
 * Renders recent completed paths with their skill receipts inline,
 * giving users a durable, browsable record of their growth.
 */

import { useState } from "react";
import {
  Award,
  ChevronDown,
  Clock,
  ExternalLink,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { FluencyBadge } from "@/components/skills/FluencyBadge";
import type { ProfileAchievement } from "@/lib/useSkillProfile";
import { getProgressEvidenceRoute } from "@/lib/appRoutes";

interface AchievementHistoryProps {
  achievements: ProfileAchievement[];
}

/** Format seconds as "Xh Ym" or "Xm". */
function formatTime(seconds: number): string {
  if (seconds < 60) return "<1m";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Format ISO date as "Mar 18, 2026". */
function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function AchievementHistory({ achievements }: AchievementHistoryProps) {
  if (achievements.length === 0) return null;

  return (
    <section>
      <div className="flex items-center gap-1.5 mb-3">
        <Award size={13} style={{ color: "var(--sg-forest-500)" }} />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--sg-shell-500)]">
          Recent Evidence
        </h3>
      </div>

      <div className="space-y-2">
        {achievements.map((a) => (
          <AchievementRow key={a.id} achievement={a} />
        ))}
      </div>
    </section>
  );
}

// ─── Single achievement row ──────────────────────────────────

function AchievementRow({ achievement }: { achievement: ProfileAchievement }) {
  const [isOpen, setIsOpen] = useState(false);
  const receipt = achievement.skill_receipt;
  const hasReceipt = receipt && receipt.skills && receipt.skills.length > 0;
  const levelUps = hasReceipt
    ? receipt.skills.filter((s) => s.leveled_up).length
    : 0;

  return (
    <div
      className="rounded-lg border overflow-hidden transition-colors"
      style={{
        borderColor: "var(--sg-shell-border)",
        background: "var(--sg-white)",
      }}
    >
      {/* Header — always visible */}
      <button
        type="button"
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--sg-shell-50)] transition-colors"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {/* Left: title and meta */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--sg-shell-900)] truncate">
            {achievement.path_title || "Completed Mission"}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-[var(--sg-shell-500)]">
              {formatDate(achievement.completed_at)}
            </span>
            <span className="text-xs text-[var(--sg-shell-300)]">·</span>
            <span className="flex items-center gap-0.5 text-xs text-[var(--sg-shell-500)]">
              <Clock size={10} />
              {formatTime(achievement.time_invested_seconds)}
            </span>
            {levelUps > 0 && (
              <>
                <span className="text-xs text-[var(--sg-shell-300)]">·</span>
                <span
                  className="flex items-center gap-0.5 text-xs font-medium"
                  style={{ color: "var(--sg-gold-600)" }}
                >
                  <Sparkles size={10} />
                  {levelUps} level-up{levelUps > 1 ? "s" : ""}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right: expand + share */}
        <div className="flex items-center gap-2 shrink-0">
          {achievement.share_slug && (
            <a
              href={getProgressEvidenceRoute(achievement.share_slug)}
              onClick={(e) => e.stopPropagation()}
              className="text-[var(--sg-shell-400)] hover:text-[var(--sg-shell-600)] transition-colors"
              title="View evidence page"
            >
              <ExternalLink size={14} />
            </a>
          )}
          {hasReceipt && (
            <ChevronDown
              size={14}
              className="text-[var(--sg-shell-400)] transition-transform duration-200"
              style={{
                transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)",
              }}
            />
          )}
        </div>
      </button>

      {/* Expanded: skill receipt detail */}
      {isOpen && hasReceipt && (
        <div
          className="px-3 pb-3 pt-0 border-t"
          style={{ borderColor: "var(--sg-shell-border)" }}
        >
          <div className="space-y-1.5 mt-2.5">
            {receipt.skills.map((entry) => (
              <div
                key={entry.skill.slug}
                className="flex items-center justify-between gap-2 py-1"
              >
                {/* Skill name + domain */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-[var(--sg-shell-800)] truncate">
                    {entry.skill.name}
                  </span>
                  {entry.relevance === "primary" && (
                    <span
                      className="text-[9px] font-semibold uppercase tracking-wider shrink-0 px-1 py-px rounded"
                      style={{
                        color: "var(--sg-forest-500)",
                        background: "var(--sg-sage-100)",
                      }}
                    >
                      primary
                    </span>
                  )}
                </div>

                {/* Before → After */}
                <div className="flex items-center gap-1 shrink-0">
                  <FluencyBadge level={entry.before.fluency_level} size="sm" />
                  <ArrowRight
                    size={10}
                    className="text-[var(--sg-shell-400)]"
                  />
                  <FluencyBadge level={entry.after.fluency_level} size="sm" />
                  {entry.leveled_up && (
                    <Sparkles
                      size={11}
                      style={{ color: "var(--sg-gold-600)" }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
