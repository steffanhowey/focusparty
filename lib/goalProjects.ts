import { createClient } from "./supabase/client";

/** Fetch all project IDs for a given goal. */
export async function listGoalProjects(goalId: string): Promise<string[]> {
  const { data, error } = await createClient()
    .from("fp_goal_projects")
    .select("project_id")
    .eq("goal_id", goalId);

  if (error) throw error;
  return (data ?? []).map((r) => r.project_id);
}

/** Fetch goal-project associations for multiple goals at once. */
export async function listGoalProjectsBatch(
  goalIds: string[]
): Promise<Map<string, string[]>> {
  if (goalIds.length === 0) return new Map();

  const { data, error } = await createClient()
    .from("fp_goal_projects")
    .select("goal_id, project_id")
    .in("goal_id", goalIds);

  if (error) throw error;

  const map = new Map<string, string[]>();
  for (const row of data ?? []) {
    if (!map.has(row.goal_id)) map.set(row.goal_id, []);
    map.get(row.goal_id)!.push(row.project_id);
  }
  return map;
}

/** Add a project to a goal. */
export async function addGoalProject(
  goalId: string,
  projectId: string
): Promise<void> {
  const { error } = await createClient()
    .from("fp_goal_projects")
    .upsert({ goal_id: goalId, project_id: projectId }, { onConflict: "goal_id,project_id" });

  if (error) throw error;
}

/** Remove a project from a goal. */
export async function removeGoalProject(
  goalId: string,
  projectId: string
): Promise<void> {
  const { error } = await createClient()
    .from("fp_goal_projects")
    .delete()
    .eq("goal_id", goalId)
    .eq("project_id", projectId);

  if (error) throw error;
}

/** Sync goal's projects to match the given set of IDs. */
export async function setGoalProjects(
  goalId: string,
  projectIds: string[]
): Promise<void> {
  const client = createClient();

  // Delete all existing
  const { error: delError } = await client
    .from("fp_goal_projects")
    .delete()
    .eq("goal_id", goalId);
  if (delError) throw delError;

  // Insert new set
  if (projectIds.length > 0) {
    const rows = projectIds.map((project_id) => ({ goal_id: goalId, project_id }));
    const { error: insError } = await client
      .from("fp_goal_projects")
      .insert(rows);
    if (insError) throw insError;
  }
}
