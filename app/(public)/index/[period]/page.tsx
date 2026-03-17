/**
 * /index/[period] — Monthly AI Skills Index page.
 * Server Component with ISR (1 hour).
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/admin";
import { PublicNav } from "@/components/public/PublicNav";
import { Card } from "@/components/ui/Card";
import { TrendingUp, TrendingDown, Sparkles, Minus } from "lucide-react";
import type { SkillIndexEntry, TrendDirection } from "@/lib/types/intelligence";

export const revalidate = 3600;

// ─── Direction config ──────────────────────────────────────

const DIR_STYLE: Record<TrendDirection, { icon: typeof TrendingUp; color: string }> = {
  rising: { icon: TrendingUp, color: "var(--sg-forest-300)" },
  emerging: { icon: Sparkles, color: "var(--sg-teal-500)" },
  declining: { icon: TrendingDown, color: "var(--sg-gold-600)" },
  stable: { icon: Minus, color: "var(--sg-shell-500)" },
};

// ─── Metadata ──────────────────────────────────────────────

interface PageProps {
  params: Promise<{ period: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { period } = await params;
  return {
    title: `AI Skills Index — ${period} | SkillGap.ai`,
    description: `Monthly AI Skills Index for ${period}. Rankings, key findings, and market intelligence.`,
  };
}

// ─── Page ──────────────────────────────────────────────────

export default async function IndexPeriodPage({ params }: PageProps) {
  const { period } = await params;
  const admin = createClient();

  const { data } = await admin
    .from("fp_skill_index_entries")
    .select("*")
    .eq("period", period)
    .maybeSingle();

  if (!data) notFound();

  const entry: SkillIndexEntry = {
    id: data.id as string,
    period: data.period as string,
    rankings: data.rankings as SkillIndexEntry["rankings"],
    key_findings: data.key_findings as SkillIndexEntry["key_findings"],
    emerging_skills: data.emerging_skills as string[],
    declining_skills: data.declining_skills as string[],
    platform_stats: data.platform_stats as SkillIndexEntry["platform_stats"],
    methodology_version: data.methodology_version as string,
    generated_at: data.generated_at as string,
    published_at: data.published_at as string | null,
  };

  // Load previous periods for navigation
  const { data: allPeriods } = await admin
    .from("fp_skill_index_entries")
    .select("period")
    .order("period", { ascending: false })
    .limit(12);

  const periodOptions = (allPeriods ?? []).map(
    (p: Record<string, unknown>) => p.period as string
  );

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--sg-white)" }}
    >
      <PublicNav />
      <main className="mx-auto max-w-5xl px-4 py-8 md:px-8 space-y-8">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-[var(--sg-shell-900)] md:text-3xl">
            AI Skills Index — {entry.period}
          </h1>
          <p className="text-sm text-[var(--sg-shell-500)]">
            Monthly ranking of AI skills by market demand, velocity, and
            practitioner activity.
          </p>
        </div>

        {/* Platform stats */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card className="p-4 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--sg-shell-500)]">
              Skills Tracked
            </p>
            <p className="text-2xl font-bold text-[var(--sg-shell-900)]">
              {entry.platform_stats.skills_tracked}
            </p>
          </Card>
          <Card className="p-4 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--sg-shell-500)]">
              Practitioners
            </p>
            <p className="text-2xl font-bold text-[var(--sg-shell-900)]">
              {entry.platform_stats.total_practitioners.toLocaleString()}
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
              {entry.emerging_skills.length}
            </p>
          </Card>
          <Card className="p-4 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--sg-shell-500)]">
              Completions
            </p>
            <p className="text-2xl font-bold text-[var(--sg-shell-900)]">
              {entry.platform_stats.total_completions.toLocaleString()}
            </p>
          </Card>
        </div>

        {/* Key findings */}
        {entry.key_findings.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--sg-shell-900)]">
              Key Findings
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {entry.key_findings.map((finding, i) => (
                <Card key={i} className="p-4 space-y-2">
                  <h4 className="text-sm font-medium text-[var(--sg-shell-900)]">
                    {finding.headline}
                  </h4>
                  <p className="text-xs text-[var(--sg-shell-500)]">
                    {finding.analysis}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Rankings table */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--sg-shell-900)]">
            Rankings
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--sg-shell-border)]">
                  <th className="text-left py-2 pr-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--sg-shell-500)]">
                    #
                  </th>
                  <th className="text-left py-2 pr-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--sg-shell-500)]">
                    Skill
                  </th>
                  <th className="text-left py-2 pr-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--sg-shell-500)]">
                    Direction
                  </th>
                  <th className="text-right py-2 pr-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--sg-shell-500)]">
                    Heat
                  </th>
                  <th className="text-right py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--sg-shell-500)] hidden sm:table-cell">
                    Practitioners
                  </th>
                </tr>
              </thead>
              <tbody>
                {entry.rankings.map((r) => {
                  const dir = DIR_STYLE[r.direction] ?? DIR_STYLE.stable;
                  const DirIcon = dir.icon;
                  return (
                    <tr
                      key={r.skill_slug}
                      className="border-b border-[var(--sg-shell-border)] last:border-0"
                    >
                      <td className="py-2.5 pr-3 text-[var(--sg-shell-500)]">
                        {r.rank}
                      </td>
                      <td className="py-2.5 pr-4">
                        <a
                          href={`/skills/${r.skill_slug}`}
                          className="font-medium text-[var(--sg-shell-900)] hover:underline"
                        >
                          {r.skill_name}
                        </a>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span
                          className="inline-flex items-center gap-1 text-xs"
                          style={{ color: dir.color }}
                        >
                          <DirIcon size={12} />
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-right text-[var(--sg-shell-600)]">
                        {r.heat_score.toFixed(2)}
                      </td>
                      <td className="py-2.5 text-right text-[var(--sg-shell-600)] hidden sm:table-cell">
                        {r.practitioner_count.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Previous months */}
        {periodOptions.length > 1 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-[var(--sg-shell-600)]">
              Previous Months
            </h3>
            <div className="flex flex-wrap gap-2">
              {periodOptions.map((p) => (
                <a
                  key={p}
                  href={`/index/${p}`}
                  className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                  style={{
                    background:
                      p === entry.period
                        ? "var(--sg-forest-500)"
                        : "var(--sg-shell-100)",
                    color:
                      p === entry.period
                        ? "var(--sg-white)"
                        : "var(--sg-shell-600)",
                  }}
                >
                  {p}
                </a>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
