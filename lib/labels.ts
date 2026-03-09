import { createClient } from "./supabase/client";
import type { Label } from "./types";

// ─── Queries ─────────────────────────────────────────────────

/** Fetch all labels for the current user. */
export async function listLabels(): Promise<Label[]> {
  const { data, error } = await createClient()
    .from("fp_labels")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// ─── Mutations ───────────────────────────────────────────────

export async function createLabel(input: {
  user_id: string;
  name: string;
  color: string;
}): Promise<Label> {
  const { data, error } = await createClient()
    .from("fp_labels")
    .insert({
      user_id: input.user_id,
      name: input.name,
      color: input.color,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateLabel(
  labelId: string,
  updates: Partial<Pick<Label, "name" | "color">>
): Promise<Label> {
  const { data, error } = await createClient()
    .from("fp_labels")
    .update(updates)
    .eq("id", labelId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteLabel(labelId: string): Promise<void> {
  const { error } = await createClient()
    .from("fp_labels")
    .delete()
    .eq("id", labelId);

  if (error) throw error;
}
