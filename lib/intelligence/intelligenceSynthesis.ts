/**
 * Weekly intelligence synthesis.
 *
 * Loads skill market state + practitioner snapshots, feeds them to
 * GPT-4o-mini for structured insight generation. Auto-publishes
 * high-confidence insights, leaves the rest as drafts.
 *
 * Runs weekly (Monday 6am UTC) via cron.
 */

import OpenAI from "openai";
import { createClient } from "@/lib/supabase/admin";
import { getAllMarketStates } from "@/lib/intelligence/marketState";
import type {
  SkillMarketState,
  PractitionerSnapshot,
  InsightType,
} from "@/lib/types/intelligence";

// ─── OpenAI singleton ──────────────────────────────────────

let _openai: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

// ─── Types ─────────────────────────────────────────────────

interface SynthesizedInsight {
  skill_slugs: string[];
  insight_type: InsightType;
  headline: string;
  analysis: string;
  evidence: { source: string; claim: string; data_point: string }[];
  recommendations: {
    action: string;
    target_audience: string;
    priority: "high" | "medium" | "low";
  }[];
  confidence: number;
  impact_score: number;
}

interface SynthesisResult {
  insights_generated: number;
  insights_published: number;
}

// ─── Main ──────────────────────────────────────────────────

/**
 * Synthesize weekly intelligence from skill market state and
 * practitioner data. Returns count of insights generated/published.
 */
export async function synthesizeWeeklyIntelligence(): Promise<SynthesisResult> {
  const admin = createClient();

  // Load current market state
  const marketStates = await getAllMarketStates();
  if (marketStates.length === 0) {
    return { insights_generated: 0, insights_published: 0 };
  }

  // Load this week's + last week's practitioner snapshots
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const twoWeeksAgo = new Date(today);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const { data: snapshotRows } = await admin
    .from("fp_practitioner_snapshots")
    .select("*")
    .gte("snapshot_date", twoWeeksAgo.toISOString().split("T")[0])
    .order("snapshot_date", { ascending: false });

  const snapshots = (snapshotRows ?? []) as PractitionerSnapshot[];

  // Build data summary for the LLM
  const dataSummary = buildDataSummary(marketStates, snapshots, weekAgo);

  // Call GPT-4o-mini for synthesis
  const insights = await callSynthesisLLM(dataSummary);

  if (insights.length === 0) {
    return { insights_generated: 0, insights_published: 0 };
  }

  // Insert insights
  const expiresAt = new Date(today);
  expiresAt.setDate(expiresAt.getDate() + 14);

  let published = 0;

  const rows = insights.map((insight) => {
    const autoPublish = insight.confidence >= 80;
    if (autoPublish) published++;

    return {
      skill_slugs: insight.skill_slugs,
      insight_type: insight.insight_type,
      headline: insight.headline,
      analysis: insight.analysis,
      evidence: insight.evidence,
      recommendations: insight.recommendations,
      confidence: insight.confidence,
      impact_score: insight.impact_score,
      status: autoPublish ? "published" : "draft",
      published_at: autoPublish ? new Date().toISOString() : null,
      expires_at: expiresAt.toISOString(),
      source_snapshot_date: today.toISOString().split("T")[0],
    };
  });

  const { error } = await admin.from("fp_skill_intelligence").insert(rows);

  if (error) {
    console.error("[intelligence/synthesis] Insert error:", error);
    return { insights_generated: 0, insights_published: 0 };
  }

  return { insights_generated: insights.length, insights_published: published };
}

// ─── Data Summary Builder ──────────────────────────────────

