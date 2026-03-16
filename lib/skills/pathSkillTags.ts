/**
 * Batch skill tag loading for learning paths.
 *
 * Two functions:
 * - loadSkillTagsForPaths: batch loader for many paths (search/discovery)
 * - loadSkillTagsWithUser: single path with user fluency (path detail)
 *
 * Both resolve skill_id → slug/name via the in-memory taxonomy cache
 * rather than complex Supabase joins.
 */

import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { getSkillsWithDomains, getSkillTagsForPath } from "@/lib/skills/taxonomy";
import type { SkillFluency, UserSkill } from "@/lib/types/skills";

/** Shape matching LearningPath.skill_tags */
export interface PathSkillTag {
  skill_slug: string;
  skill_name: string;
  domain_name: string;
  relevance: "primary" | "secondary";
  user_fluency?: SkillFluency;
}

/**
 * Load skill tags for a batch of learning paths.
 * Returns a map of path_id → skill tags (primary first, max 3 per path).
 */
export async function loadSkillTagsForPaths(
  pathIds: string[],
): Promise<Map<string, PathSkillTag[]>> {
  if (pathIds.length === 0) return new Map();

  const admin = createAdminClient();

  const { data: tagRows, error } = await admin
    .from("fp_skill_tags")
    .select("path_id, skill_id, relevance")
    .in("path_id", pathIds);

  if (error || !tagRows?.length) return new Map();

  // Resolve skill_id → slug/name via cached taxonomy
  const allSkills = await getSkillsWithDomains();
  const skillMap = new Map(allSkills.map((s) => [s.id, s]));

  const result = new Map<string, PathSkillTag[]>();

  // Sort: primary first, then secondary
  const sorted = [...tagRows].sort((a, b) => {
    if (a.relevance === "primary" && b.relevance !== "primary") return -1;
    if (a.relevance !== "primary" && b.relevance === "primary") return 1;
    return 0;
  });

  for (const row of sorted) {
    const pid = row.path_id as string;
    const tags = result.get(pid) ?? [];
    if (tags.length >= 3) continue; // Cap at 3 per path

    const skill = skillMap.get(row.skill_id as string);
    if (!skill) continue;

    tags.push({
      skill_slug: skill.slug,
      skill_name: skill.name,
      domain_name: skill.domain.name,
      relevance: row.relevance as "primary" | "secondary",
    });
    result.set(pid, tags);
  }

  return result;
}

/**
 * Load skill tags for a single path with user fluency context.
 * Used in the path detail page where we know the authenticated user.
 */
export async function loadSkillTagsWithUser(
  pathId: string,
  userId: string,
): Promise<PathSkillTag[]> {
  const admin = createAdminClient();

  // Use existing taxonomy function for path tags
  const skillTags = await getSkillTagsForPath(pathId);
  if (skillTags.length === 0) return [];

  // Load user's fluency for these skills
  const skillIds = skillTags.map((s) => s.id);
  const { data: userSkillRows } = await admin
    .from("fp_user_skills")
    .select("skill_id, fluency_level")
    .eq("user_id", userId)
    .in("skill_id", skillIds);

  const userFluencyMap = new Map(
    (userSkillRows ?? []).map((r: Record<string, unknown>) => [
      r.skill_id as string,
      r.fluency_level as SkillFluency,
    ]),
  );

  return skillTags
    .sort((a, b) => {
      if (a.relevance === "primary" && b.relevance !== "primary") return -1;
      if (a.relevance !== "primary" && b.relevance === "primary") return 1;
      return 0;
    })
    .slice(0, 3)
    .map((s) => ({
      skill_slug: s.slug,
      skill_name: s.name,
      domain_name: s.domain.name,
      relevance: s.relevance,
      user_fluency: userFluencyMap.get(s.id),
    }));
}
