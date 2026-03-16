"use client";

/**
 * SkillReceipt — displays skills developed after path completion.
 *
 * Design principles:
 * - Grayscale base, color only for level-ups and fluency indicators
 * - Professional tone — this is a credential, not a game achievement
 * - Staggered animations for each skill row
 * - Responsive: stacks cleanly on mobile
 */

import { Card } from "@/components/ui/Card";
import { FluencyBadge } from "@/components/skills/FluencyBadge";
import type {
  SkillReceipt as SkillReceiptType,
  SkillReceiptEntry,
} from "@/lib/types/skills";
import { ArrowRight, Sparkles, TrendingUp } from "lucide-react";

// ─── Skill Row ──────────────────────────────────────────────

function SkillRow({
  entry,
  index,
}: {
  entry: SkillReceiptEntry;
  index: number;
}) {
  const { skill, before, after, leveled_up, relevance } = entry;

  return (
    <div
      className="flex items-center gap-3 py-3 animate-fade-in"
      style={{
        animationDelay: `${600 + index * 120}ms`,
        animationFillMode: "backwards",
      }}
    >
      {/* Skill info (left) */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
            {skill.name}
          </span>
          {relevance === "primary" && (
            <span className="text-[10px] px-1 py-px rounded bg-[var(--color-bg-hover)] text-[var(--color-text-tertiary)] uppercase tracking-wider font-medium shrink-0">
              Primary
            </span>
          )}
        </div>
        <span className="text-xs text-[var(--color-text-tertiary)]">
          {skill.domain_name}
        </span>
      </div>

      {/* Fluency progression (right) */}
      <div className="flex items-center gap-2 shrink-0">
        <FluencyBadge level={before.fluency_level} size="sm" />
        <ArrowRight
          size={12}
          className="text-[var(--color-text-tertiary)]"
        />
        <div className="relative">
          <FluencyBadge level={after.fluency_level} />
          {leveled_up && (
            <span
              className="absolute -top-1 -right-1 animate-pulse"
              style={{ color: "var(--color-gold-700)" }}
            >
              <Sparkles size={10} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────

interface SkillReceiptProps {
  receipt: SkillReceiptType;
}

export function SkillReceipt({ receipt }: SkillReceiptProps) {
  const { skills, is_first_receipt } = receipt;

  if (skills.length === 0) return null;

  const hasLevelUp = skills.some((s) => s.leveled_up);

  return (
    <div
      className="w-full max-w-md animate-fade-in"
      style={{ animationDelay: "400ms", animationFillMode: "backwards" }}
    >
      <Card className="overflow-hidden">
        {/* Accent bar — uses green for level-up, default accent otherwise */}
        <div
          className="h-0.5"
          style={{
            background: hasLevelUp
              ? "linear-gradient(to right, var(--color-green-700), var(--color-gold-700))"
              : "var(--color-border-default)",
          }}
        />

        <div className="p-5 space-y-1">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp
                size={14}
                style={{
                  color: hasLevelUp
                    ? "var(--color-green-700)"
                    : "var(--color-text-tertiary)",
                }}
              />
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Skills Developed
              </h3>
            </div>
            {hasLevelUp && (
              <span
                className="text-[10px] font-semibold uppercase tracking-widest animate-fade-in"
                style={{
                  color: "var(--color-gold-700)",
                  animationDelay: "800ms",
                }}
              >
                Level Up
              </span>
            )}
          </div>

          {/* First receipt message */}
          {is_first_receipt && (
            <p
              className="text-xs text-[var(--color-text-tertiary)] animate-fade-in"
              style={{
                animationDelay: "500ms",
                animationFillMode: "backwards",
              }}
            >
              Your skill profile is starting to take shape.
            </p>
          )}

          {/* Divider */}
          <div
            className="h-px !mt-3"
            style={{ background: "var(--color-border-default)" }}
          />

          {/* Skill rows */}
          <div className="divide-y divide-[var(--color-border-default)]">
            {skills.map((entry, i) => (
              <SkillRow key={entry.skill.slug} entry={entry} index={i} />
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