function buildDataSummary(
  states: SkillMarketState[],
  snapshots: PractitionerSnapshot[],
  weekAgo: Date
): string {
  const rising = states
    .filter((s) => s.direction === "rising")
    .sort((a, b) => b.velocity - a.velocity)
    .slice(0, 10);
  const emerging = states.filter((s) => s.direction === "emerging");
  const declining = states.filter((s) => s.direction === "declining");
  const biggestGaps = states
    .filter((s) => s.demand_supply_gap > 0)
    .sort((a, b) => b.demand_supply_gap - a.demand_supply_gap)
    .slice(0, 10);

  // This week vs last week practitioner growth
  const weekAgoStr = weekAgo.toISOString().split("T")[0];
  const thisWeek = snapshots.filter((s) => s.snapshot_date >= weekAgoStr);
  const lastWeek = snapshots.filter((s) => s.snapshot_date < weekAgoStr);

  const thisWeekTotal = thisWeek.reduce(
    (sum, s) => sum + s.total_practitioners,
    0
  );
  const lastWeekTotal = lastWeek.reduce(
    (sum, s) => sum + s.total_practitioners,
    0
  );

  const lines: string[] = [
    "=== SKILL MARKET STATE (Current) ===",
    `Total skills tracked: ${states.length}`,
    `Rising skills (${rising.length}): ${rising.map((s) => `${s.skill_slug} (velocity: ${s.velocity.toFixed(2)}, heat: ${s.heat_score.toFixed(2)})`).join(", ")}`,
    `Emerging skills (${emerging.length}): ${emerging.map((s) => s.skill_slug).join(", ")}`,
    `Declining skills (${declining.length}): ${declining.map((s) => s.skill_slug).join(", ")}`,
    "",
    "=== BIGGEST DEMAND-SUPPLY GAPS ===",
    ...biggestGaps.map(
      (s) =>
        `${s.skill_slug}: gap=${s.demand_supply_gap.toFixed(1)}, heat=${s.heat_score.toFixed(2)}, practitioners=${s.practitioner_count}`
    ),
    "",
    "=== PRACTITIONER GROWTH ===",
    `This week total practitioners: ${thisWeekTotal}`,
    `Last week total practitioners: ${lastWeekTotal}`,
    `Growth: ${lastWeekTotal > 0 ? (((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100).toFixed(1) : "N/A"}%`,
    "",
    "=== TOP SKILLS BY PRACTITIONER COUNT ===",
    ...states
      .sort((a, b) => b.practitioner_count - a.practitioner_count)
      .slice(0, 10)
      .map(
        (s) =>
          `${s.skill_slug}: ${s.practitioner_count} practitioners (${s.fluency_distribution.exploring}E/${s.fluency_distribution.practicing}P/${s.fluency_distribution.proficient}Pr/${s.fluency_distribution.advanced}A)`
      ),
  ];

  return lines.join("\n");
}

// ─── LLM Call ──────────────────────────────────────────────

async function callSynthesisLLM(
  dataSummary: string
): Promise<SynthesizedInsight[]> {
  try {
    const response = await getClient().chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 4000,
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: `You are an AI skills intelligence analyst for SkillGap.ai, a platform that helps professionals build AI fluency. You analyze skill market data and practitioner trends to produce actionable insights.

Your insights should be:
- Grounded in the data provided (cite specific numbers)
- Actionable for professionals and L&D leaders
- Forward-looking but not speculative
- Concise and clear

Generate 5-8 insights covering a mix of these types:
- trend_shift: A meaningful change in skill demand or activity
- emerging_skill: A skill showing early signs of growth
- convergence: Skills from different domains showing overlap or cross-pollination
- skill_gap: A significant gap between demand and practitioner supply
- market_signal: A notable market-level pattern
- practitioner_insight: A pattern in how practitioners are developing skills
- weekly_digest: A high-level summary of the week's key developments

Each insight should have a confidence score (0-100) reflecting how well-supported it is by the data. Only assign confidence >= 80 if the data clearly supports the insight with multiple data points.`,
        },
        {
          role: "user",
          content: `Analyze this week's skill intelligence data and generate insights:\n\n${dataSummary}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "intelligence_synthesis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              insights: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    skill_slugs: {
                      type: "array",
                      items: { type: "string" },
                      description: "Skill slugs this insight relates to",
                    },
                    insight_type: {
                      type: "string",
                      enum: [
                        "trend_shift",
                        "emerging_skill",
                        "convergence",
                        "skill_gap",
                        "market_signal",
                        "practitioner_insight",
                        "weekly_digest",
                      ],
                    },
                    headline: {
                      type: "string",
                      description: "Short headline (max 100 chars)",
                    },
                    analysis: {
                      type: "string",
                      description:
                        "2-3 sentence analysis grounded in the data",
                    },
                    evidence: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          source: { type: "string" },
                          claim: { type: "string" },
                          data_point: { type: "string" },
                        },
                        required: ["source", "claim", "data_point"],
                        additionalProperties: false,
                      },
                    },
                    recommendations: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          action: { type: "string" },
                          target_audience: { type: "string" },
                          priority: {
                            type: "string",
                            enum: ["high", "medium", "low"],
                          },
                        },
                        required: ["action", "target_audience", "priority"],
                        additionalProperties: false,
                      },
                    },
                    confidence: {
                      type: "number",
                      description: "Confidence 0-100",
                    },
                    impact_score: {
                      type: "number",
                      description: "Impact 0-100",
                    },
                  },
                  required: [
                    "skill_slugs",
                    "insight_type",
                    "headline",
                    "analysis",
                    "evidence",
                    "recommendations",
                    "confidence",
                    "impact_score",
                  ],
                  additionalProperties: false,
                },
              },
            },
            required: ["insights"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content) as { insights: SynthesizedInsight[] };
    return (parsed.insights ?? []).slice(0, 10);
  } catch (error) {
    console.error("[intelligence/synthesis] LLM error:", error);
    return [];
  }
}
