import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { mapPathRow, mapProgressRow } from "@/lib/learn/pathGenerator";
import type { AchievementSummary, LearningProgress } from "@/lib/types";
import { evaluateSubmission, type SubmissionEvaluation } from "@/lib/learn/evaluator";
import { UpdateProgressSchema, parseBody } from "@/lib/learn/validation";
import type { SkillReceipt } from "@/lib/types/skills";
import type { ActivityEventType } from "@/lib/types/activity";
import {
  ACHIEVEMENT_SUMMARY_SELECT,
  generateAchievementShareSlug,
  mapAchievementSummaryRow,
} from "@/lib/achievements/achievementModel";

/**
 * GET /api/learn/paths/[id]
 * Get a specific learning path with user's progress.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const admin = createAdminClient();

  // Fetch path
  const { data: pathRow, error } = await admin
    .from("fp_learning_paths")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !pathRow) {
    return NextResponse.json(
      { error: "Learning path not found" },
      { status: 404 }
    );
  }

  // Increment view count (fire-and-forget)
  admin
    .from("fp_learning_paths")
    .update({ view_count: (pathRow.view_count ?? 0) + 1 })
    .eq("id", id)
    .then(() => {});

  const path = mapPathRow(pathRow);

  // Check for user progress
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let progress: LearningProgress | null = null;
  let achievement: AchievementSummary | null = null;

  if (user) {
    const { data: progressRow } = await admin
      .from("fp_learning_progress")
      .select("*")
      .eq("user_id", user.id)
      .eq("path_id", id)
      .single();

    if (progressRow) {
      progress = mapProgressRow(progressRow);

      if (progress.status === "completed") {
        const { data: achievementRow } = await admin
          .from("fp_achievements")
          .select(ACHIEVEMENT_SUMMARY_SELECT)
          .eq("user_id", user.id)
          .eq("path_id", id)
          .single();

        if (achievementRow) {
          achievement = mapAchievementSummaryRow(
            achievementRow as Record<string, unknown>,
          );
        }
      }
    }
  }

  // Load skill tags (with user fluency if authenticated)
  const { loadSkillTagsWithUser, loadSkillTagsForPaths } = await import("@/lib/skills/pathSkillTags");
  if (user) {
    path.skill_tags = await loadSkillTagsWithUser(id, user.id);
  } else {
    const tagMap = await loadSkillTagsForPaths([id]);
    path.skill_tags = tagMap.get(id) ?? [];
  }

  return NextResponse.json({
    path,
    progress,
    ...(achievement ? { achievement } : {}),
  });
}

/**
 * PATCH /api/learn/paths/[id]
 * Update user's progress on a path.
 * Body: { item_index?, item_completed? (content_id), time_delta_seconds? }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const parsed = parseBody(UpdateProgressSchema, raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error },
      { status: 400 }
    );
  }

  const body = parsed.data;

  const admin = createAdminClient();

  // Fetch the path for items_total + achievement data
  const { data: pathRow } = await admin
    .from("fp_learning_paths")
    .select("items, start_count, completion_count, title, topics, difficulty_level")
    .eq("id", id)
    .single();

  if (!pathRow) {
    return NextResponse.json(
      { error: "Learning path not found" },
      { status: 404 }
    );
  }

  const pathItems = (pathRow.items as unknown[]) ?? [];

  // Check for existing progress
  const { data: existingProgress } = await admin
    .from("fp_learning_progress")
    .select("*")
    .eq("user_id", user.id)
    .eq("path_id", id)
    .single();

  let progressRow = existingProgress;

  if (!progressRow) {
    // Create new progress record
    const { data: created, error: createErr } = await admin
      .from("fp_learning_progress")
      .insert({
        user_id: user.id,
        path_id: id,
        items_total: pathItems.length,
        current_item_index: body.item_index ?? 0,
        item_states: {},
      })
      .select("*")
      .single();

    if (createErr) {
      console.error("[learn/paths] create progress error:", createErr);
      return NextResponse.json(
        { error: "Failed to create progress" },
        { status: 500 }
      );
    }

    progressRow = created;

    // Increment start_count on path
    admin
      .from("fp_learning_paths")
      .update({ start_count: (pathRow.start_count ?? 0) + 1 })
      .eq("id", id)
      .then(() => {});

    // Emit path_started event (fire-and-forget)
    admin
      .from("fp_activity_events")
      .insert({
        user_id: user.id,
        actor_type: "system" as const,
        event_type: "path_started" as ActivityEventType,
        body: `Started "${pathRow.title}"`,
        payload: { path_id: id, path_title: pathRow.title },
      })
      .then(({ error: evtErr }) => {
        if (evtErr) console.error("[learn/paths] path_started event error:", evtErr);
      });

    const needsFollowupUpdate =
      body.item_completed !== undefined ||
      body.time_delta_seconds !== undefined ||
      body.item_state !== undefined ||
      body.submission !== undefined;

    if (!needsFollowupUpdate) {
      return NextResponse.json({ progress: mapProgressRow(created!) });
    }
  }

  const existing = progressRow;

  // Update existing progress
  const updates: Record<string, unknown> = {
    last_activity_at: new Date().toISOString(),
  };

  if (body.item_index !== undefined) {
    updates.current_item_index = body.item_index;
  }

  if (body.time_delta_seconds !== undefined) {
    updates.time_invested_seconds =
      (existing.time_invested_seconds ?? 0) + body.time_delta_seconds;
  }

  let evaluation: SubmissionEvaluation | null = null;
  let skillReceipt: SkillReceipt | null = null;
  let achievement: AchievementSummary | null = null;

  if (body.item_completed) {
    const itemStates = (existing.item_states as Record<string, unknown>) ?? {};
    const existingItemState = (itemStates[body.item_completed] as Record<string, unknown>) ?? {};

    // Evaluate submission if provided (for "do" tasks with practice output)
    if (body.submission) {
      const completedItem = pathItems.find(
        (item) => (item as { item_id?: string }).item_id === body.item_completed
      ) as { task_type?: string; mission?: { objective?: string; success_criteria?: string[] } } | undefined;

      if (completedItem?.task_type === "do" && completedItem.mission) {
        evaluation = await evaluateSubmission({
          submission: body.submission,
          objective: completedItem.mission.objective ?? "",
          successCriteria: completedItem.mission.success_criteria ?? [],
        });
      }
    }

    itemStates[body.item_completed] = {
      ...existingItemState,
      ...(body.item_state ?? {}),
      completed: true,
      completed_at: new Date().toISOString(),
      ...(evaluation ? { evaluation } : {}),
      ...(body.submission ? { submission: body.submission } : {}),
    };
    updates.item_states = itemStates;

    // Count completed items
    const completedCount = Object.values(itemStates).filter(
      (s) => (s as { completed: boolean }).completed
    ).length;
    updates.items_completed = completedCount;

    // ── Path completion logic (atomic + idempotent) ──────────
    if (completedCount >= pathItems.length && !existing.completed_at) {
      updates.status = "completed";
      updates.completed_at = new Date().toISOString();

      const totalTime =
        (existing.time_invested_seconds ?? 0) +
        (body.time_delta_seconds ?? 0);

      // Step 1: Atomic completion — update only if completed_at is still NULL.
      // This prevents race conditions where two concurrent PATCHes both
      // pass the !existing.completed_at check above.
      const { data: completionRow, error: completionErr } = await admin
        .from("fp_learning_progress")
        .update({
          status: "completed",
          completed_at: updates.completed_at,
          last_activity_at: updates.completed_at,
        })
        .eq("id", existing.id)
        .is("completed_at", null) // Atomic guard
        .select("id")
        .single();

      // If no row returned, another request already completed this path.
      // We still update item_states below, but skip achievement + receipt.
      const isFirstCompletion = !completionErr && !!completionRow;

      if (isFirstCompletion) {
        // Increment completion_count on path (fire-and-forget)
        admin
          .from("fp_learning_paths")
          .update({
            completion_count: (pathRow.completion_count ?? 0) + 1,
          })
          .eq("id", id)
          .then(() => {});

        // Step 2: Create achievement (awaited, conflict-safe).
        // UNIQUE(user_id, path_id) constraint prevents duplicates.
        const { data: profileRow } = await admin
          .from("fp_profiles")
          .select("display_name, first_name")
          .eq("id", user.id)
          .single();

        const profile = (profileRow as Record<string, unknown> | null) ?? null;
        const shareSlug = generateAchievementShareSlug(
          (profile?.display_name as string | null) ??
            (profile?.first_name as string | null) ??
            null,
          (pathRow.topics as string[]) ?? [],
        );

        const { error: achieveErr } = await admin
          .from("fp_achievements")
          .upsert(
            {
              user_id: user.id,
              path_id: id,
              progress_id: existing.id,
              path_title: pathRow.title,
              path_topics: pathRow.topics ?? [],
              items_completed: completedCount,
              time_invested_seconds: totalTime,
              difficulty_level: pathRow.difficulty_level ?? "intermediate",
              completed_at: updates.completed_at,
              share_slug: shareSlug,
            },
            { onConflict: "user_id,path_id", ignoreDuplicates: true },
          );

        if (achieveErr) {
          console.error("[learn/paths] achievement insert error:", achieveErr);
        }

        // Step 3: Receipt idempotency — check if a receipt already exists
        // on the achievement row. If so, return it instead of recalculating.
        const { data: existingAchievement } = await admin
          .from("fp_achievements")
          .select(`${ACHIEVEMENT_SUMMARY_SELECT}, skill_receipt`)
          .eq("user_id", user.id)
          .eq("path_id", id)
          .single();

        if (existingAchievement) {
          achievement = mapAchievementSummaryRow(
            existingAchievement as Record<string, unknown>,
          );
        }

        if (existingAchievement?.skill_receipt) {
          // Receipt already calculated (e.g., from a previous attempt)
          skillReceipt = existingAchievement.skill_receipt as SkillReceipt;
        } else {
          // Calculate fresh receipt (writes fp_user_skills, returns before/after)
          const { calculateSkillReceipt } = await import(
            "@/lib/skills/receiptCalculator"
          );
          skillReceipt = await calculateSkillReceipt({
            userId: user.id,
            pathId: id,
            pathTitle: pathRow.title as string,
            completedAt: updates.completed_at as string,
            itemStates: updates.item_states as Record<
              string,
              { completed?: boolean; evaluation?: Record<string, unknown> }
            >,
            pathItems: pathItems as Array<{
              item_id?: string;
              task_type?: string;
              mission?: { objective?: string };
            }>,
          });

          // Persist receipt on achievement before returning so the durable
          // history survives refreshes and downstream profile/recommendation reads.
          if (skillReceipt) {
            const { error: receiptErr } = await admin
              .from("fp_achievements")
              .update({ skill_receipt: skillReceipt })
              .eq("user_id", user.id)
              .eq("path_id", id);

            if (receiptErr) {
              console.error("[learn/paths] persist receipt error:", receiptErr);
            }
          }
        }

        // Emit learning activity events (fire-and-forget)
        const emitEvent = (
          eventType: ActivityEventType,
          eventBody: string,
          payload: Record<string, unknown>,
        ): void => {
          admin
            .from("fp_activity_events")
            .insert({
              user_id: user.id,
              actor_type: "system",
              event_type: eventType,
              body: eventBody,
              payload,
            })
            .then(({ error: evtErr }) => {
              if (evtErr) console.error(`[learn/paths] ${eventType} event error:`, evtErr);
            });
        };

        emitEvent("path_completed", `Completed "${pathRow.title}"`, {
          path_id: id,
          path_title: pathRow.title,
          items_completed: completedCount,
          time_invested_seconds: totalTime,
        });

        if (skillReceipt?.skills) {
          for (const entry of skillReceipt.skills) {
            if (entry.leveled_up) {
              emitEvent(
                "skill_leveled_up",
                `Leveled up ${entry.skill.name} to ${entry.after.fluency_level}`,
                {
                  skill_slug: entry.skill.slug,
                  skill_name: entry.skill.name,
                  from_level: entry.before.fluency_level,
                  to_level: entry.after.fluency_level,
                  path_id: id,
                },
              );
            }
          }
        }
      }
    }
  }

  const { data: updated, error: updateErr } = await admin
    .from("fp_learning_progress")
    .update(updates)
    .eq("id", existing.id)
    .select("*")
    .single();

  if (updateErr) {
    console.error("[learn/paths] update progress error:", updateErr);
    return NextResponse.json(
      { error: "Failed to update progress" },
      { status: 500 }
    );
  }

  if (updated?.status === "completed" && (!achievement || !skillReceipt)) {
    const { data: achievementRow } = await admin
      .from("fp_achievements")
      .select(`${ACHIEVEMENT_SUMMARY_SELECT}, skill_receipt`)
      .eq("user_id", user.id)
      .eq("path_id", id)
      .single();

    if (achievementRow) {
      achievement = mapAchievementSummaryRow(
        achievementRow as Record<string, unknown>,
      );

      if (!skillReceipt && achievementRow.skill_receipt) {
        skillReceipt = achievementRow.skill_receipt as SkillReceipt;
      }
    }
  }

  return NextResponse.json({
    progress: mapProgressRow(updated!),
    ...(evaluation ? { evaluation } : {}),
    ...(skillReceipt ? { skill_receipt: skillReceipt } : {}),
    ...(achievement ? { achievement } : {}),
  });
}
