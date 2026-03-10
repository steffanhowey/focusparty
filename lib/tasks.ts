import { createClient } from "./supabase/client";
import type {
  TaskRecord,
  TaskFilters,
  TaskSort,
  TaskStatus,
  TaskPriority,
} from "./types";

// ─── Queries ─────────────────────────────────────────────────

/** Fetch all tasks for the current user with joined labels + project. */
export async function listTasks(
  filters?: TaskFilters,
  sort?: TaskSort
): Promise<TaskRecord[]> {
  const client = createClient();
  let query = client
    .from("fp_tasks")
    .select(
      "*, project:fp_projects(*), labels:fp_task_labels(label:fp_labels(*))"
    );

  if (filters?.projectId) {
    query = query.eq("project_id", filters.projectId);
  }
  if (filters?.priority?.length) {
    query = query.in("priority", filters.priority);
  }
  if (filters?.status?.length) {
    query = query.in("status", filters.status);
  }
  if (filters?.search) {
    query = query.ilike("title", `%${filters.search}%`);
  }

  const sortField = sort?.field ?? "position";
  const sortAsc = (sort?.direction ?? "asc") === "asc";
  query = query.order(sortField, { ascending: sortAsc });

  const { data, error } = await query;
  if (error) throw error;

  // Flatten the nested label join
  return (data ?? []).map((row: any) => ({
    ...row,
    labels:
      row.labels
        ?.map((tl: any) => tl.label)
        .filter(Boolean) ?? [],
  }));
}

// ─── Mutations ───────────────────────────────────────────────

/** Fetch tasks for a specific goal. */
export async function listTasksByGoal(goalId: string): Promise<TaskRecord[]> {
  const client = createClient();
  const { data, error } = await client
    .from("fp_tasks")
    .select(
      "*, project:fp_projects(*), labels:fp_task_labels(label:fp_labels(*))"
    )
    .eq("goal_id", goalId)
    .order("position", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row,
    labels:
      row.labels
        ?.map((tl: any) => tl.label)
        .filter(Boolean) ?? [],
  }));
}

export async function createTask(input: {
  user_id: string;
  title: string;
  project_id?: string | null;
  goal_id?: string | null;
  description?: string | null;
  ai_generated?: boolean;
  priority?: TaskPriority;
  status?: TaskStatus;
  position?: number;
}): Promise<TaskRecord> {
  const { data, error } = await createClient()
    .from("fp_tasks")
    .insert({
      user_id: input.user_id,
      title: input.title,
      project_id: input.project_id ?? null,
      goal_id: input.goal_id ?? null,
      description: input.description ?? null,
      ai_generated: input.ai_generated ?? false,
      priority: input.priority ?? "none",
      status: input.status ?? "todo",
      position: input.position ?? 0,
    })
    .select(
      "*, project:fp_projects(*), labels:fp_task_labels(label:fp_labels(*))"
    )
    .single();

  if (error) throw error;
  return {
    ...data,
    labels:
      (data as any).labels
        ?.map((tl: any) => tl.label)
        .filter(Boolean) ?? [],
  };
}

export async function updateTask(
  taskId: string,
  updates: Partial<
    Pick<
      TaskRecord,
      "title" | "description" | "status" | "priority" | "project_id" | "goal_id" | "position" | "completed_at"
    >
  >
): Promise<TaskRecord> {
  const { data, error } = await createClient()
    .from("fp_tasks")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .select(
      "*, project:fp_projects(*), labels:fp_task_labels(label:fp_labels(*))"
    )
    .single();

  if (error) throw error;
  return {
    ...data,
    labels:
      (data as any).labels
        ?.map((tl: any) => tl.label)
        .filter(Boolean) ?? [],
  };
}

export async function deleteTask(taskId: string): Promise<void> {
  const { error } = await createClient()
    .from("fp_tasks")
    .delete()
    .eq("id", taskId);

  if (error) throw error;
}

/** Batch-update positions for a set of task IDs within a status column. */
export async function reorderTasks(
  taskIds: string[],
  status: TaskStatus
): Promise<void> {
  const client = createClient();
  // Update each task's position and status
  const updates = taskIds.map((id, idx) =>
    client
      .from("fp_tasks")
      .update({ position: idx, status, updated_at: new Date().toISOString() })
      .eq("id", id)
  );
  await Promise.all(updates);
}

/** Replace all labels on a task. */
export async function setTaskLabels(
  taskId: string,
  labelIds: string[]
): Promise<void> {
  const client = createClient();

  // Remove existing
  await client.from("fp_task_labels").delete().eq("task_id", taskId);

  // Insert new
  if (labelIds.length > 0) {
    const rows = labelIds.map((label_id) => ({ task_id: taskId, label_id }));
    const { error } = await client.from("fp_task_labels").insert(rows);
    if (error) throw error;
  }
}
