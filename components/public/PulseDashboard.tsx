"use client";

/**
 * Skills Pulse Dashboard — real-time AI skills intelligence.
 *
 * Sections:
 * 1. Summary cards (total skills, rising, emerging, practitioners)
 * 2. Skills table (sortable by heat, direction, practitioners, gap)
 * 3. Latest insights
 */

import { useState, useMemo } from "react";
import { TrendingUp, TrendingDown, Sparkles, Minus, ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { SkillMarketState, SkillIntelligence } from "@/lib/types/intelligence";

// ─── Direction helpers ────────────────────────────────────

const DIRECTION_CONFIG: Record<
  string,
  { icon: typeof TrendingUp; color: string; label: string }
> = {
  rising: { icon: TrendingUp, color: "var(--sg-forest-400)", label: "Rising" },
  emerging: { icon: Sparkles, color: "var(--sg-teal-500)", label: "Emerging" },
  declining: { icon: TrendingDown, color: "var(--sg-gold-600)", label: "Declining" },
  stable: { icon: Minus, color: "var(--sg-shell-500)", label: "Stable" },
};

// ─── Sort ────────────────────────────────────────────────

type SortKey = "heat" | "direction" | "practitioners" | "gap" | "velocity";

function formatSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ─── Component ───────────────────────────────────────────

interface PulseDashboardProps {
  states: SkillMarketState[];
  insights: SkillIntelligence[];
  lastUpdated: string | null;
}

export function PulseDashboard({
  states,
  insights,
  lastUpdated,
}: PulseDashboardProps) {
  const [sortKey, setSortKey] = useState<SortKey>("heat");
  const [sortAsc, setSortAsc] = useState(false);

  // Summary stats
  const risingCount = states.filter((s) => s.direction === "rising").length;
  const emergingCount = states.filter((s) => s.direction === "emerging").length;
  const totalPractitioners = states.reduce(
    (sum, s) => sum + s.practitioner_count,
    0
  );

  // Sorted skills
  const sorted = useMemo(() => {
    const copy = [...states];
    copy.sort((a, b) => {
      let va: number, vb: number;
      switch (sortKey) {
        case "heat":
          va = a.heat_score;
          vb = b.heat_score;
          break;
        case "velocity":
          va = a.velocity;
          vb = b.velocity;
          break;
        case "practitioners":
          va = a.practitioner_count;
          vb = b.practitioner_count;
          break;
        case "gap":
          va = a.demand_supply_gap;
          vb = b.demand_supply_gap;
          break;
        case "direction":
          va = a.direction === "rising" ? 3 : a.direction === "emerging" ? 2 : a.direction === "stable" ? 1 : 0;
          vb = b.direction === "rising" ? 3 : b.direction === "emerging" ? 2 : b.direction === "stable" ? 1 : 0;
          break;
        default:
          va = 0;
          vb = 0;
      }
      return sortAsc ? va - vb : vb - va;
    });
    return copy;
  }, [states, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const SortHeader = ({
    label,
    sortKeyValue,
    className,
  }: {
    label: string;
    sortKeyValue: SortKey;
    className?: string;
  }) => (
    <button
      type="button"
      onClick={() => handleSort(sortKeyValue)}
      className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider cursor-pointer text-[var(--sg-shell-500)] ${className ?? ""}`}
    >
      {label}
      {sortKey === sortKeyValue && (
        <ChevronDown
          size={10}
          style={{
            transform: sortAsc ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 200ms",
          }}
        />
      )}
    </button>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-[var(--sg-shell-900)] md:text-3xl">
          AI Skills Pulse
        </h1>
        <p className="text-sm text-[var(--sg-shell-500)]">
          Live market intelligence on AI skill demand, practitioner growth, and
          emerging capabilities.
          {lastUpdated && (
            <span className="ml-2">
              Last updated:{" "}
              {new Date(lastUpdated).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          )}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="p-4 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--sg-shell-500)]">
            Skills Tracked
          </p>
          <p className="text-2xl font-bold text-[var(--sg-shell-900)]">
            {states.length}
          </p>
        </Card>
        <Card className="p-4 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--sg-shell-500)]">
            Rising
          </p>
          <p
            className="text-2xl font-bold"
            style={{ color: "var(--sg-forest-400)" }}
          >
            {risingCount}
          </p>
        </Card>
        <Card className="p-4 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--sg-shell-500)]">
            Emerging
          </p>
          <p
            className="text-2xl font-bold"
            style={{ color: "var(--sg-teal-500)" }}
          >
            {emergingCount}
          </p>
        </Card>
        <Card className="p-4 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--sg-shell-500)]">
            Practitioners
          </p>
          <p className="text-2xl font-bold text-[var(--sg-shell-900)]">
            {totalPractitioners.toLocaleString()}
          </p>
        </Card>
      </div>

      {/* Skills table */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--sg-shell-900)]">
          All Skills
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--sg-shell-border)]">
                <th className="text-left py-2 pr-4">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--sg-shell-500)]">
                    Skill
                  </span>
                </th>
                <th className="text-left py-2 pr-4">
                  <SortHeader label="Direction" sortKeyValue="direction" />
                </th>
                <th className="text-right py-2 pr-4">
                  <SortHeader label="Heat" sortKeyValue="heat" className="justify-end" />
                </th>
                <th className="text-right py-2 pr-4 hidden sm:table-cell">
                  <SortHeader label="Velocity" sortKeyValue="velocity" className="justify-end" />
                </th>
                <th className="text-right py-2 pr-4">
                  <SortHeader label="Practitioners" sortKeyValue="practitioners" className="justify-end" />
                </th>
                <th className="text-right py-2 hidden md:table-cell">
                  <SortHeader label="Gap" sortKeyValue="gap" className="justify-end" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => {
                const dir = DIRECTION_CONFIG[s.direction] ?? DIRECTION_CONFIG.stable;
                const DirIcon = dir.icon;
                return (
                  <tr
                    key={s.skill_slug}
                    className="border-b border-[var(--sg-shell-border)] last:border-0 transition-colors hover:bg-[var(--sg-shell-50)]"
                  >
                    <td className="py-2.5 pr-4">
                      <a
                        href={`/skills/${s.skill_slug}`}
                        className="font-medium text-[var(--sg-shell-900)] hover:underline"
                      >
                        {formatSlug(s.skill_slug)}
                      </a>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span
                        className="inline-flex items-center gap-1 text-xs"
                        style={{ color: dir.color }}
                      >
                        <DirIcon size={12} />
                        {dir.label}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-right text-[var(--sg-shell-600)]">
                      {s.heat_score.toFixed(2)}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-[var(--sg-shell-600)] hidden sm:table-cell">
                      {s.velocity > 0 ? "+" : ""}
                      {s.velocity.toFixed(2)}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-[var(--sg-shell-600)]">
                      {s.practitioner_count.toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right text-[var(--sg-shell-600)] hidden md:table-cell">
                      {s.demand_supply_gap > 0 ? "+" : ""}
                      {s.demand_supply_gap.toFixed(1)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Latest insights */}
      {insights.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--sg-shell-900)]">
            Latest Intelligence
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {insights.slice(0, 6).map((insight) => (
              <Card key={insight.id} className="p-4 space-y-2">
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--sg-teal-500)" }}
                >
                  {insight.insight_type.replace(/_/g, " ")}
                </span>
                <h4 className="text-sm font-medium text-[var(--sg-shell-900)] leading-snug">
                  {insight.headline}
                </h4>
                <p className="text-xs text-[var(--sg-shell-500)] line-clamp-3">
                  {insight.analysis}
                </p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="text-center py-8 space-y-3">
        <p className="text-sm text-[var(--sg-shell-500)]">
          Start closing your skill gap today.
        </p>
        <a
          href="/learn"
          className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:opacity-90"
          style={{ background: "var(--sg-forest-500)" }}
        >
          Start Learning
        </a>
      </div>
    </div>
  );
}
