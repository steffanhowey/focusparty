/**
 * Monthly AI Skills Index generation.
 *
 * Runs weekly but guards on date — only produces an index in the first
 * week of each month. Ranks skills by composite score, calls GPT-4o-mini
 * for narrative findings, and upserts into fp_skill_index_entries.
 */

import OpenAI from "openai";
import { createClient } from "@/lib/supabase/admin";
import { getSkills } from "@/lib/skills/taxonomy";
import { getAllMarketStates } from "@/lib/intelligence/marketState";
import type {
  SkillMarketState,
  SkillRanking,
  IndexFinding,
} from "@/lib/types/intelligence";

// ─── OpenAI singleton ──────────────────────────────────────

let _openai: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

// ─── Types ─────────────────────────────────────────────────

interface IndexResult {
  period: string;
  entry_id: string | null;
  skipped: boolean;
}

// ─── Main ──────────────────────────────────────────────────

/**
 * Generate the monthly AI Skills Index.
 * Guards: only runs in the first 7 days of the month.
 */
export async function generateMonthlyIndex(): Promise<IndexResult> {
  const now = new Date();
  if (now.getDate() > 7) {
    return { period: "", entry_id: null, skipped: true };
  }

  // Period = previous month (YYYY-MM)
  const prev = new Date(now);
  prev.setMonth(prev.getMonth() - 1);
  const period = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;

  const admin = createClient();

  // Check if already generated
  const { data: existing } = await admin
    .from("fp_skill_index_entries")
    .select("id")
    .eq("period", period)
    .maybeSingle();

  if (existing) {
    return { period, entry_id: existing.id as string, skipped: true };
  }

  // Load market state + skills
  const marketStates = await getAllMarketStates();
  const allSkills = await getSkills();
  const skillNameMap = new Map(allSkills.map((s) => [s.slug, s.name]));
  const skillDomainMap = new Map(allSkills.map((s) => [s.slug, s.domain_id]));

  if (marketStates.length === 0) {
    return { period, entry_id: null, skipped: true };
  }

  // Rank skills by composite: heat × 0.4 + velocity × 0.3 + gap × 0.3
  const maxHeat = Math.max(...marketStates.map((s) => s.heat_score), 1);
  const maxVelocity = Math.max(
    ...marketStates.map((s) => Math.abs(s.velocity)),
    1
  );
  const maxGap = Math.max(
    ...marketStates.map((s) => Math.abs(s.demand_supply_gap)),
    1
  );

  const ranked = marketStates
    .map((s) => ({
      state: s,
      composite:
        (s.heat_score / maxHeat) * 0.4 +
        (Math.max(0, s.velocity) / maxVelocity) * 0.3 +
        (Math.max(0, s.demand_supply_gap) / maxGap) * 0.3,
    }))
    .sort((a, b) => b.composite - a.composite);

  const rankings: SkillRanking[] = ranked.map((r, i) => ({
    skill_slug: r.state.skill_slug,
    skill_name: skillNameMap.get(r.state.skill_slug) ?? r.state.skill_slug,
    domain_slug: skillDomainMap.get(r.state.skill_slug) ?? "",
    rank: i + 1,
    heat_score: r.state.heat_score,
    direction: r.state.direction,
    delta_rank: 0, // No previous index to compare
    practitioner_count: r.state.practitioner_count,
    demand_supply_gap: r.state.demand_supply_gap,
  }));

  const emergingSkills = marketStates
    .filter((s) => s.direction === "emerging")
    .map((s) => s.skill_slug);
  const decliningSkills = marketStates
    .filter((s) => s.direction === "declining")
    .map((s) => s.skill_slug);

  // Platform stats
  const totalPractitioners = marketStates.reduce(
    (sum, s) => sum + s.practitioner_count,
    0
  );
  const totalCompletions = marketStates.reduce(
    (sum, s) => sum + s.completions_7d,
    0
  );

  // Call LLM for key findings
  const keyFindings = await generateKeyFindings(marketStates, rankings);

  // Upsert
  const row = {
    period,
    rankings,
    key_findings: keyFindings,
    emerging_skills: emergingSkills,
    declining_skills: decliningSkills,
    platform_stats: {
      total_practitioners: totalPractitioners,
      total_completions: totalCompletions,
      skills_tracked: marketStates.length,
      avg_fluency_index: 0,
    },
    methodology_version: "1.0",
  };

  const { data, error } = await admin
    .from("fp_skill_index_entries")
    .upsert(row, { onConflict: "period" })
    .select("id")
    .single();

  if (error) {
    console.error("[intelligence/indexGeneration] Upsert error:", error);
    return { period, entry_id: null, skipped: false };
  }

  return {
    period,
    entry_id: (data?.id as string) ?? null,
    skipped: false,
  };
}

// ─── LLM Key Findings ─────────────────────────────────────

async function generateKeyFindings(
  states: SkillMarketState[],
  rankings: SkillRanking[]
): Promise<IndexFinding[]> {
  try {
    const top10 = rankings
      .slice(0, 10)
      .map(
        (r) =>
          `#${r.rank} ${r.skill_name} (heat: ${r.heat_score.toFixed(2)}, direction: ${r.direction}, gap: ${r.demand_supply_gap.toFixed(1)})`
      )
      .join("\n");

    const emerging = states
      .filter((s) => s.direction === "emerging")
      .map((s) => s.skill_slug)
      .join(", ");

    const response = await getClient().chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 2000,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `You are the editor of the monthly AI Skills Index for SkillGap.ai. Write concise, data-grounded key findings about the AI skills landscape this month. Each finding should be 2-3 sentences and reference specific data from the rankings.`,
        },
        {
          role: "user",
          content: `Generate 3-5 key findings for this month's AI Skills Index.\n\nTop 10 Skills:\n${top10}\n\nEmerging Skills: ${emerging || "None"}\n\nTotal skills tracked: ${states.length}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "index_findings",
          strict: true,
          schema: {
            type: "object",
            properties: {
              findings: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    headline: { type: "string" },
                    analysis: { type: "string" },
                    skill_slugs: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                  required: ["headline", "analysis", "skill_slugs"],
                  additionalProperties: false,
                },
              },
            },
            required: ["findings"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content) as { findings: IndexFinding[] };
    return (parsed.findings ?? []).slice(0, 5);
  } catch (error) {
    console.error("[intelligence/indexGeneration] LLM error:", error);
    return [];
  }
}
