/**
 * GET /api/learn/skill-receipt/:pathId
 *
 * Returns the skill receipt for a completed path.
 * Reconstructs from stored fp_user_skills data.
 * The "write" happens during path completion (PATCH /api/learn/paths/:id).
 */

import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSkillsWithDomains } from "@/lib/skills/taxonomy";
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

  // Verify path is completed by this user
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

  // Load path info
  const { data: pathRow } = await admin
    .from("fp_learning_paths")
    .select("id, title")
    .eq("id", pathId)
    .single();

  if (!pathRow) {
    return NextResponse.json({ error: "Path not found" }, { status: 404 });
  }

  // Load skill tags for this path
  const { data: tagRows } = await admin
    .from("fp_skill_tags")
    .select("skill_id, relevance")
    .eq("path_id", pathId);

  if (!tagRows?.length) {
    return NextResponse.json({ skill_receipt: null });
  }

  // Load full skill info
  const allSkills = await getSkillsWithDomains();
  const skillMap = new Map(allSkills.map((s) => [s.id, s]));

  // Load user's current skill data
  const skillIds = tagRows.map((t) => t.skill_id);
  const { data: userSkills } = await admin
    .from("fp_user_skills")
    .select("*")
    .eq("user_id", user.id)
    .in("skill_id", skillIds);

  const userSkillMap = new Map(
    (userSkills ?? []).map((s: UserSkill) => [s.skill_id, s]),
  );

  // Build receipt entries (after-only — approximate "before" by subtracting 1 path)
  const entries: SkillReceiptEntry[] = [];

  for (const tag of tagRows) {
    const skill = skillMap.get(tag.skill_id);
    if (!skill) continue;

    const userSkill = userSkillMap.get(tag.skill_id);
    const currentFluency: SkillFluency =
      (userSkill?.fluency_level as SkillFluency) ?? "exploring";
    const currentPaths = userSkill?.paths_completed ?? 0;

    // Approximate "before" by subtracting 1 path
    const approxBeforePaths = Math.max(0, currentPaths - 1);
    const approxBeforeFluency: SkillFluency =
      currentPaths <= 1 ? "exploring" : currentFluency;

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
      leveled_up: false, // Can't reliably reconstruct — only accurate at completion time
      missions_in_path: 0,
      avg_score_in_path: null,
    });
  }

  // Sort: primary first
  entries.sort((a, b) => (a.relevance === "primary" ? -1 : 1));

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
