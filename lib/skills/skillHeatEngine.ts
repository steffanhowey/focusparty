// ─── Skill Heat Engine ─────────────────────────────────────
// Computes skill-level heat scores by bridging topic heat
// through the fp_topic_skill_map. Pure math — no LLM calls.
//
// Formula: skill_heat = Σ(topic_heat × mapping_strength) / Σ(mapping_strength)
//
// Runs daily at 3:30am UTC via cron.

import { createClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

const log = logger("skills/heatEngine");

// ─── Types ──────────────────────────────────────────────────

export interface SkillHeatResult {
  skillSlug: string;
  heatScore: number;
  heatScore7dAgo: number;
  heatScore30dAgo: number;
  trendDirection: "rising" | "stable" | "declining" | "emerging";
  trendVelocity: number;
  signalCount7d: number;
  signalCount30d: number;
  sourceDiversity: number;
  topSignalSources: string[];
}

// ─── Core computation ───────────────────────────────────────

/**
 * Compute skill heat for ALL skills in one pass.
 * Reads topic cluster heat, bridges through fp_topic_skill_map,
 * and writes results to fp_skill_market_state.
 */
export async function computeAllSkillHeat(): Promise<{
  computed: number;
  skipped: number;
}> {
  const supabase = createClient();
  const now = new Date();

  // ── Step 1: Load bridge mappings ────────────────────────────
  const { data: mappings, error: mapErr } = await supabase
    .from("fp_topic_skill_map")
    .select("topic_slug, skill_slug, strength");

  if (mapErr || !mappings?.length) {
    log.warn("No topic-skill mappings found", { error: mapErr?.message });
    return { computed: 0, skipped: 0 };
  }

  log.info(`Loaded ${mappings.length} topic-skill mappings`);

  // Build a map: skill_slug → [{topic_slug, strength}]
  const skillToTopics = new Map<
    string,
    { topicSlug: string; strength: number }[]
  >();
  for (const m of mappings) {
    const list = skillToTopics.get(m.skill_slug) ?? [];
    list.push({ topicSlug: m.topic_slug, strength: m.strength });
    skillToTopics.set(m.skill_slug, list);
  }

  // ── Step 2: Load topic heat from clusters ───────────────────
  // Each topic may have one active cluster with a heat_score
  const { data: clusters } = await supabase
    .from("fp_topic_clusters")
    .select("topic_id, heat_score, signal_count, velocity, source_diversity")
    .neq("status", "cold");

  // We need topic_id → slug mapping to bridge
  const topicIds = [
    ...new Set((clusters ?? []).map((c) => c.topic_id)),
  ];

  let topicSlugMap = new Map<string, string>(); // topic_id → slug
  if (topicIds.length > 0) {
    const { data: topics } = await supabase
      .from("fp_topic_taxonomy")
      .select("id, slug")
      .in("id", topicIds);
    topicSlugMap = new Map((topics ?? []).map((t) => [t.id, t.slug]));
  }

  // Build: topic_slug → cluster heat data
  const topicHeatMap = new Map<
    string,
    {
      heatScore: number;
      signalCount: number;
      velocity: number;
      sourceDiversity: number;
    }
  >();
  for (const c of clusters ?? []) {
    const slug = topicSlugMap.get(c.topic_id);
    if (!slug) continue;
    // If multiple clusters per topic, keep the hottest one
    const existing = topicHeatMap.get(slug);
    if (!existing || c.heat_score > existing.heatScore) {
      topicHeatMap.set(slug, {
        heatScore: c.heat_score ?? 0,
        signalCount: c.signal_count ?? 0,
        velocity: c.velocity ?? 0,
        sourceDiversity: c.source_diversity ?? 0,
      });
    }
  }

  log.info(
    `Loaded ${topicHeatMap.size} active topic clusters for heat computation`
  );

  // ── Step 3: Load existing market state for 7d/30d comparisons ─
  const { data: existingStates } = await supabase
    .from("fp_skill_market_state")
    .select("skill_slug, heat_score, heat_score_7d_ago, heat_score_30d_ago, updated_at");

  const stateMap = new Map(
    (existingStates ?? []).map((s) => [s.skill_slug, s])
  );

  // ── Step 4: Compute heat for each skill ─────────────────────
  let computed = 0;
  let skipped = 0;
  const upsertRows: Record<string, unknown>[] = [];

  for (const [skillSlug, topicLinks] of skillToTopics) {
    let weightedSum = 0;
    let totalWeight = 0;
    let totalSignals7d = 0;
    let totalSignals30d = 0;
    const sourceSet = new Set<string>();
    const topSources: string[] = [];

    for (const link of topicLinks) {
      const topicData = topicHeatMap.get(link.topicSlug);
      if (!topicData) continue;

      weightedSum += topicData.heatScore * link.strength;
      totalWeight += link.strength;
      totalSignals7d += topicData.signalCount;
      // Approximate 30d as 4× current signal count (rough heuristic)
      totalSignals30d += topicData.signalCount * 4;
      if (topicData.sourceDiversity > 0) {
        sourceSet.add(link.topicSlug);
      }
    }

    const heatScore =
      totalWeight > 0
        ? Math.round((weightedSum / totalWeight) * 1000) / 1000
        : 0;

    // Get historical scores for trend computation
    const existing = stateMap.get(skillSlug);
    const daysSinceUpdate = existing?.updated_at
      ? (now.getTime() - new Date(existing.updated_at).getTime()) /
        (1000 * 60 * 60 * 24)
      : 999;

    // Roll forward the 7d/30d history
    let heatScore7dAgo = existing?.heat_score_7d_ago ?? 0;
    let heatScore30dAgo = existing?.heat_score_30d_ago ?? 0;

    // If it's been ~7 days since last update, rotate current → 7d
    if (daysSinceUpdate >= 6.5) {
      heatScore30dAgo = heatScore7dAgo;
      heatScore7dAgo = existing?.heat_score ?? 0;
    }

    // Compute trend
    const { direction, velocity } = computeTrend(
      heatScore,
      heatScore7dAgo,
      heatScore30dAgo
    );

    upsertRows.push({
      skill_slug: skillSlug,
      heat_score: heatScore,
      heat_score_7d_ago: heatScore7dAgo,
      heat_score_30d_ago: heatScore30dAgo,
      trend_direction: direction,
      trend_velocity: velocity,
      signal_count_7d: totalSignals7d,
      signal_count_30d: totalSignals30d,
      source_diversity: sourceSet.size,
      top_signal_sources: [...sourceSet].slice(0, 5),
      updated_at: now.toISOString(),
    });

    computed++;
  }

  // ── Step 5: Upsert to fp_skill_market_state ────────────────
  if (upsertRows.length > 0) {
    const { error: upsertErr } = await supabase
      .from("fp_skill_market_state")
      .upsert(upsertRows, { onConflict: "skill_slug" });

    if (upsertErr) {
      log.error("Failed to upsert skill market state", upsertErr);
      return { computed: 0, skipped: upsertRows.length };
    }
  }

  log.info(`Skill heat computation complete`, { computed, skipped });
  return { computed, skipped };
}

// ─── Trend computation ──────────────────────────────────────

/**
 * Determine trend direction and velocity from heat scores.
 */
function computeTrend(
  current: number,
  sevenDaysAgo: number,
  thirtyDaysAgo: number
): {
  direction: "rising" | "stable" | "declining" | "emerging";
  velocity: number;
} {
  // Emerging: didn't exist 30 days ago, now has meaningful heat
  if (thirtyDaysAgo === 0 && current > 0.3) {
    return { direction: "emerging", velocity: current };
  }

  // Velocity = relative change over 7 days
  const velocity =
    sevenDaysAgo > 0
      ? (current - sevenDaysAgo) / sevenDaysAgo
      : current > 0
        ? 1
        : 0;

  if (velocity > 0.2) {
    return { direction: "rising", velocity };
  } else if (velocity < -0.2) {
    return { direction: "declining", velocity };
  }

  return { direction: "stable", velocity };
}

// ─── Practitioner snapshot aggregation ──────────────────────

/**
 * Take a daily snapshot of practitioner distribution per skill.
 * Reads from fp_user_skills and writes to fp_practitioner_snapshots.
 */
export async function takePractitionerSnapshot(): Promise<{
  skills: number;
}> {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Count practitioners per skill per fluency level
  const { data: userSkills } = await supabase
    .from("fp_user_skills")
    .select("skill_id, fluency_level");

  if (!userSkills?.length) {
    log.info("No user skill data yet — skipping practitioner snapshot");
    return { skills: 0 };
  }

  // Get skill_id → slug mapping
  const { data: skills } = await supabase
    .from("fp_skills")
    .select("id, slug");
  const idToSlug = new Map((skills ?? []).map((s) => [s.id, s.slug]));

  // Aggregate
  const aggregated = new Map<
    string,
    { total: number; distribution: Record<string, number> }
  >();

  for (const us of userSkills) {
    const slug = idToSlug.get(us.skill_id);
    if (!slug) continue;

    const entry = aggregated.get(slug) ?? {
      total: 0,
      distribution: { exploring: 0, practicing: 0, proficient: 0, advanced: 0 },
    };
    entry.total++;
    const level = (us.fluency_level ?? "exploring").toLowerCase();
    if (level in entry.distribution) {
      entry.distribution[level]++;
    }
    aggregated.set(slug, entry);
  }

  // Count paths per skill
  const { data: tagCounts } = await supabase
    .from("fp_skill_tags")
    .select("skill_id");

  const pathsPerSkill = new Map<string, number>();
  for (const t of tagCounts ?? []) {
    const slug = idToSlug.get(t.skill_id);
    if (!slug) continue;
    pathsPerSkill.set(slug, (pathsPerSkill.get(slug) ?? 0) + 1);
  }

  // Upsert snapshots
  const rows = [...aggregated.entries()].map(([slug, data]) => ({
    snapshot_date: today,
    skill_slug: slug,
    total_practitioners: data.total,
    distribution: data.distribution,
    paths_with_skill: pathsPerSkill.get(slug) ?? 0,
  }));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("fp_practitioner_snapshots")
      .upsert(rows, { onConflict: "snapshot_date,skill_slug" });

    if (error) {
      log.error("Failed to upsert practitioner snapshots", error);
      return { skills: 0 };
    }
  }

  log.info(`Practitioner snapshot taken`, { skills: rows.length });
  return { skills: rows.length };
}

