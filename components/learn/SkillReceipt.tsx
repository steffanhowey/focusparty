"use client";

/**
 * SkillReceipt — displays the capability movement captured after mission completion.
 *
 * Design principles:
 * - Grayscale base, color only for level-ups and fluency indicators
 * - Professional tone — present strengthening and movement, not badges
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
          <span className="text-sm font-medium text-shell-900 truncate">
            {skill.name}
          </span>
          {relevance === "primary" && (
            <span className="text-[10px] px-1 py-px rounded bg-shell-100 text-shell-500 uppercase tracking-wider font-medium shrink-0">
              Primary
            </span>
          )}
        </div>
        <span className="text-xs text-shell-500">
          {skill.domain_name}
        </span>
      </div>

      {/* Fluency progression (right) */}
      <div className="flex items-center gap-2 shrink-0">
        <FluencyBadge level={before.fluency_level} size="sm" />
        <ArrowRight
          size={12}
          className="text-shell-500"
        />
        <div className="relative">
          <FluencyBadge level={after.fluency_level} />
          {leveled_up && (
            <span
              className="absolute -top-1 -right-1 animate-pulse"
              style={{ color: "var(--sg-gold-600)" }}
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
  title?: string;
  subtitle?: string | null;
  showFirstReceiptNote?: boolean;
  className?: string;
}

export function SkillReceipt({
  receipt,
  title = "What This Strengthened",
  subtitle = null,
  showFirstReceiptNote = true,
  className = "",
}: SkillReceiptProps) {
  const { skills, is_first_receipt } = receipt;

  if (skills.length === 0) return null;

  const hasLevelUp = skills.some((s) => s.leveled_up);

  return (
    <div
      className={`w-full max-w-md animate-fade-in ${className}`}
      style={{ animationDelay: "400ms", animationFillMode: "backwards" }}
    >
      <Card className="overflow-hidden">
        {/* Accent bar — uses forest-300 for level-up, default border otherwise */}
        <div
          className="h-0.5"
          style={{
            background: hasLevelUp
              ? "linear-gradient(to right, var(--sg-forest-300), var(--sg-gold-600))"
              : "var(--sg-shell-border)",
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
                    ? "var(--sg-forest-300)"
                    : "var(--sg-shell-500)",
                }}
              />
              <h3 className="text-sm font-semibold text-shell-900">
                {title}
              </h3>
            </div>
            {hasLevelUp && (
              <span
                className="text-[10px] font-semibold uppercase tracking-widest animate-fade-in"
                style={{
                  color: "var(--sg-gold-600)",
                  animationDelay: "800ms",
                }}
              >
                Strengthened
              </span>
            )}
          </div>

          {/* Context copy */}
          {subtitle ? (
            <p
              className="text-xs text-shell-500 animate-fade-in"
              style={{
                animationDelay: "500ms",
                animationFillMode: "backwards",
              }}
            >
              {subtitle}
            </p>
          ) : showFirstReceiptNote && is_first_receipt ? (
            <p
              className="text-xs text-shell-500 animate-fade-in"
              style={{
                animationDelay: "500ms",
                animationFillMode: "backwards",
              }}
            >
              Your capability record is starting to take shape.
            </p>
          ) : null}

          {/* Divider */}
          <div
            className="h-px !mt-3"
            style={{ background: "var(--sg-shell-border)" }}
          />

          {/* Skill rows */}
          <div className="divide-y divide-shell-border">
            {skills.map((entry, i) => (
              <SkillRow key={entry.skill.slug} entry={entry} index={i} />
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
