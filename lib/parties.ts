import { createClient } from "./supabase/client";
import { generateInviteCode } from "./inviteCode";
import { logEvent } from "./sessions";
import { SYNTHETIC_POOL } from "./synthetics/pool";
import { getSyntheticsForRoom } from "./synthetics/assignment";
import type { CharacterId } from "./types";

// ---------- Types ----------

export type PartyStatus = "waiting" | "active" | "completed";

export interface Party {
  id: string;
  creator_id: string | null;
  name: string;
  character: CharacterId;
  planned_duration_min: number;
  max_participants: number;
  status: PartyStatus;
  created_at: string;
  invite_code: string;
  world_key: string;
  host_personality: string;
  persistent: boolean;
  blueprint_id: string | null;
}

export interface PartyParticipant {
  id: string;
  party_id: string;
  user_id: string;
  display_name: string;
  joined_at: string;
  left_at: string | null;
}

export interface SyntheticPresenceInfo {
  id: string;
  displayName: string;
  avatarUrl: string;
  handle: string;
  /** ISO timestamp of the synthetic's last session_started or sprint_completed event.
   *  Used by the client to anchor sprint timer calculation to server events. */
  lastSprintEventAt: string | null;
}

export interface PartyWithCount extends Party {
  /** Combined real + synthetic presence count. */
  participant_count: number;
  /** Active synthetic participants with avatar details. */
  synthetic_participants: SyntheticPresenceInfo[];
}

// ---------- Column constants ----------

const PARTY_COLS =
  "id, creator_id, name, character, planned_duration_min, max_participants, status, created_at, invite_code, world_key, host_personality, persistent, blueprint_id";

const PARTICIPANT_COLS =
  "id, party_id, user_id, display_name, joined_at, left_at";

// ---------- Queries ----------

