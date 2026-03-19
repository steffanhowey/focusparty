/**
 * GET /api/learn/skill-receipt/:pathId
 *
 * Returns the skill receipt for a completed path.
 * Prefers the persisted receipt from fp_achievements (exact before/after).
 * Falls back to reconstruction from current fp_user_skills state for
 * paths completed before receipt persistence was added.
 */

import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSkillsWithDomains } from "@/lib/skills/taxonomy";
import { assessFluencyLevel } from "@/lib/skills/assessment";
import type { SkillReceiptEntry, UserSkill, SkillFluency } from "@/lib/types/skills";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ pathId: string }> },
): Promise<Response> {
  const { pathId } = await params;

  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Try to load the persisted receipt from fp_achievements first.
  // This has the exact before/after snapshot from completion time.
  const { data: achievementRow } = await admin
    .from("fp_achievements")
    .select("skill_receipt, completed_at, path_title")
    .eq("user_id", user.id)
    .eq("path_id", pathId)
    .single();

  if (achievementRow?.skill_receipt) {
    return NextResponse.json({ skill_receipt: achievementRow.skill_receipt });
  }

  // Fallback: reconstruct from current state (approximate before/after)
  const { data: progressRow } = await admin
    .from("fp_learning_progress")
    .select("completed_at, path_id")
    .eq("user_id", user.id)
    .eq("path_id", pathId)
    .eq("status", "completed")
    .single();

  if (!progressRow?.completed_at) {
    return NextResponse.json({ error: "Path not completed" }, { status: 404 });
  }

  const { data: pathRow } = await admin
    .from("fp_learning_paths")
    .select("id, title")
    .eq("id", pathId)
    .single();

  if (!pathRow) {
    return NextResponse.json({ error: "Path not found" }, { status: 404 });
  }

  const { data: tagRows } = await admin
    .from("fp_skill_tags")
    .select("skill_id, relevance")
    .eq("path_id", pathId);

  if (!tagRows?.length) {
    return NextResponse.json({ skill_receipt: null });
  }

  const allSkills = await getSkillsWithDomains();
  const skillMap = new Map(allSkills.map((s) => [s.id, s]));

  const skillIds = tagRows.map((t) => t.skill_id);
  const { data: userSkills } = await admin
    .from("fp_user_skills")
    .select("*")
    .eq("user_id", user.id)
    .in("skill_id", skillIds);

  const userSkillMap = new Map(
    (userSkills ?? []).map((s: UserSkill) => [s.skill_id, s]),
  );

  const entries: SkillReceiptEntry[] = [];

  for (const tag of tagRows) {
    const skill = skillMap.get(tag.skill_id);
    if (!skill) continue;

    const userSkill = userSkillMap.get(tag.skill_id);
    const currentPaths = Math.max(userSkill?.paths_completed ?? 0, 1);
    const currentAvgScore = userSkill?.avg_score ?? null;
    const currentFluency: SkillFluency =
      (userSkill?.fluency_level as SkillFluency) ??
      assessFluencyLevel({
        paths_completed: currentPaths,
        avg_score: currentAvgScore,
      });

    const approxBeforePaths = Math.max(0, currentPaths - 1);
    const approxBeforeFluency = assessFluencyLevel({
      paths_completed: approxBeforePaths,
      avg_score: currentAvgScore,
    });

    entries.push({
      skill: {
        slug: skill.slug,
        name: skill.name,
        domain_slug: skill.domain.slug,
        domain_name: skill.domain.name,
        domain_icon: skill.domain.icon,
      },
      relevance: tag.relevance as "primary" | "secondary",
      before: {
        fluency_level: approxBeforeFluency,
        paths_completed: approxBeforePaths,
      },
      after: {
        fluency_level: currentFluency,
        paths_completed: currentPaths,
      },
      leveled_up: false,
      missions_in_path: 0,
      avg_score_in_path: null,
    });
  }

  entries.sort((a, b) => {
    if (a.relevance === b.relevance) return 0;
    return a.relevance === "primary" ? -1 : 1;
  });

  return NextResponse.json({
    skill_receipt: {
      path: {
        id: pathId,
        title: pathRow.title,
        completed_at: progressRow.completed_at,
      },
      skills: entries,
      is_first_receipt: false,
    },
  });
}
