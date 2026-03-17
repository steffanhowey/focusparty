"use client";

/**
 * Reusable fluency level badge.
 * Color = achievement state. Each fluency level maps to a semantic color.
 */

import { fluencyLabel } from "@/lib/skills/assessment";
import type { SkillFluency } from "@/lib/types/skills";

const FLUENCY_COLORS: Record<SkillFluency, string> = {
  exploring: "var(--sg-sage-500)",
  practicing: "var(--sg-teal-500)",
  proficient: "var(--sg-forest-400)",
  advanced: "var(--sg-gold-600)",
};

interface FluencyBadgeProps {
  level: SkillFluency;
  size?: "sm" | "default" | "lg";
}

export function FluencyBadge({ level, size = "default" }: FluencyBadgeProps) {
  const color = FLUENCY_COLORS[level];
  const label = fluencyLabel(level);

  const sizeClasses: Record<string, string> = {
    sm: "text-[10px] px-1.5 py-0.5",
    default: "text-xs px-2 py-0.5",
    lg: "text-xs px-2.5 py-1",
  };

  return (
    <span
      className={`${sizeClasses[size]} rounded-full font-medium inline-flex items-center`}
      style={{
        color,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
      }}
    >
      {label}
    </span>
  );
}
