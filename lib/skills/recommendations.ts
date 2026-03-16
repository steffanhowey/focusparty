/**
 * Skill-based path recommendations.
 *
 * Given a user's skill profile and function, recommends the highest-leverage
 * learning paths. Three recommendation strategies, blended:
 *
 * 1. LEVEL-UP CANDIDATES: Skills where the user is 1-2 paths away from
 *    advancing to the next fluency level. Highest priority.
 *
 * 2. FUNCTION GAP FILL: Skills relevant to the user's function that
 *    they haven't started yet.
 *
 * 3. DOMAIN EXPANSION: Skills in domains the user hasn't explored yet,
 *    prioritized by entry skills (low sort_order).
 */

import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { getSkills, getSkillsWithDomains } from "@/lib/skills/taxonomy";
import { mapPathRow } from "@/lib/learn/pathGenerator";
import { getAllMarketStates } from "@/lib/intelligence/marketState";
import type { SkillFluency, UserSkill, SkillWithDomain } from "@/lib/types/skills";
import type { LearningPath } from "@/lib/types";

// ─── Types ──────────────────────────────────────────────────

export interface SkillRecommendation {
  /** The recommended skill to develop */
  skill: {
    slug: string;
    name: string;
    domain_name: string;
  };
  /** Why this skill is recommended */
  reason: "level_up" | "function_gap" | "domain_expansion" | "market_demand";
  /** Human-readable explanation */
  reason_text: string;
  /** Priority score (higher = more recommended, 0-100) */
  priority: number;
  /** Paths that develop this skill (up to 3) */
  paths: LearningPath[];
}

// ─── Helpers ────────────────────────────────────────────────

/**
 * Estimate paths remaining until next fluency level.
 * Returns null if already at max or score-gated (can't level up with just more paths).
 */
function pathsUntilNextLevel(current: {
  fluency_level: SkillFluency;
  paths_completed: number;
  avg_score: number | null;
}): number | null {
  const { fluency_level, paths_completed, avg_score } = current;
  const score = avg_score ?? 0;

  if (fluency_level === "exploring") {
    // Need 2 paths + score >= 50 to reach practicing
    return Math.max(0, 2 - paths_completed);
  }
  if (fluency_level === "practicing") {
    // Need 4 paths + score >= 70 to reach proficient
    if (score < 70 && paths_completed >= 4) return null; // Score-gated
    return Math.max(0, 4 - paths_completed);
  }
  if (fluency_level === "proficient") {
    // Need 6 paths + score >= 80 to reach advanced
    if (score < 80 && paths_completed >= 6) return null;
    return Math.max(0, 6 - paths_completed);
  }
  return null; // Already advanced
}

// ─── Main Recommendation Function ───────────────────────────

/**
 * Generate skill-based recommendations for a user.
 *
 * @param userId - The authenticated user's ID
 * @param userFunction - The user's primary function (for relevance ranking)
 * @param limit - Max total recommendations to return (default 6)
 */
