/**
 * /skills/[slug] — Public skill detail page.
 * Server Component with ISR (1 hour).
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSkills, getSkillsWithDomains } from "@/lib/skills/taxonomy";
import { getMarketState } from "@/lib/intelligence/marketState";
import { createClient } from "@/lib/supabase/admin";
import { mapPathRow } from "@/lib/learn/pathGenerator";
import { PublicNav } from "@/components/public/PublicNav";
import { SkillDetailPage } from "@/components/public/SkillDetailPage";
import type { SkillIntelligence } from "@/lib/types/intelligence";
import type { LearningPath } from "@/lib/types";

export const revalidate = 3600;

// ─── Static Params ─────────────────────────────────────────

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const skills = await getSkills();
  return skills.map((s) => ({ slug: s.slug }));
}

// ─── Metadata ──────────────────────────────────────────────

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const skills = await getSkills();
  const skill = skills.find((s) => s.slug === slug);
  const name = skill?.name ?? slug;

  return {
    title: `${name} — AI Skill Intelligence | SkillGap.ai`,
    description: `Market demand, practitioner data, and learning paths for ${name}. Real-time skill intelligence from SkillGap.ai.`,
  };
}

// ─── Page ──────────────────────────────────────────────────

export default async function SkillPage({ params }: PageProps) {
  const { slug } = await params;
  const allSkillsWithDomains = await getSkillsWithDomains();
  const skill = allSkillsWithDomains.find((s) => s.slug === slug);
  if (!skill) notFound();

  const admin = createClient();

  // Load data in parallel
  const [marketState, insightsResult, pathTagsResult] = await Promise.all([
    getMarketState(slug),
    admin
      .from("fp_skill_intelligence")
      .select("*")
      .eq("status", "published")
      .contains("skill_slugs", [slug])
      .order("created_at", { ascending: false })
      .limit(4),
    admin
      .from("fp_skill_tags")
      .select("path_id")
      .eq("skill_id", skill.id)
      .eq("relevance", "primary")
      .limit(6),
  ]);

  // Map insights
  const insights: SkillIntelligence[] = (insightsResult.data ?? []).map(
    (row: Record<string, unknown>) => ({
      id: row.id as string,
      skill_slugs: row.skill_slugs as string[],
      insight_type: row.insight_type as SkillIntelligence["insight_type"],
      headline: row.headline as string,
      analysis: row.analysis as string,
      evidence: row.evidence as SkillIntelligence["evidence"],
      recommendations:
        row.recommendations as SkillIntelligence["recommendations"],
      confidence: row.confidence as number,
      impact_score: row.impact_score as number,
      status: row.status as SkillIntelligence["status"],
      published_at: row.published_at as string | null,
      expires_at: row.expires_at as string | null,
      source_snapshot_date: row.source_snapshot_date as string | null,
      created_at: row.created_at as string,
    })
  );

  // Load related paths
  let paths: LearningPath[] = [];
  const pathIds = (pathTagsResult.data ?? []).map(
    (t: Record<string, unknown>) => t.path_id as string
  );
  if (pathIds.length > 0) {
    const { data: pathRows } = await admin
      .from("fp_learning_paths")
      .select("*")
      .in("id", pathIds)
      .order("completion_count", { ascending: false });
    paths = (pathRows ?? []).map((row: Record<string, unknown>) =>
      mapPathRow(row)
    );
  }

  const domainName = skill.domain.name;

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--sg-white)" }}
    >
      <PublicNav />
      <main className="mx-auto max-w-4xl px-4 py-8 md:px-8">
        <SkillDetailPage
          skillName={skill.name}
          domainName={domainName}
          marketState={marketState}
          insights={insights}
          paths={paths}
        />
      </main>
    </div>
  );
}