/** Fetch discoverable parties (waiting + active), ordered by newest first. */
export async function listDiscoverableParties(): Promise<PartyWithCount[]> {
  const supabase = createClient();

  const { data: parties, error } = await supabase
    .from("fp_parties")
    .select(PARTY_COLS)
    .in("status", ["waiting", "active"])
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!parties || parties.length === 0) return [];

  // Fetch active participant counts
  const partyIds = parties.map((p: Party) => p.id);
  const { data: participants, error: countErr } = await supabase
    .from("fp_party_participants")
    .select("party_id")
    .in("party_id", partyIds)
    .is("left_at", null);

  if (countErr) throw countErr;

  const countMap = new Map<string, number>();
  (participants ?? []).forEach((row: { party_id: string }) => {
    countMap.set(row.party_id, (countMap.get(row.party_id) ?? 0) + 1);
  });

  // Derive active synthetic counts from recent activity events
  const syntheticCounts = await getActiveSyntheticPresence(supabase, partyIds);

  // Sort: persistent rooms first (in stable world order), then user-created by newest
  const WORLD_ORDER = ["default", "vibe-coding", "writer-room", "yc-build", "gentle-start"];
  return parties
    .map((p: Party) => {
      const realCount = countMap.get(p.id) ?? 0;
      const eventSynParticipants = syntheticCounts.get(p.id) ?? [];

      // For persistent rooms, use deterministic baseline so lobbies always look populated.
      // Event-derived timing overlays when available.
      let synParticipants: SyntheticPresenceInfo[];
      if (p.persistent) {
        const roomSeed = p.id.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
        const baseline = getSyntheticsForRoom(p.world_key, roomSeed);
        const eventMap = new Map(eventSynParticipants.map((s) => [s.id, s.lastSprintEventAt]));
        synParticipants = baseline.map((sp) => ({
          id: sp.id,
          displayName: sp.displayName,
          avatarUrl: sp.avatarUrl,
          handle: sp.handle,
          lastSprintEventAt: eventMap.get(sp.id) ?? null,
        }));
      } else {
        synParticipants = eventSynParticipants;
      }

      return {
        ...p,
        participant_count: realCount + synParticipants.length,
        synthetic_participants: synParticipants,
      };
    })
    .sort((a, b) => {
      if (a.persistent && !b.persistent) return -1;
      if (!a.persistent && b.persistent) return 1;
      if (a.persistent && b.persistent) {
        const aIdx = WORLD_ORDER.indexOf(a.world_key);
        const bIdx = WORLD_ORDER.indexOf(b.world_key);
        // Hardcoded worlds come first (in WORLD_ORDER order),
        // factory rooms (not in WORLD_ORDER) come after, sorted by created_at
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
}

/**
 * Derive which synthetics are currently "active" (joined or in_session)
 * per room by scanning recent activity events. Returns avatar details.
 */
async function getActiveSyntheticPresence(
  supabase: ReturnType<typeof createClient>,
  partyIds: string[]
): Promise<Map<string, SyntheticPresenceInfo[]>> {
  const cutoff = new Date(Date.now() - 50 * 60 * 1000).toISOString(); // 50 min (was 2 hours — prevents ghost presences)

  const { data, error } = await supabase
    .from("fp_activity_events")
    .select("party_id, event_type, payload, created_at")
    .eq("actor_type", "synthetic")
    .in("party_id", partyIds)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[parties] getActiveSyntheticPresence error:", error);
    return new Map();
  }

  // Build a lookup from synthetic id → pool entry
  const poolMap = new Map(SYNTHETIC_POOL.map((s) => [s.id, s]));

  // Group events by party_id, then derive state per synthetic
  const byParty = new Map<string, typeof data>();
  for (const row of data ?? []) {
    const pid = row.party_id as string;
    if (!pid) continue;
    if (!byParty.has(pid)) byParty.set(pid, []);
    byParty.get(pid)!.push(row);
  }

  const result = new Map<string, SyntheticPresenceInfo[]>();

  for (const [partyId, events] of byParty) {
    const stateMap = new Map<string, string>();
    const lastSprintEventMap = new Map<string, string>(); // synId → ISO timestamp
    for (const e of events) {
      const synId = (e.payload as Record<string, unknown>)?.synthetic_id as string | undefined;
      if (!synId) continue;
      switch (e.event_type) {
        case "participant_joined":
          stateMap.set(synId, "joined");
          break;
        case "session_started":
        case "sprint_completed":
        case "break_started":
          stateMap.set(synId, "in_session");
          // Track the timestamp of sprint-relevant events for timer anchoring
          if (e.event_type === "session_started" || e.event_type === "sprint_completed") {
            lastSprintEventMap.set(synId, e.created_at as string);
          }
          break;
        case "session_completed":
          stateMap.set(synId, "joined");
          break;
        case "participant_left":
          stateMap.set(synId, "absent");
          break;
      }
    }

    const active: SyntheticPresenceInfo[] = [];
    for (const [synId, state] of stateMap) {
      if (state === "joined" || state === "in_session") {
        const poolEntry = poolMap.get(synId);
        if (poolEntry) {
          active.push({
            id: poolEntry.id,
            displayName: poolEntry.displayName,
            avatarUrl: poolEntry.avatarUrl,
            handle: poolEntry.handle,
            lastSprintEventAt: lastSprintEventMap.get(synId) ?? null,
          });
        }
      }
    }
    if (active.length > 0) result.set(partyId, active);
  }

  return result;
}

/**
 * Fetch active synthetic participants for a single party.
 * Public wrapper around the private getActiveSyntheticPresence function.
 */
export async function getSyntheticParticipants(
  partyId: string
): Promise<SyntheticPresenceInfo[]> {
  const supabase = createClient();
  const result = await getActiveSyntheticPresence(supabase, [partyId]);
  return result.get(partyId) ?? [];
}

/** Fetch a single party by ID. */
export async function getParty(partyId: string): Promise<Party | null> {
  const { data, error } = await createClient()
    .from("fp_parties")
    .select(PARTY_COLS)
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
  const { data, error } = await createClient()
    .from("fp_party_participants")
    .select(PARTICIPANT_COLS)
    .eq("party_id", partyId)
    .is("left_at", null)
    .order("joined_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** Find the user's currently active party (if any). */
export async function getActivePartyForUser(
  userId: string
): Promise<Party | null> {
  const { data, error } = await createClient()
    .from("fp_party_participants")
    .select("party_id, fp_parties!inner(*)")
    .eq("user_id", userId)
    .is("left_at", null)
    .eq("fp_parties.status", "active")
    .order("joined_at", { ascending: false })
    .limit(1);

  if (error) throw error;
  if (!data || data.length === 0) return null;

  const row = data[0] as unknown as { party_id: string; fp_parties: Party };
  return row.fp_parties ?? null;
}

/** Fetch all active/waiting parties the user has joined (and not left). */
export async function getUserActiveParties(
  userId: string
): Promise<Party[]> {
  const { data, error } = await createClient()
    .from("fp_party_participants")
    .select("party_id, fp_parties!inner(*)")
    .eq("user_id", userId)
    .is("left_at", null)
    .in("fp_parties.status", ["waiting", "active"])
    .order("joined_at", { ascending: false });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  return data.map(
    (row) =>
      (row as unknown as { party_id: string; fp_parties: Party }).fp_parties
  );
}

/** Fetch a single party by invite code. */
export async function getPartyByInviteCode(
  code: string
): Promise<Party | null> {
  const { data, error } = await createClient()
    .from("fp_parties")
    .select(PARTY_COLS)
    .eq("invite_code", code)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // not found
    throw error;
  }
  return data;
}

// ---------- Mutations ----------

export interface CreatePartyInput {
  creator_id: string;
  name: string;
  character: CharacterId;
  planned_duration_min: number;
  max_participants: number;
  status?: PartyStatus;
  world_key?: string;
  host_personality?: string;
}

/** Create a new party and auto-join the creator. */
export async function createParty(
  input: CreatePartyInput,
  creatorDisplayName: string
): Promise<Party> {
  const invite_code = generateInviteCode();

  const { data, error } = await createClient()
    .from("fp_parties")
    .insert({ ...input, invite_code })
    .select()
    .single();

  if (error) {
    // Retry once on invite_code collision (unique constraint violation)
    if (error.code === "23505" && error.message?.includes("invite_code")) {
      const retryCode = generateInviteCode();
      const { data: retryData, error: retryError } = await createClient()
        .from("fp_parties")
        .insert({ ...input, invite_code: retryCode })
        .select()
        .single();
      if (retryError) throw retryError;
      await joinParty(retryData.id, input.creator_id, creatorDisplayName);
      return retryData;
    }
    throw error;
  }

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
  const { data, error } = await createClient()
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

  // Log participant_joined event (fire-and-forget)
  logEvent({
    party_id: partyId,
    user_id: userId,
    event_type: "participant_joined",
    body: displayName,
  }).catch((err) => console.error("Failed to log participant_joined event:", err));

  return data;
}

/** Leave a party (set left_at). */
export async function leaveParty(
  partyId: string,
  userId: string
): Promise<void> {
  const { error } = await createClient()
    .from("fp_party_participants")
    .update({ left_at: new Date().toISOString() })
    .eq("party_id", partyId)
    .eq("user_id", userId);

  if (error) throw error;

  // Log participant_left event (fire-and-forget)
  logEvent({
    party_id: partyId,
    user_id: userId,
    event_type: "participant_left",
  }).catch((err) => console.error("Failed to log participant_left event:", err));
}

/** Update party status (e.g., waiting → active). */
export async function updatePartyStatus(
  partyId: string,
  status: PartyStatus
): Promise<void> {
  const { error } = await createClient()
    .from("fp_parties")
    .update({ status })
    .eq("id", partyId);

  if (error) throw error;
}
