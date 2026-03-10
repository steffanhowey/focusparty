import { createClient } from "./supabase/client";
import type { CommitmentRecord, CommitmentType, CommitmentStatus } from "./types";

const COMMITMENT_COLS =
  "id, user_id, session_goal_id, session_id, goal_id, type, status, declared_at, resolved_at, metadata";

// ─── Queries ─────────────────────────────────────────────────

/** Get the active commitment for a session (if any). */
export async function getActiveCommitment(
  sessionId: string
): Promise<CommitmentRecord | null> {
  const { data, error } = await createClient()
    .from("fp_commitments")
    .select(COMMITMENT_COLS)
    .eq("session_id", sessionId)
    .eq("status", "active")
    .order("declared_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// ─── Mutations ───────────────────────────────────────────────

export async function createCommitment(input: {
  user_id: string;
  session_goal_id?: string | null;
  session_id?: string | null;
  goal_id?: string | null;
  type: CommitmentType;
}): Promise<CommitmentRecord> {
  const { data, error } = await createClient()
    .from("fp_commitments")
    .insert({
      user_id: input.user_id,
      session_goal_id: input.session_goal_id ?? null,
      session_id: input.session_id ?? null,
      goal_id: input.goal_id ?? null,
      type: input.type,
    })
    .select(COMMITMENT_COLS)
    .single();

  if (error) throw error;
  return data;
}

export async function resolveCommitment(
  commitmentId: string,
  status: CommitmentStatus
): Promise<void> {
  const { error } = await createClient()
    .from("fp_commitments")
    .update({
      status,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", commitmentId);

  if (error) throw error;
}