export async function getSkillRecommendations(
  userId: string,
  userFunction: string | null,
  limit: number = 6
): Promise<SkillRecommendation[]> {
  const admin = createAdminClient();

  // Load data in parallel
  const [allSkillsWithDomains, userSkillsResult] = await Promise.all([
    getSkillsWithDomains(),
    admin.from("fp_user_skills").select("*").eq("user_id", userId),
  ]);

  const userSkillMap = new Map(
    (userSkillsResult.data ?? []).map((s: UserSkill) => [s.skill_id, s])
  );

  const recommendations: SkillRecommendation[] = [];

  // ── Strategy 1: Level-Up Candidates ─────────────────────
  for (const skill of allSkillsWithDomains) {
    const userSkill = userSkillMap.get(skill.id);
    if (!userSkill) continue;

    const pathsNeeded = pathsUntilNextLevel({
      fluency_level: userSkill.fluency_level,
      paths_completed: userSkill.paths_completed,
      avg_score: userSkill.avg_score,
    });

    if (pathsNeeded !== null && pathsNeeded <= 2 && pathsNeeded > 0) {
      const nextLevel =
        userSkill.fluency_level === "exploring"
          ? "Practicing"
          : userSkill.fluency_level === "practicing"
            ? "Proficient"
            : "Advanced";

      recommendations.push({
        skill: {
          slug: skill.slug,
          name: skill.name,
          domain_name: skill.domain.name,
        },
        reason: "level_up",
        reason_text: `${pathsNeeded} more path${pathsNeeded !== 1 ? "s" : ""} to reach ${nextLevel}`,
        priority: 90 - pathsNeeded * 10, // 1 path away = 80, 2 paths = 70
        paths: [],
      });
    }
  }

  // ── Strategy 2: Function Gap Fill ───────────────────────
  if (userFunction) {
    for (const skill of allSkillsWithDomains) {
      if (userSkillMap.has(skill.id)) continue; // Already started

      const isRelevant =
        skill.relevant_functions.length === 0 ||
        skill.relevant_functions.includes(userFunction);
      if (!isRelevant) continue;

      recommendations.push({
        skill: {
          slug: skill.slug,
          name: skill.name,
          domain_name: skill.domain.name,
        },
        reason: "function_gap",
        reason_text: `Key skill for ${userFunction.replace(/_/g, " ")} professionals`,
        priority: 50 + (skill.relevant_functions.length === 0 ? 0 : 10),
        paths: [],
      });
    }
  }

  // ── Strategy 3: Domain Expansion ──────────────────────────
  const activeDomainIds = new Set(
    allSkillsWithDomains
      .filter((s) => userSkillMap.has(s.id))
      .map((s) => s.domain_id)
  );

  for (const skill of allSkillsWithDomains) {
    if (activeDomainIds.has(skill.domain_id)) continue;
    if (userSkillMap.has(skill.id)) continue;
    // Only recommend entry skills for unexplored domains
    if (skill.sort_order > 1) continue;

    recommendations.push({
      skill: {
        slug: skill.slug,
        name: skill.name,
        domain_name: skill.domain.name,
      },
      reason: "domain_expansion",
      reason_text: `Explore ${skill.domain.name}`,
      priority: 30,
      paths: [],
    });
  }

  // ── Strategy 4: Market Demand ────────────────────────────
  const marketStates = await getAllMarketStates();
  const risingSkills = marketStates.filter(
    (s) => s.direction === "rising" || s.direction === "emerging"
  );

  // Build slug → SkillWithDomain lookup
  const slugToSkill = new Map(allSkillsWithDomains.map((s) => [s.slug, s]));

  for (const ms of risingSkills) {
    const skill = slugToSkill.get(ms.skill_slug);
    if (!skill) continue;
    if (userSkillMap.has(skill.id)) continue; // Already started

    recommendations.push({
      skill: {
        slug: skill.slug,
        name: skill.name,
        domain_name: skill.domain.name,
      },
      reason: "market_demand",
      reason_text: `Demand surging — ${ms.practitioner_count} practitioners and growing`,
      priority: 65,
      paths: [],
    });
  }

  // ── Sort, deduplicate, limit ──────────────────────────────
  const seen = new Set<string>();
  const sorted = recommendations
    .sort((a, b) => b.priority - a.priority)
    .filter((r) => {
      if (seen.has(r.skill.slug)) return false;
      seen.add(r.skill.slug);
      return true;
    })
    .slice(0, limit);

  // ── Load paths for each recommendation ────────────────────
  if (sorted.length > 0) {
    const allSkills = await getSkills();
    const slugToId = new Map(allSkills.map((s) => [s.slug, s.id]));

    const skillIds = sorted
      .map((r) => slugToId.get(r.skill.slug))
      .filter(Boolean) as string[];

    if (skillIds.length > 0) {
      const { data: tagRows } = await admin
        .from("fp_skill_tags")
        .select("path_id, skill_id")
        .in("skill_id", skillIds)
        .eq("relevance", "primary");

      if (tagRows?.length) {
        const pathIds = [...new Set(tagRows.map((t: Record<string, unknown>) => t.path_id as string))];

        const { data: pathRows } = await admin
          .from("fp_learning_paths")
          .select("*")
          .in("id", pathIds.slice(0, 30))
          .order("completion_count", { ascending: false });

        if (pathRows?.length) {
          const skillToPathIds = new Map<string, string[]>();
          for (const tag of tagRows) {
            const sid = tag.skill_id as string;
            const existing = skillToPathIds.get(sid) ?? [];
            existing.push(tag.path_id as string);
            skillToPathIds.set(sid, existing);
          }

          const pathMap = new Map(
            pathRows.map((row: Record<string, unknown>) => [row.id as string, mapPathRow(row)])
          );

          // Batch-load skill tags for all fetched paths
          const { loadSkillTagsForPaths } = await import(
            "@/lib/skills/pathSkillTags"
          );
          const allFetchedIds = [...pathMap.keys()];
          const tagMap = await loadSkillTagsForPaths(allFetchedIds);
          for (const [pid, p] of pathMap) {
            p.skill_tags = tagMap.get(pid) ?? [];
          }

          for (const rec of sorted) {
            const skillId = slugToId.get(rec.skill.slug);
            if (!skillId) continue;
            const recPathIds = skillToPathIds.get(skillId) ?? [];
            rec.paths = recPathIds
              .map((id) => pathMap.get(id))
              .filter(Boolean)
              .slice(0, 3) as LearningPath[];
          }
        }
      }
    }
  }

  // Filter out recommendations with no paths
  return sorted.filter((r) => r.paths.length > 0);
}
