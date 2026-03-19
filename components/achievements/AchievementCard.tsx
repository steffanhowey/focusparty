import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import {
  formatAchievementDate,
  formatAchievementDuration,
  getAchievementHighlightedSkills,
  getAchievementLevelUpCount,
} from "@/lib/achievements/achievementModel";
import type { SkillReceipt } from "@/lib/types";

interface AchievementCardProps {
  pathTitle: string;
  pathTopics: string[];
  itemsCompleted: number;
  timeInvestedSeconds: number;
  completedAt: string;
  skillReceipt?: SkillReceipt | null;
  variant?: "celebration" | "public";
  className?: string;
}

export function AchievementCard({
  pathTitle,
  pathTopics,
  itemsCompleted,
  timeInvestedSeconds,
  completedAt,
  skillReceipt,
  variant = "celebration",
  className = "",
}: AchievementCardProps) {
  const highlightedSkills = getAchievementHighlightedSkills(skillReceipt);
  const levelUpCount = getAchievementLevelUpCount(skillReceipt);
  const accentGradient =
    levelUpCount > 0
      ? "linear-gradient(to right, var(--sg-forest-500), var(--sg-gold-600))"
      : "linear-gradient(to right, var(--sg-forest-500), var(--sg-teal-600))";

  return (
    <Card
      className={`w-full max-w-xl overflow-hidden rounded-[var(--sg-radius-xl)] border border-shell-border ${className}`}
      style={{
        background:
          variant === "public"
            ? "linear-gradient(160deg, var(--sg-cream-50) 0%, var(--sg-white) 44%, var(--sg-sage-50) 100%)"
            : "linear-gradient(160deg, var(--sg-shell-white) 0%, var(--sg-cream-50) 56%, var(--sg-sage-50) 100%)",
        boxShadow: "var(--shadow-float)",
      }}
    >
      <div className="h-1.5" style={{ background: accentGradient }} />

      <div className="p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.24em]"
              style={{ color: "var(--sg-forest-500)" }}
            >
              {variant === "public" ? "SkillGap Credential" : "Credential Ready"}
            </p>
            <h2
              className="text-[1.6rem] leading-[1.12] text-shell-900 sm:text-[1.9rem]"
              style={{
                fontFamily: "var(--font-display), 'Fraunces', Georgia, serif",
              }}
            >
              {pathTitle}
            </h2>
          </div>

          {levelUpCount > 0 && (
            <div
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{
                color: "var(--sg-gold-900)",
                background: "var(--sg-gold-100)",
                border: "1px solid var(--sg-gold-300)",
              }}
            >
              <Sparkles size={12} />
              {levelUpCount} level up{levelUpCount > 1 ? "s" : ""}
            </div>
          )}
        </div>

        {highlightedSkills.length > 0 && (
          <div className="mt-5 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-shell-500">
              Skills Demonstrated
            </p>
            <div className="flex flex-wrap gap-2">
              {highlightedSkills.map((skillName) => (
                <span
                  key={skillName}
                  className="rounded-full px-3 py-1 text-xs font-medium"
                  style={{
                    color: "var(--sg-shell-700)",
                    background: "var(--sg-white)",
                    border: "1px solid var(--sg-shell-border)",
                  }}
                >
                  {skillName}
                </span>
              ))}
            </div>
          </div>
        )}

        <div
          className="mt-5 h-px"
          style={{ background: "var(--sg-shell-border)" }}
        />

        <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-shell-500">
              Resources
            </p>
            <p className="mt-1 text-base font-medium text-shell-900">
              {itemsCompleted} completed
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-shell-500">
              Time Invested
            </p>
            <p className="mt-1 text-base font-medium text-shell-900">
              {formatAchievementDuration(timeInvestedSeconds)}
            </p>
          </div>
        </div>

        {pathTopics.length > 0 && (
          <div className="mt-5 space-y-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-shell-500">
              Topics Covered
            </p>
            <div className="flex flex-wrap gap-2">
              {pathTopics.slice(0, 5).map((topic) => (
                <span
                  key={topic}
                  className="rounded-full px-3 py-1 text-xs"
                  style={{
                    color: "var(--sg-shell-600)",
                    background: "var(--sg-sage-100)",
                  }}
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <span className="text-xs text-shell-500">
            Completed {formatAchievementDate(completedAt)}
          </span>
          <span className="text-xs font-medium text-shell-500">
            SkillGap.ai
          </span>
        </div>
      </div>
    </Card>
  );
}
