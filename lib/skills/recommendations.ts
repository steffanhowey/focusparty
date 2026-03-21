/**
 * Skill-based path recommendations.
 *
 * Given a user's skill profile, function, and recent completions,
 * recommends the highest-leverage learning paths. Five strategies, blended:
 *
 * 1. CONTINUE MOMENTUM: Skills from the user's most recent path completion.
 *    "You just completed X — here's the next step."
 *
 * 2. LEVEL-UP CANDIDATES: Skills where the user is 1-2 paths away from
 *    advancing to the next fluency level.
 *
 * 3. FUNCTION GAP FILL: Skills relevant to the user's function that
 *    they haven't started yet.
 *
 * 4. MARKET DEMAND: Rising/emerging skills from market intelligence.
 *
 * 5. DOMAIN EXPANSION: Skills in domains the user hasn't explored yet.
 */

import { createClient as createAdminClient } from "@/lib/supabase/admin";
import {
  getSkills,
  getSkillsWithDomains,
  skillMatchesFunction,
} from "@/lib/skills/taxonomy";
import { mapPathRow } from "@/lib/learn/pathGenerator";
import { getAllMarketStates } from "@/lib/intelligence/marketState";
import {
  getLaunchRoomCatalogEntries,
  getPartyLaunchDisplayName,
  getPartyLaunchRoomEntry,
  isPartyLaunchVisible,
} from "@/lib/launchRooms";
import type { SkillFluency, UserSkill } from "@/lib/types/skills";
import type { LearningPath } from "@/lib/types";
import { getMissionRoute } from "@/lib/appRoutes";

// ─── Types ──────────────────────────────────────────────────

export type RecommendationReason =
  | "continue_momentum"
  | "level_up"
  | "function_gap"
  | "domain_expansion"
  | "market_demand";

export type RecommendationActionType = "start_path" | "join_room" | "continue_path";

export interface RecommendationAction {
  type: RecommendationActionType;
  label: string;
  href: string;
  /** Room-specific: room name and participant count */
  room_name?: string;
  participant_count?: number;
}

export interface SkillRecommendation {
  /** The recommended skill to develop */
  skill: {
    slug: string;
    name: string;
    domain_name: string;
    domain_slug: string;
  };
  /** Why this skill is recommended */
  reason: RecommendationReason;
  /** Human-readable explanation */
  reason_text: string;
  /** Priority score (higher = more recommended, 0-100) */
  priority: number;
  /** Paths that develop this skill (up to 3) */
  paths: LearningPath[];
  /** Best next action for this recommendation */
  action: RecommendationAction | null;
}

// ─── Helpers ────────────────────────────────────────────────

/**
 * Estimate paths remaining until next fluency level.
 * Returns null if already at max or score-gated.
 */
function pathsUntilNextLevel(current: {
  fluency_level: SkillFluency;
  paths_completed: number;
  avg_score: number | null;
}): number | null {
  const { fluency_level, paths_completed, avg_score } = current;
  const score = avg_score ?? 0;

  if (fluency_level === "exploring") {
    return Math.max(0, 2 - paths_completed);
  }
  if (fluency_level === "practicing") {
    if (score < 70 && paths_completed >= 4) return null;
    return Math.max(0, 4 - paths_completed);
  }
  if (fluency_level === "proficient") {
    if (score < 80 && paths_completed >= 6) return null;
    return Math.max(0, 6 - paths_completed);
  }
  return null;
}

/** Next fluency level label. */
function nextLevelLabel(current: SkillFluency): string {
  if (current === "exploring") return "Practicing";
  if (current === "practicing") return "Proficient";
  if (current === "proficient") return "Advanced";
  return "Advanced";
}

/**
 * Bounded freshness boost for path ranking.
 * 0-7 days: +30, 8-30 days: +15, older: 0
 */
function freshnessBoost(createdAt: string): number {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays <= 7) return 30;
  if (ageDays <= 30) return 15;
  return 0;
}

