// ─── Skill Taxonomy Types ───────────────────────────────────
// Three-axis model: Skills × Functions × Fluency

/** A high-level skill domain (8 total). */
export interface SkillDomain {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  sort_order: number;
}

/** A discrete, assessable skill within a domain. */
export interface Skill {
  id: string;
  domain_id: string;
  slug: string;
  name: string;
  description: string;
  /** Functions this skill is most relevant to (empty = universal). */
  relevant_functions: string[];
  sort_order: number;
}

/** A skill tag on a learning path. */
export interface SkillTag {
  id: string;
  path_id: string;
  skill_id: string;
  relevance: "primary" | "secondary";
}

/** Skill with its domain info joined. Used in UI. */
export interface SkillWithDomain extends Skill {
  domain: SkillDomain;
}

/** Fluency level for a specific skill. Same 4 levels as global fluency. */
export type SkillFluency = "exploring" | "practicing" | "proficient" | "advanced";