// ─── Market state enrichment ────────────────────────────────

/**
 * Enrich market state with practitioner data after snapshot.
 * Merges practitioner distribution into fp_skill_market_state
 * and computes demand_supply_gap.
 */
export async function enrichMarketState(): Promise<{ enriched: number }> {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);

  // Load today's practitioner snapshots
  const { data: snapshots } = await supabase
    .from("fp_practitioner_snapshots")
    .select("*")
    .eq("snapshot_date", today);

  if (!snapshots?.length) {
    log.info("No practitioner snapshots for today — skipping enrichment");
    return { enriched: 0 };
  }

  // Load current market state for demand_supply_gap computation
  const { data: marketStates } = await supabase
    .from("fp_skill_market_state")
    .select("skill_slug, heat_score");

  const heatMap = new Map(
    (marketStates ?? []).map((ms) => [ms.skill_slug, ms.heat_score ?? 0])
  );

  // Get total platform user count for supply computation
  const { count: totalUsers } = await supabase
    .from("fp_profiles")
    .select("*", { count: "exact", head: true });

  const platformUsers = totalUsers ?? 1; // avoid division by zero

  const updates: Record<string, unknown>[] = [];

  for (const snap of snapshots) {
    const dist = snap.distribution as Record<string, number>;
    const practicingPlus =
      (dist.practicing ?? 0) + (dist.proficient ?? 0) + (dist.advanced ?? 0);

    const heatScore = heatMap.get(snap.skill_slug) ?? 0;
    const demandProxy = heatScore * 100;
    const supplyProxy = (practicingPlus / platformUsers) * 100;
    const gap = Math.round((demandProxy - supplyProxy) * 100) / 100;

    updates.push({
      skill_slug: snap.skill_slug,
      practitioner_count: snap.total_practitioners,
      practitioner_distribution: snap.distribution,
      demand_supply_gap: gap,
      updated_at: new Date().toISOString(),
    });
  }

  if (updates.length > 0) {
    const { error } = await supabase
      .from("fp_skill_market_state")
      .upsert(updates, { onConflict: "skill_slug" });

    if (error) {
      log.error("Failed to enrich market state", error);
      return { enriched: 0 };
    }
  }

  log.info(`Market state enriched`, { enriched: updates.length });
  return { enriched: updates.length };
}

// ─── Public accessors ───────────────────────────────────────

/**
 * Get skill market states sorted by heat, with optional trend filter.
 */
export async function getSkillMarketStates(options?: {
  trendFilter?: "rising" | "emerging" | "declining" | "stable";
  limit?: number;
}): Promise<
  Array<{
    skillSlug: string;
    heatScore: number;
    trendDirection: string;
    trendVelocity: number;
    signalCount7d: number;
    practitionerCount: number;
    demandSupplyGap: number | null;
  }>
> {
  const supabase = createClient();
  let query = supabase
    .from("fp_skill_market_state")
    .select("*")
    .order("heat_score", { ascending: false });

  if (options?.trendFilter) {
    query = query.eq("trend_direction", options.trendFilter);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    log.error("Failed to fetch skill market states", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    skillSlug: row.skill_slug as string,
    heatScore: row.heat_score as number,
    trendDirection: row.trend_direction as string,
    trendVelocity: row.trend_velocity as number,
    signalCount7d: row.signal_count_7d as number,
    practitionerCount: row.practitioner_count as number,
    demandSupplyGap: row.demand_supply_gap as number | null,
  }));
}
