import { getSupabase } from "./supabase";
import type { CharacterId } from "./types";

// ---------- Types ----------

export type PartyStatus = "waiting" | "active" | "completed";

export interface Party {
  id: string;
  creator_id: string;
  name: string;
  character: CharacterId;
  planned_duration_min: number;
  max_participants: number;
  status: PartyStatus;
  created_at: string;
}

export interface PartyParticipant {
  id: string;
  party_id: string;
  user_id: string;
  display_name: string;
  joined_at: string;
  left_at: string | null;
}

export interface PartyWithCount extends Party {
  participant_count: number;
}

// ---------- Queries ----------

/** Fetch all 'waiting' parties, ordered by newest first. */
export async function listWaitingParties(): Promise<PartyWithCount[]> {
  const { data: parties, error } = await getSupabase()
    .from("fp_parties")
    .select("*")
    .eq("status", "waiting")
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!parties || parties.length === 0) return [];

  // Fetch active participant counts
  const partyIds = parties.map((p: Party) => p.id);
  const { data: participants, error: countErr } = await getSupabase()
    .from("fp_party_participants")
    .select("party_id")
    .in("party_id", partyIds)
    .is("left_at", null);

  if (countErr) throw countErr;

  const countMap = new Map<string, number>();
  (participants ?? []).forEach((row: { party_id: string }) => {
    countMap.set(row.party_id, (countMap.get(row.party_id) ?? 0) + 1);
  });

  return parties.map((p: Party) => ({
    ...p,
    participant_count: countMap.get(p.id) ?? 0,
  }));
}

/** Fetch a single party by ID. */
export async function getParty(partyId: string): Promise<Party | null> {
  const { data, error } = await getSupabase()
    .from("fp_parties")
    .select("*")
    .eq("id", partyId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // not found
    throw error;
  }
  return data;
}

/** Fetch active participants for a party. */
export async function getPartyParticipants(
  partyId: string
): Promise<PartyParticipant[]> {
  const { data, error } = await getSupabase()
    .from("fp_party_participants")
    .select("*")
    .eq("party_id", partyId)
    .is("left_at", null)
    .order("joined_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// ---------- Mutations ----------

export interface CreatePartyInput {
  creator_id: string;
  name: string;
  character: CharacterId;
  planned_duration_min: number;
  max_participants: number;
}

/** Create a new party and auto-join the creator. */
export async function createParty(
  input: CreatePartyInput,
  creatorDisplayName: string
): Promise<Party> {
  const { data, error } = await getSupabase()
    .from("fp_parties")
    .insert(input)
    .select()
    .single();

  if (error) throw error;

  // Auto-join creator as first participant
  await joinParty(data.id, input.creator_id, creatorDisplayName);

  return data;
}

/** Join a party as a participant. Uses upsert so re-joining after leaving works. */
export async function joinParty(
  partyId: string,
  userId: string,
  displayName: string
): Promise<PartyParticipant> {
  const { data, error } = await getSupabase()
    .from("fp_party_participants")
    .upsert(
      {
        party_id: partyId,
        user_id: userId,
        display_name: displayName,
        left_at: null,
      },
      { onConflict: "party_id,user_id" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Leave a party (set left_at). */
export async function leaveParty(
  partyId: string,
  userId: string
): Promise<void> {
  const { error } = await getSupabase()
    .from("fp_party_participants")
    .update({ left_at: new Date().toISOString() })
    .eq("party_id", partyId)
    .eq("user_id", userId);

  if (error) throw error;
}

/** Update party status (e.g., waiting → active). */
export async function updatePartyStatus(
  partyId: string,
  status: PartyStatus
): Promise<void> {
  const { error } = await getSupabase()
    .from("fp_parties")
    .update({ status })
    .eq("id", partyId);

  if (error) throw error;
}
