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

/** A user's progress on a specific skill. Stored in fp_user_skills. */
export interface UserSkill {
  id: string;
  user_id: string;
  skill_id: string;
  fluency_level: SkillFluency;
  paths_completed: number;
  missions_completed: number;
  avg_score: number | null;
  total_scored_missions: number;
  first_demonstrated_at: string;
  last_demonstrated_at: string;
}

/** A single skill's before/after state in a skill receipt. */
export interface SkillReceiptEntry {
  /** The skill with domain info */
  skill: {
    slug: string;
    name: string;
    domain_slug: string;
    domain_name: string;
    domain_icon: string;
  };
  /** Relevance to this path (primary skills weighted more in display) */
  relevance: "primary" | "secondary";
  /** User's fluency BEFORE this path completion */
  before: {
    fluency_level: SkillFluency;
    paths_completed: number;
  };
  /** User's fluency AFTER this path completion */
  after: {
    fluency_level: SkillFluency;
    paths_completed: number;
  };
  /** Whether this path caused a level-up */
  leveled_up: boolean;
  /** How many "do" tasks in this path contributed to this skill */
  missions_in_path: number;
  /** Average score from this path's missions (null if no scored missions) */
  avg_score_in_path: number | null;
}

/** The full skill receipt for a completed path. */
export interface SkillReceipt {
  path: {
    id: string;
    title: string;
    completed_at: string;
  };
  /** Skills developed, primary skills first */
  skills: SkillReceiptEntry[];
  /** Whether this is the user's first ever skill receipt (triggers special messaging) */
  is_first_receipt: boolean;
}
