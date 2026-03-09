import { createClient } from "./supabase/client";
import type { Project } from "./types";

// ─── Queries ─────────────────────────────────────────────────

/** Fetch all projects for the current user, ordered by position. */
export async function listProjects(): Promise<Project[]> {
  const { data, error } = await createClient()
    .from("fp_projects")
    .select("*")
    .order("position", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// ─── Mutations ───────────────────────────────────────────────

export async function createProject(input: {
  user_id: string;
  name: string;
  color: string;
  emoji: string;
  position?: number;
}): Promise<Project> {
  const { data, error } = await createClient()
    .from("fp_projects")
    .insert({
      user_id: input.user_id,
      name: input.name,
      color: input.color,
      emoji: input.emoji,
      position: input.position ?? 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProject(
  projectId: string,
  updates: Partial<Pick<Project, "name" | "color" | "emoji" | "position">>
): Promise<Project> {
  const { data, error } = await createClient()
    .from("fp_projects")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProject(projectId: string): Promise<void> {
  const { error } = await createClient()
    .from("fp_projects")
    .delete()
    .eq("id", projectId);

  if (error) throw error;
}
