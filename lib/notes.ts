import { createClient } from "./supabase/client";
import type { NoteRecord } from "./types";

// ─── Queries ─────────────────────────────────────────────────

/** Fetch the active note for a user's current session. */
export async function getActiveNote(
  userId: string,
  sessionId: string,
): Promise<NoteRecord | null> {
  const { data, error } = await createClient()
    .from("fp_notes")
    .select("*")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// ─── Mutations ───────────────────────────────────────────────

/** Create or update a note (one per user per session). */
export async function upsertNote(note: {
  user_id: string;
  party_id: string;
  session_id: string;
  note_text: string;
  break_category?: string | null;
  content_item_id?: string | null;
}): Promise<NoteRecord> {
  const { data, error } = await createClient()
    .from("fp_notes")
    .upsert(
      {
        user_id: note.user_id,
        party_id: note.party_id,
        session_id: note.session_id,
        note_text: note.note_text,
        break_category: note.break_category ?? null,
        content_item_id: note.content_item_id ?? null,
      },
      { onConflict: "user_id,session_id" },
    )
    .select("*")
    .single();

  if (error) throw error;
  return data;
}
