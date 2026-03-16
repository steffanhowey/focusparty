/**
 * Skill heat computation pipeline.
 *
 * Bridges topic-level heat scores to skills via fp_topic_skill_map.
 * Computes market state, trend direction, and demand-supply gap.
 * Updates fp_skill_market_state daily.
 */

import { createClient } from "@/lib/supabase/admin";
import { getSkills } from "@/lib/skills/taxonomy";
import { getTopicSkillMap } from "@/lib/intelligence/topicSkillMap";
import type { HeatHistoryEntry } from "@/lib/types/intelligence";

/** Result of a skill heat computation run. */
export interface SkillHeatResult {
  skills_updated: number;
  rising: string[];
  emerging: string[];
  declining: string[];
}

/**
 * Compute skill market state from topic heat + practitioner data.
 * Called daily at 3:30am UTC (after practitioner aggregation).
 */
export async function computeSkillMarketState(): Promise<SkillHeatResult> {
  const admin = createClient();
  const today = new Date().toISOString().split("T")[0];

  // ── 1. Get topic heat: max heat per topic from active clusters ─
  const { data: clusterRows, error: clErr } = await admin
    .from("fp_topic_clusters")
    .select("topic_id, heat_score, signal_count, source_diversity")
    .neq("status", "cold");

  if (clErr) {
    console.error("[intelligence/skillHeat] Cluster load error:", clErr);
    return { skills_updated: 0, rising: [], emerging: [], declining: [] };
  }

  // Aggregate: max heat, sum signals, max diversity per topic_id
  const topicHeatById = new Map<
    string,
    { heat: number; signals: number; diversity: number }
  >();

  for (const row of clusterRows ?? []) {
    const tid = row.topic_id as string;
    const existing = topicHeatById.get(tid);
    const heat = (row.heat_score as number) ?? 0;
    const signals = (row.signal_count as number) ?? 0;
    const diversity = (row.source_diversity as number) ?? 0;

    if (!existing || heat > existing.heat) {
      topicHeatById.set(tid, {
        heat,
        signals: existing ? existing.signals + signals : signals,
        diversity: Math.max(existing?.diversity ?? 0, diversity),
      });
    } else {
      existing.signals += signals;
    }
  }

  // ── 2. Map topic_id → slug via taxonomy ───────────────────
  const topicIds = [...topicHeatById.keys()];
  if (topicIds.length === 0) {
    console.log("[intelligence/skillHeat] No active clusters, skipping");
    return { skills_updated: 0, rising: [], emerging: [], declining: [] };
  }

  const { data: topicRows } = await admin
    .from("fp_topic_taxonomy")
    .select("id, slug")
    .in("id", topicIds);

  const topicIdToSlug = new Map(
    (topicRows ?? []).map((t) => [t.id as string, t.slug as string])
  );

  // Build slug-keyed heat map
  const topicHeatBySlug = new Map<
    string,
    { heat: number; signals: number; diversity: number }
  >();
  for (const [id, data] of topicHeatById) {
    const slug = topicIdToSlug.get(id);
    if (slug) topicHeatBySlug.set(slug, data);
  }

  // ── 3. Load topic-skill mappings ──────────────────────────
  const mappings = await getTopicSkillMap();

  // Group mappings by skill_slug
  const mappingsBySkill = new Map<
    string,
    Array<{ topicSlug: string; strength: number }>
  >();
  for (const m of mappings) {
    const entries = mappingsBySkill.get(m.skill_slug) ?? [];
    entries.push({ topicSlug: m.topic_slug, strength: m.strength });
    mappingsBySkill.set(m.skill_slug, entries);
  }

  // ── 4. Load existing market state (for heat history) ──────
  const { data: existingStates } = await admin
    .from("fp_skill_market_state")
    .select("skill_slug, heat_history");

  const existingHistoryMap = new Map(
    (existingStates ?? []).map((s) => [
      s.skill_slug as string,
      (s.heat_history as HeatHistoryEntry[]) ?? [],
    ])
  );

  // ── 5. Load today's practitioner snapshots ────────────────
  const { data: snapshots } = await admin
    .from("fp_practitioner_snapshots")
    .select("*")
    .eq("snapshot_date", today);

  const snapshotMap = new Map(
    (snapshots ?? []).map((s) => [s.skill_slug as string, s])
  );

  // ── 6. Get total active users (for demand-supply gap) ─────
  const { count: totalUsers } = await admin
    .from("fp_user_skills")
    .select("user_id", { count: "exact", head: true });

  // Use totalUsers as rough estimate of platform user base
  const platformUsers = Math.max(totalUsers ?? 1, 1);

  // ── 7. Compute heat + state for each skill ────────────────
  const allSkills = await getSkills();
  const results: Array<{
    slug: string;
    heat: number;
    direction: string;
    velocity: number;
  }> = [];

  for (const skill of allSkills) {
    const mapped = mappingsBySkill.get(skill.slug) ?? [];

    // Weighted average of mapped topic heat scores
    let weightedHeatSum = 0;
    let weightSum = 0;
    let totalSignals = 0;
    let maxDiversity = 0;

    for (const { topicSlug, strength } of mapped) {
      const topicData = topicHeatBySlug.get(topicSlug);
      if (!topicData) continue;

      weightedHeatSum += topicData.heat * strength;
      weightSum += strength;
      totalSignals += topicData.signals;
      maxDiversity = Math.max(maxDiversity, topicData.diversity);
    }

    const heatScore =
      weightSum > 0
        ? Math.round((weightedHeatSum / weightSum) * 1000) / 1000
        : 0;

    // Update heat history (keep last 30 entries)
    const history = existingHistoryMap.get(skill.slug) ?? [];
    const updatedHistory = [
      ...history.filter((h) => h.date !== today),
      { date: today, score: heatScore },
    ].slice(-30);

    // Compute 7d and 30d ago from history
    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    )
      .toISOString()
      .split("T")[0];
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    )
      .toISOString()
      .split("T")[0];

    const heat7dAgo =
      updatedHistory.find((h) => h.date <= sevenDaysAgo)?.score ?? 0;
    const heat30dAgo =
      updatedHistory.find((h) => h.date <= thirtyDaysAgo)?.score ?? 0;

    // Compute velocity and direction
    const velocity =
      heat7dAgo > 0
        ? (heatScore - heat7dAgo) / heat7dAgo
        : heatScore > 0.3
          ? 1
          : 0;

    let direction: string;
    if (heat30dAgo === 0 && heatScore > 0.3) {
      direction = "emerging";
    } else if (velocity > 0.2) {
      direction = "rising";
    } else if (velocity < -0.2) {
      direction = "declining";
    } else {
      direction = "stable";
    }

    // Practitioner data from today's snapshot
    const snap = snapshotMap.get(skill.slug);
    const practisingPlus =
      ((snap?.practicing_count as number) ?? 0) +
      ((snap?.proficient_count as number) ?? 0) +
      ((snap?.advanced_count as number) ?? 0);

    // Demand-supply gap
    const demandProxy = heatScore * 100;
    const supplyProxy = (practisingPlus / platformUsers) * 100;
    const gap =
      Math.round((demandProxy - supplyProxy) * 100) / 100;

    results.push({
      slug: skill.slug,
      heat: heatScore,
      direction,
      velocity,
    });

    // Upsert market state
    const { error: upsertErr } = await admin
      .from("fp_skill_market_state")
      .upsert(
        {
          skill_slug: skill.slug,
          direction,
          velocity: Math.round(velocity * 1000) / 1000,
          heat_score: heatScore,
          heat_history: updatedHistory,
          signal_count_7d: totalSignals,
          source_diversity: maxDiversity,
          practitioner_count: (snap?.total_practitioners as number) ?? 0,
          fluency_distribution: {
            exploring: (snap?.exploring_count as number) ?? 0,
            practicing: (snap?.practicing_count as number) ?? 0,
            proficient: (snap?.proficient_count as number) ?? 0,
            advanced: (snap?.advanced_count as number) ?? 0,
          },
          new_practitioners_7d: (snap?.new_starts_7d as number) ?? 0,
          completions_7d: (snap?.completions_7d as number) ?? 0,
          demand_supply_gap: gap,
          market_percentile: 50, // Placeholder, computed in pass 2
          computed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "skill_slug" }
      );

    if (upsertErr) {
      console.error(
        `[intelligence/skillHeat] Upsert error for ${skill.slug}:`,
        upsertErr
      );
    }
  }

  // ── 8. Compute market percentiles ─────────────────────────
  const sorted = [...results].sort((a, b) => b.heat - a.heat);
  const total = sorted.length;

  for (let i = 0; i < sorted.length; i++) {
    const percentile = Math.round(((total - i) / total) * 100);
    await admin
      .from("fp_skill_market_state")
      .update({ market_percentile: percentile })
      .eq("skill_slug", sorted[i].slug);
  }

  return {
    skills_updated: results.length,
    rising: results.filter((r) => r.direction === "rising").map((r) => r.slug),
    emerging: results
      .filter((r) => r.direction === "emerging")
      .map((r) => r.slug),
    declining: results
      .filter((r) => r.direction === "declining")
      .map((r) => r.slug),
  };
}
