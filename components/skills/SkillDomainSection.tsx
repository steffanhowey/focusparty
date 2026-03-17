"use client";

/**
 * Collapsible domain section with progress bar.
 * Auto-expanded if domain has active skills, collapsed otherwise.
 */

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { SkillCard } from "./SkillCard";
import type { SkillProfileDomain } from "@/lib/useSkillProfile";
import type { SkillMarketState } from "@/lib/types/intelligence";

interface SkillDomainSectionProps {
  domain: SkillProfileDomain;
  index: number;
  onNavigate?: (href: string) => void;
  marketStates?: Map<string, SkillMarketState>;
}

export function SkillDomainSection({ domain, index, onNavigate, marketStates }: SkillDomainSectionProps) {
  const hasActive = domain.active_count > 0;
  const [isOpen, setIsOpen] = useState(hasActive);
  const progressPct = domain.total_count > 0
    ? Math.round((domain.active_count / domain.total_count) * 100)
    : 0;

  return (
    <div
      className="animate-fade-in"
      style={{
        animationDelay: `${index * 80}ms`,
        animationFillMode: "backwards",
      }}
    >
      {/* Header */}
      <button
        type="button"
        className="flex w-full items-center gap-3 py-3 text-left"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className="text-lg">{domain.domain.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--sg-shell-900)] truncate">
              {domain.domain.name}
            </span>
            <span className="text-xs text-[var(--sg-shell-500)] shrink-0">
              {domain.active_count}/{domain.total_count}
            </span>
          </div>
          {/* Mini progress bar */}
          <div className="mt-1 h-1 w-full rounded-full overflow-hidden bg-[var(--sg-shell-200)]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPct}%`,
                background: hasActive
                  ? "var(--sg-forest-500)"
                  : "transparent",
              }}
            />
          </div>
        </div>
        <ChevronDown
          size={16}
          className="shrink-0 text-[var(--sg-shell-400)] transition-transform duration-200"
          style={{
            transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)",
          }}
        />
      </button>

      {/* Content */}
      {isOpen && (
        <div className="grid grid-cols-1 gap-2 pb-4 sm:grid-cols-2 lg:grid-cols-3">
          {domain.skills.map((skill) => (
            <SkillCard
              key={skill.skill.slug}
              skill={skill}
              onNavigate={onNavigate}
              marketState={marketStates?.get(skill.skill.slug) ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