/**
 * Combined path score for ranking within recommendations.
 * Balances popularity + freshness.
 */
function pathScore(path: LearningPath): number {
  const popularity = Math.min(path.completion_count ?? 0, 100);
  const freshness = freshnessBoost(path.created_at);
  return popularity + freshness;
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
  limit: number = 6,
): Promise<SkillRecommendation[]> {
  const admin = createAdminClient();

  // Load data in parallel: skills, user skills, completed paths, in-progress paths, recent achievement
  const [
    allSkillsWithDomains,
    userSkillsResult,
    completedResult,
    inProgressResult,
    recentAchievement,
  ] = await Promise.all([
    getSkillsWithDomains(),
    admin.from("fp_user_skills").select("*").eq("user_id", userId),
    admin
      .from("fp_learning_progress")
      .select("path_id")
      .eq("user_id", userId)
      .eq("status", "completed"),
    admin
      .from("fp_learning_progress")
      .select("path_id, items_completed, items_total")
      .eq("user_id", userId)
      .eq("status", "in_progress"),
    admin
      .from("fp_achievements")
      .select("path_id, path_title, skill_receipt")
      .eq("user_id", userId)
      .order("completed_at", { ascending: false })
      .limit(1)
      .single(),
  ]);

  const userSkillMap = new Map(
    (userSkillsResult.data ?? []).map((s: UserSkill) => [s.skill_id, s]),
  );

  const completedPathIds = new Set(
    (completedResult.data ?? []).map(
      (r: Record<string, unknown>) => r.path_id as string,
    ),
  );

  // Map of in-progress path_id → percent complete (0-100)
  const inProgressMap = new Map<string, number>(
    (inProgressResult.data ?? []).map((r: Record<string, unknown>) => {
      const total = (r.items_total as number) || 1;
      const done = (r.items_completed as number) || 0;
      return [r.path_id as string, Math.round((done / total) * 100)];
    }),
  );

  // Extract recently progressed skills from the latest achievement's receipt
  const recentReceipt = recentAchievement.data?.skill_receipt as {
    path?: { title?: string };
    skills?: Array<{
      skill: { slug: string; name: string; domain_name: string };
      relevance: string;
      leveled_up: boolean;
    }>;
  } | null;
  const recentPathTitle =
    (recentAchievement.data?.path_title as string) ??
    recentReceipt?.path?.title ??
    null;

  const recommendations: SkillRecommendation[] = [];
  const slugToSkill = new Map(
    allSkillsWithDomains.map((s) => [s.slug, s]),
  );

  // ── Strategy 1: Continue Momentum ─────────────────────────
  // If user recently completed a path, boost skills from that receipt
  if (recentReceipt?.skills && recentPathTitle) {
    for (const entry of recentReceipt.skills) {
      const skill = slugToSkill.get(entry.skill.slug);
      if (!skill) continue;

      const userSkill = userSkillMap.get(skill.id);
      if (!userSkill) continue;

      // Only recommend if there's room to grow
      const pathsNeeded = pathsUntilNextLevel({
        fluency_level: userSkill.fluency_level,
        paths_completed: userSkill.paths_completed,
        avg_score: userSkill.avg_score,
      });
      if (pathsNeeded === null || pathsNeeded === 0) continue;

      const nextLevel = nextLevelLabel(userSkill.fluency_level);

      recommendations.push({
        skill: {
          slug: skill.slug,
          name: skill.name,
          domain_name: skill.domain.name,
          domain_slug: skill.domain.slug,
        },
        reason: "continue_momentum",
        reason_text: `You completed "${recentPathTitle.length > 30 ? recentPathTitle.slice(0, 27) + "..." : recentPathTitle}" — ${pathsNeeded} more to ${nextLevel}`,
        priority: 85,
        paths: [],
        action: null,
      });
    }
  }

  // ── Strategy 2: Level-Up Candidates ─────────────────────────
  for (const skill of allSkillsWithDomains) {
    const userSkill = userSkillMap.get(skill.id);
    if (!userSkill) continue;

    const pathsNeeded = pathsUntilNextLevel({
      fluency_level: userSkill.fluency_level,
      paths_completed: userSkill.paths_completed,
      avg_score: userSkill.avg_score,
    });

    if (pathsNeeded !== null && pathsNeeded <= 2 && pathsNeeded > 0) {
      const nextLevel = nextLevelLabel(userSkill.fluency_level);

      recommendations.push({
        skill: {
          slug: skill.slug,
          name: skill.name,
          domain_name: skill.domain.name,
          domain_slug: skill.domain.slug,
        },
        reason: "level_up",
        reason_text: `You're ${userSkill.paths_completed} path${userSkill.paths_completed !== 1 ? "s" : ""} in — ${pathsNeeded} more to reach ${nextLevel}`,
        priority: 90 - pathsNeeded * 10,
        paths: [],
        action: null,
      });
    }
  }

  // ── Strategy 3: Function Gap Fill ─────────────────────────
  if (userFunction) {
    const fnLabel = userFunction
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    for (const skill of allSkillsWithDomains) {
      if (userSkillMap.has(skill.id)) continue;

      const isRelevant = skillMatchesFunction(
        skill.relevant_functions,
        userFunction,
      );
      if (!isRelevant) continue;

      recommendations.push({
        skill: {
          slug: skill.slug,
          name: skill.name,
          domain_name: skill.domain.name,
          domain_slug: skill.domain.slug,
        },
        reason: "function_gap",
        reason_text: `Essential for ${fnLabel} — start building ${skill.name}`,
        priority: 50 + (skill.relevant_functions.length === 0 ? 0 : 10),
        paths: [],
        action: null,
      });
    }
  }

  // ── Strategy 4: Market Demand ──────────────────────────────
  const marketStates = await getAllMarketStates();
  const risingSkills = marketStates.filter(
    (s) => s.direction === "rising" || s.direction === "emerging",
  );

  for (const ms of risingSkills) {
    const skill = slugToSkill.get(ms.skill_slug);
    if (!skill) continue;
    if (userSkillMap.has(skill.id)) continue;

    recommendations.push({
      skill: {
        slug: skill.slug,
        name: skill.name,
        domain_name: skill.domain.name,
        domain_slug: skill.domain.slug,
      },
      reason: "market_demand",
      reason_text: `Trending in AI — ${ms.practitioner_count > 0 ? `${ms.practitioner_count} professionals developing this` : "demand is surging"}`,
      priority: 65,
      paths: [],
      action: null,
    });
  }

  // ── Strategy 5: Domain Expansion ──────────────────────────
  const activeDomainIds = new Set(
    allSkillsWithDomains
      .filter((s) => userSkillMap.has(s.id))
      .map((s) => s.domain_id),
  );

  for (const skill of allSkillsWithDomains) {
    if (activeDomainIds.has(skill.domain_id)) continue;
    if (userSkillMap.has(skill.id)) continue;
    if (skill.sort_order > 1) continue;

    recommendations.push({
      skill: {
        slug: skill.slug,
        name: skill.name,
        domain_name: skill.domain.name,
        domain_slug: skill.domain.slug,
      },
      reason: "domain_expansion",
      reason_text: `Explore ${skill.domain.name}`,
      priority: 30,
      paths: [],
      action: null,
    });
  }

  // ── Sort, deduplicate, limit ──────────────────────────────
  const seen = new Set<string>();
  const candidateLimit = Math.max(limit * 3, limit);
  const sorted = recommendations
    .sort((a, b) => b.priority - a.priority)
    .filter((r) => {
      if (seen.has(r.skill.slug)) return false;
      seen.add(r.skill.slug);
      return true;
    })
    .slice(0, candidateLimit);

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
        const pathIds = [
          ...new Set(
            tagRows.map(
              (t: Record<string, unknown>) => t.path_id as string,
            ),
          ),
        ];

        const { data: pathRows } = await admin
          .from("fp_learning_paths")
          .select("*")
          .in("id", pathIds.slice(0, 30));

        if (pathRows?.length) {
          const skillToPathIds = new Map<string, string[]>();
          for (const tag of tagRows) {
            const sid = tag.skill_id as string;
            const existing = skillToPathIds.get(sid) ?? [];
            existing.push(tag.path_id as string);
            skillToPathIds.set(sid, existing);
          }

          const pathMap = new Map(
            pathRows.map((row: Record<string, unknown>) => [
              row.id as string,
              mapPathRow(row),
            ]),
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
              .filter(
                (p): p is LearningPath =>
                  !!p && !completedPathIds.has(p.id),
              )
              .sort((a, b) => pathScore(b) - pathScore(a))
              .slice(0, 3);
          }
        }
      }
    }
  }

  // ── Resolve actions: best next step for each recommendation ──
  // Build domain → launch-room mapping from the launch catalog
  const domainToLaunchRooms = new Map<string, string[]>();
  for (const room of getLaunchRoomCatalogEntries()) {
    for (const domain of room.supportedMissionDomains) {
      const existing = domainToLaunchRooms.get(domain) ?? [];
      existing.push(room.key);
      domainToLaunchRooms.set(domain, existing);
    }
  }

  // Load active persistent rooms with participant counts
  const { data: activeRooms } = await admin
    .from("fp_parties")
    .select("id, name, world_key, launch_room_key, launch_visible, runtime_profile_key, persistent, blueprint_id")
    .eq("persistent", true)
    .in("status", ["waiting", "active"]);

  const roomsByLaunchKey = new Map<string, Array<{ id: string; name: string }>>();
  for (const room of activeRooms ?? []) {
    if (!isPartyLaunchVisible(room)) continue;
    const launchRoom = getPartyLaunchRoomEntry(room);
    if (!launchRoom) continue;
    const existing = roomsByLaunchKey.get(launchRoom.key) ?? [];
    existing.push({
      id: room.id as string,
      name: getPartyLaunchDisplayName(room),
    });
    roomsByLaunchKey.set(launchRoom.key, existing);
  }

  // ── Resolve actions: deterministic CTA per recommendation ──
  // Priority: Continue (in-progress) > Start Path + room hint > Start Path

  // Find the best matching room for a skill domain
  function findRoomForDomain(
    domainSlug: string,
  ): { id: string; name: string } | null {
    const matchingLaunchRooms = domainToLaunchRooms.get(domainSlug) ?? [];
    for (const launchRoomKey of matchingLaunchRooms) {
      const rooms = roomsByLaunchKey.get(launchRoomKey);
      if (rooms && rooms.length > 0) return rooms[0];
    }
    // Fallback: Research Room or Open Studio
    return (
      roomsByLaunchKey.get("research-room")?.[0] ??
      roomsByLaunchKey.get("open-studio")?.[0] ??
      null
    );
  }

  for (const rec of sorted) {
    if (rec.paths.length === 0) continue;

    const topPath = rec.paths[0];
    const progress = inProgressMap.get(topPath.id);
    const matchedRoom = findRoomForDomain(rec.skill.domain_slug);

    if (progress !== undefined) {
      // User has already started this path — Continue
      rec.action = {
        type: "continue_path",
        label: `Continue — ${progress}%`,
        href: getMissionRoute(topPath.id),
        room_name: matchedRoom?.name,
      };
    } else {
      // New path — Start, with optional room hint
      rec.action = {
        type: "start_path",
        label: "Start path",
        href: getMissionRoute(topPath.id),
        room_name: matchedRoom?.name,
      };
    }
  }

  // Filter out recommendations with no paths
  return sorted.filter((r) => r.paths.length > 0).slice(0, limit);
}
