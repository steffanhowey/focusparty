/**
 * Skill receipt calculator.
 *
 * Given a completed path and the user's submission data, computes the
 * skill receipt: which skills were developed, before/after fluency levels,
 * and whether any level-ups occurred. Also upserts fp_user_skills.
 *
 * Called from the path completion handler (PATCH /api/learn/paths/:id).
 * Uses the admin client — never called from the browser.
 */

import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { getSkillsWithDomains } from "@/lib/skills/taxonomy";
import { assessFluencyLevel, recalculateAvgScore } from "@/lib/skills/assessment";
import type { SkillReceipt, SkillReceiptEntry, UserSkill } from "@/lib/types/skills";

interface ReceiptInput {
  userId: string;
  pathId: string;
  pathTitle: string;
  completedAt: string;
  /** The item_states JSONB from fp_learning_progress */
  itemStates: Record<string, { completed?: boolean; evaluation?: Record<string, unknown> }>;
  /** The path's items array (to identify which items are "do" tasks) */
  pathItems: Array<{
    item_id?: string;
    task_type?: string;
    mission?: { objective?: string };
  }>;
}

/**
 * Calculate and persist the skill receipt for a completed path.
 *
 * Steps:
 * 1. Load skill tags for this path
 * 2. Snapshot current user_skills (before state)
 * 3. Extract mission scores from item_states
 * 4. Upsert fp_user_skills with updated data
 * 5. Return the receipt with before/after comparison
 *
 * Fails gracefully — returns null on any error. Path completion
 * should never be blocked by a skill receipt failure.
 */
export async function calculateSkillReceipt(
  input: ReceiptInput,
): Promise<SkillReceipt | null> {
  try {
    const admin = createAdminClient();

    // ── 1. Load skill tags for this path ──────────────────────
    const { data: tagRows, error: tagErr } = await admin
      .from("fp_skill_tags")
      .select("skill_id, relevance")
      .eq("path_id", input.pathId);

    if (tagErr || !tagRows?.length) {
      console.log("[skill-receipt] No skill tags for path, skipping receipt");
      return null;
    }

    // Load full skill info
    const allSkills = await getSkillsWithDomains();
    const skillMap = new Map(allSkills.map((s) => [s.id, s]));

    // ── 2. Snapshot current user skills (before state) ────────
    const skillIds = tagRows.map((t) => t.skill_id);

    const { data: existingSkills } = await admin
      .from("fp_user_skills")
      .select("*")
      .eq("user_id", input.userId)
      .in("skill_id", skillIds);

    const existingMap = new Map(
      (existingSkills ?? []).map((s: UserSkill) => [s.skill_id, s]),
    );

    // Check if this is the user's first ever receipt
    const { count: totalUserSkills } = await admin
      .from("fp_user_skills")
      .select("*", { count: "exact", head: true })
      .eq("user_id", input.userId);

    const isFirstReceipt = (totalUserSkills ?? 0) === 0;

    // ── 3. Extract mission scores from item_states ────────────
    // Find all "do" tasks and their evaluation scores
    const missionScores: number[] = [];
    let missionCount = 0;

    for (const item of input.pathItems) {
      if (item.task_type !== "do") continue;

      const itemId = item.item_id;
      if (!itemId) continue;

      const state = input.itemStates[itemId];
      if (!state?.completed) continue;

      missionCount++;

      // Extract score from evaluation if present.
      // Skip null scores (unevaluated/failed evaluations) — they must not
      // inflate fluency assessment. Only real AI evaluations count.
      if (state.evaluation) {
        const eval_ = state.evaluation;
        if (typeof eval_.score === "number" && eval_.score > 0) {
          missionScores.push(eval_.score);
        } else if (eval_.quality === "nailed_it") {
          missionScores.push(90);
        } else if (eval_.quality === "good") {
          missionScores.push(70);
        } else if (eval_.quality === "needs_iteration") {
          missionScores.push(45);
        }
        // null score or unrecognized quality → not counted
      }
    }

    // ── 4. Upsert fp_user_skills ──────────────────────────────
    const receiptEntries: SkillReceiptEntry[] = [];

    for (const tag of tagRows) {
      const skill = skillMap.get(tag.skill_id);
      if (!skill) continue;

      const existing = existingMap.get(tag.skill_id);

      // Before state
      const before = {
        fluency_level: (existing?.fluency_level ?? "exploring") as SkillReceiptEntry["before"]["fluency_level"],
        paths_completed: existing?.paths_completed ?? 0,
      };

      // Calculate new values
      const newPathsCompleted = (existing?.paths_completed ?? 0) + 1;
      const newMissionsCompleted =
        (existing?.missions_completed ?? 0) + missionCount;

      const { avg_score: newAvg, total_count: newTotalScored } =
        recalculateAvgScore(
          existing?.avg_score ?? null,
          existing?.total_scored_missions ?? 0,
          missionScores,
        );

      const newFluency = assessFluencyLevel({
        paths_completed: newPathsCompleted,
        avg_score:
          missionScores.length > 0 ? newAvg : (existing?.avg_score ?? null),
      });

      // After state
      const after = {
        fluency_level: newFluency,
        paths_completed: newPathsCompleted,
      };

      // Upsert
      const now = new Date().toISOString();
      const upsertData = {
        user_id: input.userId,
        skill_id: tag.skill_id,
        fluency_level: newFluency,
        paths_completed: newPathsCompleted,
        missions_completed: newMissionsCompleted,
        avg_score:
          missionScores.length > 0 ? newAvg : (existing?.avg_score ?? null),
        total_scored_missions: newTotalScored,
        last_demonstrated_at: now,
        updated_at: now,
        ...(existing ? {} : { first_demonstrated_at: now }),
      };

      const { error: upsertErr } = await admin
        .from("fp_user_skills")
        .upsert(upsertData, { onConflict: "user_id,skill_id" });

      if (upsertErr) {
        console.error("[skill-receipt] upsert error:", upsertErr);
        // Continue processing other skills — don't fail the whole receipt
      }

      // Build receipt entry
      const leveledUp = after.fluency_level !== before.fluency_level;

      receiptEntries.push({
        skill: {
          slug: skill.slug,
          name: skill.name,
          domain_slug: skill.domain.slug,
          domain_name: skill.domain.name,
          domain_icon: skill.domain.icon,
        },
        relevance: tag.relevance as "primary" | "secondary",
        before,
        after,
        leveled_up: leveledUp,
        missions_in_path: missionCount,
        avg_score_in_path:
          missionScores.length > 0
            ? Math.round(
                (missionScores.reduce((a, b) => a + b, 0) /
                  missionScores.length) *
                  100,
              ) / 100
            : null,
      });
    }

    // Sort: primary skills first, then by whether they leveled up
    receiptEntries.sort((a, b) => {
      if (a.relevance !== b.relevance)
        return a.relevance === "primary" ? -1 : 1;
      if (a.leveled_up !== b.leveled_up) return a.leveled_up ? -1 : 1;
      return 0;
    });

    return {
      path: {
        id: input.pathId,
        title: input.pathTitle,
        completed_at: input.completedAt,
      },
      skills: receiptEntries,
      is_first_receipt: isFirstReceipt,
    };
  } catch (error) {
    console.error("[skill-receipt] Failed to calculate receipt:", error);
    return null;
  }
}
