/**
 * GET /api/skills/profile
 *
 * Returns the authenticated user's full skill profile.
 * Merges the complete skill taxonomy with the user's fp_user_skills data
 * to produce a domain-organized view showing both active and undiscovered skills.
 */

import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getSkillDomains,
  getSkills,
  skillMatchesFunction,
} from "@/lib/skills/taxonomy";
import { fluencyIndex } from "@/lib/skills/assessment";
import type { SkillFluency, UserSkill } from "@/lib/types/skills";

export async function GET(): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Load taxonomy, user skills, recent achievements, and user profile in parallel
  const [
    domains,
    skills,
    userSkillsResult,
    achievementsResult,
    profileResult,
    completedProgressResult,
  ] =
    await Promise.all([
      getSkillDomains(),
      getSkills(),
      admin.from("fp_user_skills").select("*").eq("user_id", user.id),
      admin
        .from("fp_achievements")
        .select("id, path_id, path_title, path_topics, items_completed, time_invested_seconds, difficulty_level, share_slug, skill_receipt, completed_at")
        .eq("user_id", user.id)
        .order("completed_at", { ascending: false })
        .limit(5),
      admin
        .from("fp_profiles")
        .select("primary_function")
        .eq("id", user.id)
        .single(),
      admin
        .from("fp_learning_progress")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "completed"),
    ]);

  const userFunction =
    (profileResult.data?.primary_function as string) ?? null;

  const userSkillMap = new Map(
    (userSkillsResult.data ?? []).map((s: UserSkill) => [s.skill_id, s]),
  );

  // Build domain-organized response
  const domainSections = domains.map((domain) => {
    const domainSkills = skills
      .filter((s) => s.domain_id === domain.id)
      .map((skill) => {
        const userSkill = userSkillMap.get(skill.id);
        return {
          skill: {
            id: skill.id,
            slug: skill.slug,
            name: skill.name,
            description: skill.description,
            relevant_functions: skill.relevant_functions,
          },
          progress: userSkill
            ? {
                fluency_level: userSkill.fluency_level as SkillFluency,
                paths_completed: userSkill.paths_completed,
                missions_completed: userSkill.missions_completed,
                avg_score: userSkill.avg_score,
                last_demonstrated_at: userSkill.last_demonstrated_at,
              }
            : null,
        };
      })
      // Sort: active skills first (by fluency desc), then undiscovered
      .sort((a, b) => {
        if (a.progress && !b.progress) return -1;
        if (!a.progress && b.progress) return 1;
        if (a.progress && b.progress) {
          return (
            fluencyIndex(b.progress.fluency_level) -
            fluencyIndex(a.progress.fluency_level)
          );
        }
        return 0;
      });

    const activeSkills = domainSkills.filter((s) => s.progress);
    const avgFluency =
      activeSkills.length > 0
        ? activeSkills.reduce(
            (sum, s) => sum + fluencyIndex(s.progress!.fluency_level),
            0,
          ) / activeSkills.length
        : 0;

    return {
      domain: {
        id: domain.id,
        slug: domain.slug,
        name: domain.name,
        description: domain.description,
        icon: domain.icon,
      },
      skills: domainSkills,
      active_count: activeSkills.length,
      total_count: domainSkills.length,
      avg_fluency: Math.round(avgFluency * 100) / 100,
    };
  });

  // Summary stats
  const allUserSkills = (userSkillsResult.data ?? []) as UserSkill[];

  // Compute effective fluency from actual skill data.
  // Uses the highest fluency level achieved across any skill (ceiling),
  // falling back to "exploring" if no skills have been developed.
  const fluencyLevels: SkillFluency[] = ["exploring", "practicing", "proficient", "advanced"];
  let effectiveFluency: SkillFluency = "exploring";
  if (allUserSkills.length > 0) {
    // Use the mode (most common level), breaking ties toward higher
    const counts: Record<SkillFluency, number> = {
      exploring: 0,
      practicing: 0,
      proficient: 0,
      advanced: 0,
    };
    for (const s of allUserSkills) {
      const level = s.fluency_level as SkillFluency;
      if (level in counts) counts[level]++;
    }
    let maxCount = 0;
    for (const level of fluencyLevels) {
      if (counts[level] >= maxCount) {
        maxCount = counts[level];
        effectiveFluency = level;
      }
    }
  }

  const summary = {
    total_skills_started: allUserSkills.length,
    total_skills_available: skills.length,
    skills_at_exploring: allUserSkills.filter(
      (s) => s.fluency_level === "exploring",
    ).length,
    skills_at_practicing: allUserSkills.filter(
      (s) => s.fluency_level === "practicing",
    ).length,
    skills_at_proficient: allUserSkills.filter(
      (s) => s.fluency_level === "proficient",
    ).length,
    skills_at_advanced: allUserSkills.filter(
      (s) => s.fluency_level === "advanced",
    ).length,
    total_paths_completed: completedProgressResult.count ?? 0,
    effective_fluency: effectiveFluency,
  };

  // ── Gap analysis ─────────────────────────────────────────────
  // Compute three gap-related views from existing data.

  // 1. Function gaps: skills relevant to user's function they haven't started
  const functionGaps: Array<{
    skill_slug: string;
    skill_name: string;
    domain_name: string;
    domain_icon: string;
  }> = [];
  if (userFunction) {
    for (const skill of skills) {
      if (userSkillMap.has(skill.id)) continue; // Already started
      const isRelevant = skillMatchesFunction(
        skill.relevant_functions,
        userFunction,
      );
      if (!isRelevant) continue;

      const domain = domains.find((d) => d.id === skill.domain_id);
      functionGaps.push({
        skill_slug: skill.slug,
        skill_name: skill.name,
        domain_name: domain?.name ?? "",
        domain_icon: domain?.icon ?? "star",
      });
    }
  }

  // 2. Active progression: skills user is working on with paths-to-next-level
  const activeProgression: Array<{
    skill_slug: string;
    skill_name: string;
    fluency_level: SkillFluency;
    paths_completed: number;
    paths_to_next: number;
    next_level: string;
  }> = [];
  for (const us of allUserSkills) {
    const skill = skills.find((s) => s.id === us.skill_id);
    if (!skill) continue;
    const fluency = us.fluency_level as SkillFluency;
    const score = us.avg_score ?? 0;
    let pathsToNext: number | null = null;
    let nextLevel = "";

    if (fluency === "exploring") {
      pathsToNext = Math.max(0, 2 - us.paths_completed);
      nextLevel = "Practicing";
    } else if (fluency === "practicing") {
      if (!(score < 70 && us.paths_completed >= 4)) {
        pathsToNext = Math.max(0, 4 - us.paths_completed);
        nextLevel = "Proficient";
      }
    } else if (fluency === "proficient") {
      if (!(score < 80 && us.paths_completed >= 6)) {
        pathsToNext = Math.max(0, 6 - us.paths_completed);
        nextLevel = "Advanced";
      }
    }

    if (pathsToNext !== null && pathsToNext > 0) {
      activeProgression.push({
        skill_slug: skill.slug,
        skill_name: skill.name,
        fluency_level: fluency,
        paths_completed: us.paths_completed,
        paths_to_next: pathsToNext,
        next_level: nextLevel,
      });
    }
  }
  activeProgression.sort((a, b) => a.paths_to_next - b.paths_to_next);

  // 3. Strongest skills: top 3 by fluency level then paths completed
  const strongest = allUserSkills
    .map((us) => {
      const skill = skills.find((s) => s.id === us.skill_id);
      if (!skill) return null;
      const domain = domains.find((d) => d.id === skill.domain_id);
      return {
        skill_slug: skill.slug,
        skill_name: skill.name,
        domain_name: domain?.name ?? "",
        fluency_level: us.fluency_level as SkillFluency,
        paths_completed: us.paths_completed,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const fi = fluencyIndex(b!.fluency_level) - fluencyIndex(a!.fluency_level);
      if (fi !== 0) return fi;
      return b!.paths_completed - a!.paths_completed;
    })
    .slice(0, 3) as Array<{
    skill_slug: string;
    skill_name: string;
    domain_name: string;
    fluency_level: SkillFluency;
    paths_completed: number;
  }>;

  const gaps = {
    user_function: userFunction,
    function_gaps: functionGaps.slice(0, 6),
    active_progression: activeProgression.slice(0, 4),
    strongest,
  };

  const recentAchievements = (achievementsResult.data ?? []).map(
    (a: Record<string, unknown>) => ({
      id: a.id,
      path_id: a.path_id,
      path_title: a.path_title,
      path_topics: a.path_topics,
      items_completed: a.items_completed,
      time_invested_seconds: a.time_invested_seconds,
      difficulty_level: a.difficulty_level,
      share_slug: a.share_slug,
      skill_receipt: a.skill_receipt,
      completed_at: a.completed_at,
    }),
  );

  return NextResponse.json({
    domains: domainSections,
    summary,
    gaps,
    recent_achievements: recentAchievements,
  });
}
