"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import { FluencyBadge } from "@/components/skills/FluencyBadge";
import type { SkillReceipt } from "@/lib/types/skills";
import {
  getEvidenceFocusSkills,
  getStrengthenedSummary,
} from "@/lib/evidencePresentation";

interface EvidenceStrengthenedSummaryProps {
  receipt: SkillReceipt | null | undefined;
  compact?: boolean;
  className?: string;
}

export function EvidenceStrengthenedSummary({
  receipt,
  compact = false,
  className = "",
}: EvidenceStrengthenedSummaryProps) {
  const focusSkills = getEvidenceFocusSkills(receipt);

  if (focusSkills.length === 0) {
    return (
      <div className={`space-y-2 ${className}`.trim()}>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--sg-shell-500)]">
          <Sparkles size={13} className="text-[var(--sg-gold-600)]" />
          Strengthened in this work
        </div>
        <p className="text-sm leading-6 text-[var(--sg-shell-500)]">
          Capability detail will show up here as more work maps cleanly to
          tracked skills.
        </p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`space-y-3 ${className}`.trim()}>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--sg-shell-500)]">
            <Sparkles size={13} className="text-[var(--sg-gold-600)]" />
            Strengthened in this work
          </div>
          <p className="text-sm leading-6 text-[var(--sg-shell-500)]">
            {getStrengthenedSummary(receipt)}
          </p>
        </div>

        <div className="space-y-2">
          {focusSkills.map((entry) => (
            <div
              key={entry.name}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--sg-radius-btn)] border border-[var(--sg-shell-border)] bg-[var(--sg-white)] px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-[var(--sg-shell-900)]">
                    {entry.name}
                  </p>
                  {entry.relevance === "primary" ? (
                    <span className="inline-flex items-center rounded-full bg-[var(--sg-shell-100)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--sg-shell-500)]">
                      Primary
                    </span>
                  ) : null}
                </div>
                <p className="text-xs leading-5 text-[var(--sg-shell-500)]">
                  {entry.domain}
                </p>
              </div>

              <span className="text-xs font-medium text-[var(--sg-shell-500)]">
                {entry.leveledUp
                  ? `Leveled up to ${entry.afterLevel}`
                  : `Practiced at ${entry.afterLevel}`}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`.trim()}>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--sg-shell-500)]">
          <Sparkles size={13} className="text-[var(--sg-gold-600)]" />
          Strengthened in this work
        </div>
        <p className="text-sm leading-6 text-[var(--sg-shell-500)]">
          {getStrengthenedSummary(receipt)}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {focusSkills.map((entry) => (
          <div
            key={entry.name}
            className="rounded-[var(--sg-radius-lg)] border border-[var(--sg-shell-border)] bg-[var(--sg-white)] px-3 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-[var(--sg-shell-900)]">
                    {entry.name}
                  </p>
                  {entry.relevance === "primary" ? (
                    <span className="inline-flex items-center rounded-full bg-[var(--sg-shell-100)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--sg-shell-500)]">
                      Primary
                    </span>
                  ) : null}
                </div>
                <p className="text-xs leading-5 text-[var(--sg-shell-500)]">
                  {entry.domain}
                </p>
              </div>

              {entry.leveledUp ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--sg-gold-50)] px-2.5 py-1 text-[11px] font-medium text-[var(--sg-gold-600)]">
                  <Sparkles size={11} />
                  Leveled up
                </span>
              ) : (
                <FluencyBadge level={entry.afterLevel} size="sm" />
              )}
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs text-[var(--sg-shell-500)]">
              {entry.leveledUp ? (
                <>
                  <FluencyBadge level={entry.beforeLevel} size="sm" />
                  <ArrowRight size={12} className="text-[var(--sg-shell-400)]" />
                  <FluencyBadge level={entry.afterLevel} size="sm" />
                </>
              ) : (
                <span>Practiced at {entry.afterLevel}.</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
