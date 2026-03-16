/**
 * Practitioner aggregation pipeline.
 *
 * Daily snapshot of practitioner skill data for trend analysis.
 * Aggregates fp_user_skills into fp_practitioner_snapshots.
 * One row per skill per day.
 */

import { createClient } from "@/lib/supabase/admin";
import { getSkills } from "@/lib/skills/taxonomy";

/** Result of a practitioner aggregation run. */
export interface PractitionerAggregationResult {
  skills_processed: number;
  snapshots_created: number;
  date: string;
}

/**
 * Aggregate practitioner data into daily snapshots.
 * Called daily at 3am UTC.
 */
export async function aggregatePractitionerSnapshots(): Promise<PractitionerAggregationResult> {
  const admin = createClient();
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  // ── 1. Load skill taxonomy for id → slug mapping ──────────
  const allSkills = await getSkills();
  const idToSlug = new Map(allSkills.map((s) => [s.id, s.slug]));

  // ── 2. Load all user skills ───────────────────────────────
  const { data: userSkillRows, error: usErr } = await admin
    .from("fp_user_skills")
    .select(
      "skill_id, fluency_level, first_demonstrated_at, last_demonstrated_at, paths_completed"
    );

  if (usErr) {
    console.error("[intelligence/practitioner] Load user skills error:", usErr);
    return { skills_processed: 0, snapshots_created: 0, date: today };
  }

  // ── 3. Group by skill_slug ────────────────────────────────
  const bySkill = new Map<
    string,
    {
      total: number;
      exploring: number;
      practicing: number;
      proficient: number;
      advanced: number;
      new_starts_7d: number;
      recent_activity_7d: number;
    }
  >();

  for (const row of userSkillRows ?? []) {
    const slug = idToSlug.get(row.skill_id as string);
    if (!slug) continue;

    const entry = bySkill.get(slug) ?? {
      total: 0,
      exploring: 0,
      practicing: 0,
      proficient: 0,
      advanced: 0,
      new_starts_7d: 0,
      recent_activity_7d: 0,
    };

    entry.total++;

    const level = row.fluency_level as string;
    if (level === "exploring") entry.exploring++;
    else if (level === "practicing") entry.practicing++;
    else if (level === "proficient") entry.proficient++;
    else if (level === "advanced") entry.advanced++;

    // New starts: first demonstrated in last 7 days
    if (row.first_demonstrated_at && row.first_demonstrated_at >= sevenDaysAgo) {
      entry.new_starts_7d++;
    }

    // Recent activity (as proxy for level-ups): demonstrated in last 7d with > 1 path
    if (
      row.last_demonstrated_at &&
      row.last_demonstrated_at >= sevenDaysAgo &&
      (row.paths_completed as number) > 1
    ) {
      entry.recent_activity_7d++;
    }

    bySkill.set(slug, entry);
  }

  // ── 4. Count completions per skill in last 7 days ─────────
  const completionsBySkill = new Map<string, number>();

  const { data: recentCompletions } = await admin
    .from("fp_learning_progress")
    .select("path_id")
    .eq("status", "completed")
    .gte("completed_at", sevenDaysAgo);

  if (recentCompletions && recentCompletions.length > 0) {
    const completedPathIds = [
      ...new Set(recentCompletions.map((r) => r.path_id as string)),
    ];

    // Load skill tags for completed paths
    const { data: skillTagRows } = await admin
      .from("fp_skill_tags")
      .select("skill_id")
      .in("path_id", completedPathIds.slice(0, 200)); // Cap for safety

    for (const tag of skillTagRows ?? []) {
      const slug = idToSlug.get(tag.skill_id as string);
      if (!slug) continue;
      completionsBySkill.set(slug, (completionsBySkill.get(slug) ?? 0) + 1);
    }
  }

  // ── 5. Count paths per skill ──────────────────────────────
  const pathsBySkill = new Map<string, number>();
  const { data: allTagRows } = await admin
    .from("fp_skill_tags")
    .select("skill_id");

  for (const tag of allTagRows ?? []) {
    const slug = idToSlug.get(tag.skill_id as string);
    if (!slug) continue;
    pathsBySkill.set(slug, (pathsBySkill.get(slug) ?? 0) + 1);
  }

  // ── 6. Write snapshots ────────────────────────────────────
  const allSlugs = new Set([
    ...bySkill.keys(),
    ...allSkills.map((s) => s.slug),
  ]);

  let created = 0;
  for (const slug of allSlugs) {
    const data = bySkill.get(slug);

    const { error: upsertErr } = await admin
      .from("fp_practitioner_snapshots")
      .upsert(
        {
          snapshot_date: today,
          skill_slug: slug,
          total_practitioners: data?.total ?? 0,
          exploring_count: data?.exploring ?? 0,
          practicing_count: data?.practicing ?? 0,
          proficient_count: data?.proficient ?? 0,
          advanced_count: data?.advanced ?? 0,
          new_starts_7d: data?.new_starts_7d ?? 0,
          completions_7d: completionsBySkill.get(slug) ?? 0,
          level_ups_7d: data?.recent_activity_7d ?? 0,
          paths_with_skill: pathsBySkill.get(slug) ?? 0,
        },
        { onConflict: "snapshot_date,skill_slug" }
      );

    if (upsertErr) {
      console.error(
        `[intelligence/practitioner] Upsert error for ${slug}:`,
        upsertErr
      );
    } else {
      created++;
    }
  }

  return { skills_processed: allSlugs.size, snapshots_created: created, date: today };
}
