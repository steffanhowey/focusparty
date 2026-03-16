// ─── Skill Intelligence Types ──────────────────────────────
// Types for the skill intelligence architecture: topic-skill mapping,
// market state, practitioner snapshots, and synthesized insights.

/** Trend direction for a skill in the market. */
export type TrendDirection = "rising" | "stable" | "declining" | "emerging";

/** Classification of a synthesized insight. */
export type InsightType =
  | "trend_shift"
  | "emerging_skill"
  | "convergence"
  | "skill_gap"
  | "market_signal"
  | "practitioner_insight"
  | "weekly_digest";

/** Lifecycle status of a synthesized insight. */
export type InsightStatus = "draft" | "published" | "archived";

/** Relationship type between a topic and a skill. */
export type TopicSkillRelationship = "direct" | "applied" | "contextual";

// ─── Topic-Skill Mapping ────────────────────────────────────

/** A mapping between a canonical topic and a skill. */
export interface TopicSkillMapping {
  topic_slug: string;
  skill_slug: string;
  /** How strongly this topic relates to the skill (0-1). */
  strength: number;
  /** How this topic relates to the skill. */
  relationship: TopicSkillRelationship;
}

// ─── Skill Market State ─────────────────────────────────────

/** A single entry in the heat history array. */
export interface HeatHistoryEntry {
  date: string;
  score: number;
}

/** Current market state for a single skill. One row per skill, updated daily. */
export interface SkillMarketState {
  skill_slug: string;
  direction: TrendDirection;
  velocity: number;
  heat_score: number;
  heat_history: HeatHistoryEntry[];
  signal_count_7d: number;
  source_diversity: number;
  practitioner_count: number;
  fluency_distribution: {
    exploring: number;
    practicing: number;
    proficient: number;
    advanced: number;
  };
  new_practitioners_7d: number;
  completions_7d: number;
  demand_supply_gap: number;
  market_percentile: number;
  computed_at: string;
  updated_at: string;
}

// ─── Practitioner Snapshots ─────────────────────────────────

/** Daily snapshot of practitioner data for a single skill. */
export interface PractitionerSnapshot {
  snapshot_date: string;
  skill_slug: string;
  total_practitioners: number;
  exploring_count: number;
  practicing_count: number;
  proficient_count: number;
  advanced_count: number;
  new_starts_7d: number;
  completions_7d: number;
  level_ups_7d: number;
  paths_with_skill: number;
}

// ─── Skill Intelligence ─────────────────────────────────────

/** Evidence item backing a synthesized insight. */
export interface InsightEvidence {
  source: string;
  claim: string;
  data_point: string;
}

/** Actionable recommendation from a synthesized insight. */
export interface InsightRecommendation {
  action: string;
  target_audience: string;
  priority: "high" | "medium" | "low";
}

/** A synthesized skill intelligence insight. */
export interface SkillIntelligence {
  id: string;
  skill_slugs: string[];
  insight_type: InsightType;
  headline: string;
  analysis: string;
  evidence: InsightEvidence[];
  recommendations: InsightRecommendation[];
  confidence: number;
  impact_score: number;
  status: InsightStatus;
  published_at: string | null;
  expires_at: string | null;
  source_snapshot_date: string | null;
  created_at: string;
}

// ─── Skills Index ───────────────────────────────────────────

/** A skill's ranking entry in the monthly index. */
export interface SkillRanking {
  skill_slug: string;
  skill_name: string;
  domain_slug: string;
  rank: number;
  heat_score: number;
  direction: TrendDirection;
  delta_rank: number;
  practitioner_count: number;
  demand_supply_gap: number;
}

/** A key finding in the monthly index. */
export interface IndexFinding {
  headline: string;
  analysis: string;
  skill_slugs: string[];
}

/** Monthly AI Skills Index publication. */
export interface SkillIndexEntry {
  id: string;
  period: string;
  rankings: SkillRanking[];
  key_findings: IndexFinding[];
  emerging_skills: string[];
  declining_skills: string[];
  platform_stats: {
    total_practitioners: number;
    total_completions: number;
    skills_tracked: number;
    avg_fluency_index: number;
  };
  methodology_version: string;
  generated_at: string;
  published_at: string | null;
}
