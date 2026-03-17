/**
 * /pulse — AI Skills Pulse Dashboard (public, ISR 1 hour)
 *
 * Server Component that loads market states + published insights
 * and renders the interactive PulseDashboard client component.
 */

import { Metadata } from "next";
import { getAllMarketStates } from "@/lib/intelligence/marketState";
import { createClient } from "@/lib/supabase/admin";
import { PublicNav } from "@/components/public/PublicNav";
import { PulseDashboard } from "@/components/public/PulseDashboard";
import type { SkillIntelligence } from "@/lib/types/intelligence";

export const revalidate = 3600; // 1 hour ISR

export const metadata: Metadata = {
  title: "AI Skills Pulse — Live Market Intelligence | SkillGap.ai",
  description:
    "Real-time trends in AI skill demand, practitioner growth, and emerging capabilities.",
};

export default async function PulsePage() {
  const states = await getAllMarketStates();

  // Load latest published insights (up to 6)
  const admin = createClient();
  const { data: insightRows } = await admin
    .from("fp_skill_intelligence")
    .select("*")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(6);

  const insights: SkillIntelligence[] = (insightRows ?? []).map(
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

  const lastUpdated =
    states.length > 0
      ? states.reduce((latest, s) =>
          s.updated_at > latest ? s.updated_at : latest,
          states[0].updated_at
        )
      : null;

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--sg-white)" }}
    >
      <PublicNav />
      <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
        <PulseDashboard
          states={states}
          insights={insights}
          lastUpdated={lastUpdated}
        />
      </main>
    </div>
  );
}
