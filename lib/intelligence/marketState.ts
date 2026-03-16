/**
 * Market state data access.
 *
 * Cached reads from fp_skill_market_state for product feed integrations.
 * 10-minute TTL since data updates daily.
 */

import { createClient } from "@/lib/supabase/admin";
import type { SkillMarketState, HeatHistoryEntry } from "@/lib/types/intelligence";

let _states: SkillMarketState[] | null = null;
let _cacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function isCacheFresh(): boolean {
  return Date.now() - _cacheTime < CACHE_TTL;
}

function mapRow(row: Record<string, unknown>): SkillMarketState {
  return {
    skill_slug: row.skill_slug as string,
    direction: row.direction as SkillMarketState["direction"],
    velocity: row.velocity as number,
    heat_score: row.heat_score as number,
    heat_history: (row.heat_history as HeatHistoryEntry[]) ?? [],
    signal_count_7d: row.signal_count_7d as number,
    source_diversity: row.source_diversity as number,
    practitioner_count: row.practitioner_count as number,
    fluency_distribution: (row.fluency_distribution as SkillMarketState["fluency_distribution"]) ?? {
      exploring: 0,
      practicing: 0,
      proficient: 0,
      advanced: 0,
    },
    new_practitioners_7d: row.new_practitioners_7d as number,
    completions_7d: row.completions_7d as number,
    demand_supply_gap: row.demand_supply_gap as number,
    market_percentile: row.market_percentile as number,
    computed_at: row.computed_at as string,
    updated_at: row.updated_at as string,
  };
}

/** Load all skill market states, cached. */
export async function getAllMarketStates(): Promise<SkillMarketState[]> {
  if (_states && isCacheFresh()) return _states;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("fp_skill_market_state")
    .select("*")
    .order("heat_score", { ascending: false });

  if (error) {
    console.error("[intelligence/marketState] Load error:", error);
    return _states ?? [];
  }

  _states = (data ?? []).map(mapRow);
  _cacheTime = Date.now();
  return _states;
}

/** Get market state for a single skill. */
export async function getMarketState(
  skillSlug: string
): Promise<SkillMarketState | null> {
  const states = await getAllMarketStates();
  return states.find((s) => s.skill_slug === skillSlug) ?? null;
}

/** Get trending skills (rising or emerging), sorted by velocity. */
export async function getTrendingSkills(
  limit: number = 5
): Promise<SkillMarketState[]> {
  const states = await getAllMarketStates();
  return states
    .filter((s) => s.direction === "rising" || s.direction === "emerging")
    .sort((a, b) => b.velocity - a.velocity)
    .slice(0, limit);
}

/** Get skills with the highest demand-supply gap. */
export async function getBiggestGaps(
  limit: number = 5
): Promise<SkillMarketState[]> {
  const states = await getAllMarketStates();
  return states
    .filter((s) => s.demand_supply_gap > 0)
    .sort((a, b) => b.demand_supply_gap - a.demand_supply_gap)
    .slice(0, limit);
}

/** Invalidate the cache. */
export function invalidateMarketStateCache(): void {
  _states = null;
  _cacheTime = 0;
}
