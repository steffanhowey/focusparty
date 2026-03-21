"use client";

import { CheckCircle2, Layers3 } from "lucide-react";
import type { AchievementSummary } from "@/lib/types";
import type { SkillReceipt } from "@/lib/types/skills";
import {
  formatEvidenceDuration,
  formatEvidenceShortDate,
  getEvidencePreviewTheme,
  getEvidencePreviewTitle,
  getEvidenceSupportLine,
  getEvidenceTopics,
} from "@/lib/evidencePresentation";

interface EvidencePreviewProps {
  achievement: AchievementSummary;
  receipt?: SkillReceipt | null;
  compact?: boolean;
  className?: string;
}

export function EvidencePreview({
  achievement,
  receipt = null,
  compact = false,
  className = "",
}: EvidencePreviewProps) {
  const theme = getEvidencePreviewTheme(achievement.path_title);
  const title = getEvidencePreviewTitle(achievement, receipt);
  const supportLine = getEvidenceSupportLine(achievement, receipt);
  const previewTopics = getEvidenceTopics(achievement, receipt, compact ? 2 : 3);

  return (
    <div
      className={`relative overflow-hidden rounded-[var(--sg-radius-lg)] border border-[var(--sg-shell-border)] ${compact ? "min-h-[150px] p-4" : "min-h-[220px] p-5 sm:p-6"} ${className}`.trim()}
      style={{ background: theme.surface }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(color-mix(in srgb, var(--sg-shell-300) 20%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--sg-shell-300) 18%, transparent) 1px, transparent 1px)",
          backgroundSize: compact ? "18px 18px" : "22px 22px",
          opacity: 0.45,
        }}
      />

      <div
        className={`pointer-events-none absolute ${compact ? "right-3 top-3 h-20 w-24" : "right-5 top-5 h-32 w-36"} hidden sm:block`}
      >
        <div
          className="absolute right-1 top-0 h-[62%] w-[72%] rounded-[1rem] border"
          style={{
            background:
              "color-mix(in srgb, var(--sg-white) 82%, transparent)",
            borderColor: "color-mix(in srgb, var(--sg-shell-border) 76%, transparent)",
            transform: "rotate(6deg)",
          }}
        />
        <div
          className="absolute right-6 top-3 h-[68%] w-[76%] rounded-[1rem] border"
          style={{
            background:
              "color-mix(in srgb, var(--sg-white) 88%, transparent)",
            borderColor: "color-mix(in srgb, var(--sg-shell-border) 72%, transparent)",
            transform: "rotate(-4deg)",
          }}
        />
        <div
          className="absolute bottom-0 left-0 h-[70%] w-[82%] rounded-[1rem] border"
          style={{
            background:
              "color-mix(in srgb, var(--sg-white) 94%, transparent)",
            borderColor: "color-mix(in srgb, var(--sg-shell-border) 82%, transparent)",
          }}
        >
          <div className="space-y-2 px-3 py-3">
            <div
              className="h-2 rounded-full"
              style={{ background: theme.accent, opacity: 0.8 }}
            />
            <div
              className="h-2 w-4/5 rounded-full"
              style={{
                background:
                  "color-mix(in srgb, var(--sg-shell-500) 24%, transparent)",
              }}
            />
            <div
              className="h-2 w-3/5 rounded-full"
              style={{
                background:
                  "color-mix(in srgb, var(--sg-shell-500) 18%, transparent)",
              }}
            />
          </div>
        </div>
      </div>

      <div className="relative flex h-full flex-col justify-between gap-5">
        <div className="flex items-center justify-between gap-3">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{
              background: theme.chipSurface,
              color: theme.accent,
            }}
          >
            <CheckCircle2 size={12} />
            Proof of work
          </span>

          {!compact ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-[var(--sg-shell-600)]">
              <Layers3 size={13} />
              Mission artifact
            </span>
          ) : null}
        </div>

        <div className="max-w-full space-y-3 pr-8 sm:max-w-[70%] sm:pr-0">
          <div className="space-y-1.5">
            <p
              className={`${compact ? "text-xl" : "text-[1.9rem]"} font-semibold leading-[1.02] text-[var(--sg-shell-900)]`}
              style={{
                fontFamily:
                  "var(--font-display), 'Fraunces', Georgia, serif",
              }}
            >
              {title}
            </p>
            <p className="text-sm leading-6 text-[var(--sg-shell-600)]">
              {supportLine}
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {previewTopics.map((topic) => (
              <span
                key={topic}
                className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium"
                style={{
                  background: theme.chipSurface,
                  color: theme.chipText,
                }}
              >
                {topic}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--sg-shell-600)]">
          <span className="font-medium text-[var(--sg-shell-800)]">
            {achievement.path_title}
          </span>
          <span className="text-[var(--sg-shell-300)]">•</span>
          <span>{formatEvidenceShortDate(achievement.completed_at)}</span>
          <span className="text-[var(--sg-shell-300)]">•</span>
          <span>
            {achievement.items_completed}{" "}
            {achievement.items_completed === 1 ? "step" : "steps"}
          </span>
          <span className="text-[var(--sg-shell-300)]">•</span>
          <span>{formatEvidenceDuration(achievement.time_invested_seconds)}</span>
        </div>
      </div>
    </div>
  );
}
