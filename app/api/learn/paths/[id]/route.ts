import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { mapPathRow, mapProgressRow } from "@/lib/learn/pathGenerator";
import type { LearningProgress } from "@/lib/types";
import { evaluateSubmission, type SubmissionEvaluation } from "@/lib/learn/evaluator";
import { UpdateProgressSchema, parseBody } from "@/lib/learn/validation";

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

  if (user) {
    const { data: progressRow } = await admin
      .from("fp_learning_progress")
      .select("*")
      .eq("user_id", user.id)
      .eq("path_id", id)
      .single();

    if (progressRow) {
      progress = mapProgressRow(progressRow);
    }
  }

  return NextResponse.json({ path, progress });
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
  const { data: existing } = await admin
    .from("fp_learning_progress")
    .select("*")
    .eq("user_id", user.id)
    .eq("path_id", id)
    .single();

  if (!existing) {
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

    // Increment start_count on path
    admin
      .from("fp_learning_paths")
      .update({ start_count: (pathRow.start_count ?? 0) + 1 })
      .eq("id", id)
      .then(() => {});

    return NextResponse.json({ progress: mapProgressRow(created!) });
  }

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

    // Check if path is complete
    if (completedCount >= pathItems.length && !existing.completed_at) {
      updates.status = "completed";
      updates.completed_at = new Date().toISOString();

      // Increment completion_count on path
      admin
        .from("fp_learning_paths")
        .update({
          completion_count: (pathRow.completion_count ?? 0) + 1,
        })
        .eq("id", id)
        .then(() => {});

      // Auto-create achievement (fire-and-forget)
      const totalTime =
        (existing.time_invested_seconds ?? 0) +
        (body.time_delta_seconds ?? 0);
      const rand = Math.random().toString(36).slice(2, 6);
      const topicSlug = ((pathRow.topics as string[]) ?? [])[0]
        ?.toLowerCase()
        .replace(/[^a-z0-9-]/g, "")
        .slice(0, 20) ?? "skill";
      const shareSlug = `${topicSlug}-${rand}`;

      admin
        .from("fp_achievements")
        .insert({
          user_id: user.id,
          path_id: id,
          progress_id: existing.id,
          path_title: pathRow.title,
          path_topics: pathRow.topics ?? [],
          items_completed: completedCount,
          time_invested_seconds: totalTime,
          difficulty_level: pathRow.difficulty_level ?? "intermediate",
          share_slug: shareSlug,
        })
        .then(() => {});
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

  return NextResponse.json({
    progress: mapProgressRow(updated!),
    ...(evaluation ? { evaluation } : {}),
  });
}

