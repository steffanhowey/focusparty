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
import { getSkillDomains, getSkills } from "@/lib/skills/taxonomy";
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

  // Load taxonomy and user skills in parallel
  const [domains, skills, userSkillsResult] = await Promise.all([
    getSkillDomains(),
    getSkills(),
    admin.from("fp_user_skills").select("*").eq("user_id", user.id),
  ]);

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
    total_paths_completed: allUserSkills.reduce(
      (sum, s) => sum + s.paths_completed,
      0,
    ),
  };

  return NextResponse.json({ domains: domainSections, summary });
}
