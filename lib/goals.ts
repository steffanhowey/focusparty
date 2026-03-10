import { createClient } from "./supabase/client";
import type { GoalRecord, GoalSystemStatus, TaskRecord } from "./types";

const GOAL_COLS =
  "id, user_id, title, description, status, position, ai_generated, target_date, completed_at, created_at, updated_at";

// ─── Queries ─────────────────────────────────────────────────

/** Fetch all goals for the current user, optionally filtered by status. */
export async function listGoals(
  status?: GoalSystemStatus
): Promise<GoalRecord[]> {
  const client = createClient();
  let query = client
    .from("fp_goals")
    .select(GOAL_COLS)
    .order("position", { ascending: true });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/** Fetch a single goal by ID. */
export async function getGoal(goalId: string): Promise<GoalRecord | null> {
  const { data, error } = await createClient()
    .from("fp_goals")
    .select(GOAL_COLS)
    .eq("id", goalId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// ─── Mutations ───────────────────────────────────────────────

export async function createGoal(input: {
  user_id: string;
  title: string;
  description?: string | null;
  ai_generated?: boolean;
  target_date?: string | null;
  position?: number;
}): Promise<GoalRecord> {
  const { data, error } = await createClient()
    .from("fp_goals")
    .insert({
      user_id: input.user_id,
      title: input.title,
      description: input.description ?? null,
      ai_generated: input.ai_generated ?? false,
      target_date: input.target_date ?? null,
      position: input.position ?? 0,
    })
    .select(GOAL_COLS)
    .single();

  if (error) throw error;
  return data;
}

export async function updateGoal(
  goalId: string,
  updates: Partial<
    Pick<
      GoalRecord,
      "title" | "description" | "status" | "position" | "target_date" | "completed_at"
    >
  >
): Promise<GoalRecord> {
  const { data, error } = await createClient()
    .from("fp_goals")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", goalId)
    .select(GOAL_COLS)
    .single();

  if (error) throw error;
  return data;
}

export async function deleteGoal(goalId: string): Promise<void> {
  const { error } = await createClient()
    .from("fp_goals")
    .delete()
    .eq("id", goalId);

  if (error) throw error;
}

/** Batch-update positions for a set of goal IDs within a status column. */
export async function reorderGoals(
  goalIds: string[],
  status: GoalSystemStatus
): Promise<void> {
  const client = createClient();
  const updates = goalIds.map((id, idx) =>
    client
      .from("fp_goals")
      .update({ position: idx, status, updated_at: new Date().toISOString() })
      .eq("id", id)
  );
  await Promise.all(updates);
}

// ─── Progress ────────────────────────────────────────────────

/** Compute goal progress from its tasks (client-side). */
export function computeGoalProgress(tasks: TaskRecord[]): {
  total: number;
  completed: number;
  percent: number;
} {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === "done").length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, percent };
}
