import { createClient } from "./supabase/client";
import type { SessionTaskRecord } from "./types";

const COLS =
  "id, session_id, user_id, text, completed, sort_order, created_at, updated_at";

// ─── Queries ─────────────────────────────────────────────────

export async function getSessionTasks(
  sessionId: string,
  userId: string,
): Promise<SessionTaskRecord[]> {
  const { data, error } = await createClient()
    .from("fp_session_tasks")
    .select(COLS)
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// ─── Mutations ───────────────────────────────────────────────

export async function addSessionTask(input: {
  id: string;
  session_id: string;
  user_id: string;
  text: string;
  sort_order: number;
}): Promise<SessionTaskRecord> {
  const { data, error } = await createClient()
    .from("fp_session_tasks")
    .insert({
      id: input.id,
      session_id: input.session_id,
      user_id: input.user_id,
      text: input.text,
      sort_order: input.sort_order,
    })
    .select(COLS)
    .single();

  if (error) throw error;
  return data;
}

export async function toggleSessionTask(
  taskId: string,
  completed: boolean,
): Promise<void> {
  const { error } = await createClient()
    .from("fp_session_tasks")
    .update({ completed, updated_at: new Date().toISOString() })
    .eq("id", taskId);

  if (error) throw error;
}

export async function deleteSessionTask(taskId: string): Promise<void> {
  const { error } = await createClient()
    .from("fp_session_tasks")
    .delete()
    .eq("id", taskId);

  if (error) throw error;
}
