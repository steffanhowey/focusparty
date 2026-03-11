// ─── Synthetic Activity Engine ───────────────────────────────
// Evaluates rooms, decides whether to emit synthetic events,
// and inserts them via the admin Supabase client.
// Stateless per tick — implicit state is derived from recent events.

import { createClient } from "@/lib/supabase/admin";
import {
  SYNTHETIC_POOL,
  type SyntheticArchetype,
  type SyntheticParticipant,
  type SyntheticEventType,
} from "./pool";
import { computeRoomState } from "@/lib/roomState";
import type { ActivityEvent, RoomState } from "@/lib/types";

// ─── Types ───────────────────────────────────────────────────

export interface RoomContext {
  id: string;
  world_key: string;
  max_participants: number;
  status: string;
}

interface RoomWithEvents extends RoomContext {
  recentEvents: ActivityEvent[];
}

type SyntheticState = "absent" | "joined" | "in_session";

interface ProposedEvent {
  party_id: string;
  event_type: SyntheticEventType;
  body: string;
  payload: Record<string, unknown>;
  created_at: string;
}

// ─── Constants ───────────────────────────────────────────────

const MAX_EVENTS_PER_ROOM = 2;
const MAX_EVENTS_GLOBAL = 4;
const SYNTHETIC_RATIO_CAP = 0.4;
const RECENT_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours
const RECENT_LIMIT = 20;
const BACKFILL_WINDOW_MS = 30 * 60 * 1000; // 30 min
const BACKFILL_MIN_AGO_MS = 5 * 60 * 1000; // 5 min
const BACKFILL_MAX_AGO_MS = 45 * 60 * 1000; // 45 min
const BACKFILL_MAX_EVENTS = 5;
const WORLD_AFFINITY_MISS_CHANCE = 0.15; // 15% chance to appear outside preferred worlds

// ─── DB Queries (admin client) ───────────────────────────────

export async function getActiveRooms(): Promise<RoomContext[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("fp_parties")
    .select("id, max_participants, status, world_key")
    .in("status", ["waiting", "active"]);

  if (error) {
    console.error("[synthetics] getActiveRooms error:", error);
    return [];
  }
  return (data ?? []).map((row) => ({
    ...row,
    world_key: (row as Record<string, unknown>).world_key as string || "default",
  })) as RoomContext[];
}

export async function getRecentRoomEvents(
  partyId: string
): Promise<ActivityEvent[]> {
  const supabase = createClient();
  const cutoff = new Date(Date.now() - RECENT_WINDOW_MS).toISOString();
  const { data, error } = await supabase
    .from("fp_activity_events")
    .select("*")
    .eq("party_id", partyId)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(RECENT_LIMIT);

  if (error) {
    console.error("[synthetics] getRecentRoomEvents error:", error);
    return [];
  }
  return (data ?? []) as ActivityEvent[];
}

async function insertSyntheticEvent(event: ProposedEvent): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("fp_activity_events").insert({
    party_id: event.party_id,
    session_id: null,
    user_id: null,
    actor_type: "synthetic",
    event_type: event.event_type,
    body: event.body,
    payload: event.payload,
    created_at: event.created_at,
  });

  if (error) {
    console.error("[synthetics] insertSyntheticEvent error:", error);
    return false;
  }
  return true;
}

// ─── Helpers ─────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function weightedRandom<T>(
  items: { item: T; weight: number }[]
): T | null {
  if (items.length === 0) return null;
  const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
  if (totalWeight <= 0) return items[0]?.item ?? null;

  let r = Math.random() * totalWeight;
  for (const { item, weight } of items) {
    r -= weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1].item;
}

function randomBackdatedTimestamp(): string {
  const agoMs =
    BACKFILL_MIN_AGO_MS +
    Math.random() * (BACKFILL_MAX_AGO_MS - BACKFILL_MIN_AGO_MS);
  return new Date(Date.now() - agoMs).toISOString();
}

// ─── State Machine ───────────────────────────────────────────

/** Derive implicit synthetic state from recent events. */
function buildSyntheticStates(
  recentEvents: ActivityEvent[],
  candidateIds: Set<string>
): Map<string, { state: SyntheticState; joinedAt: string | null }> {
  const stateMap = new Map<
    string,
    { state: SyntheticState; joinedAt: string | null }
  >();

  for (const event of recentEvents) {
    const synId = event.payload?.synthetic_id as string | undefined;
    if (!synId || !candidateIds.has(synId)) continue;

    switch (event.event_type) {
      case "participant_joined":
        stateMap.set(synId, { state: "joined", joinedAt: event.created_at });
        break;
      case "session_started":
        stateMap.set(synId, {
          state: "in_session",
          joinedAt: stateMap.get(synId)?.joinedAt ?? null,
        });
        break;
      case "sprint_completed":
      case "check_in":
      case "high_five":
        // stays in_session after completing a sprint, checking in, or high-fiving
        stateMap.set(synId, {
          state: "in_session",
          joinedAt: stateMap.get(synId)?.joinedAt ?? null,
        });
        break;
      case "session_completed":
        stateMap.set(synId, {
          state: "joined",
          joinedAt: stateMap.get(synId)?.joinedAt ?? null,
        });
        break;
      case "participant_left":
        stateMap.set(synId, { state: "absent", joinedAt: null });
        break;
    }
  }

  return stateMap;
}

/** Get valid next events for a synthetic given their current state. */
function getValidTransitions(
  synthetic: SyntheticParticipant,
  state: SyntheticState,
  joinedAt: string | null
): { eventType: SyntheticEventType; weight: number }[] {
  const transitions: { eventType: SyntheticEventType; weight: number }[] = [];

  switch (state) {
    case "absent":
      transitions.push({
        eventType: "participant_joined",
        weight: synthetic.activityBias.participant_joined,
      });
      break;

    case "joined":
      transitions.push({
        eventType: "session_started",
        weight: synthetic.activityBias.session_started,
      });
      // Can leave if they've been joined for a while (>15 min)
      if (joinedAt) {
        const joinedAgoMs = Date.now() - new Date(joinedAt).getTime();
        if (joinedAgoMs > 15 * 60 * 1000) {
          transitions.push({
            eventType: "participant_left",
            weight: synthetic.activityBias.participant_left,
          });
        }
      }
      break;

    case "in_session":
      transitions.push({
        eventType: "sprint_completed",
        weight: synthetic.activityBias.sprint_completed,
      });
      transitions.push({
        eventType: "session_completed",
        weight: synthetic.activityBias.session_completed,
      });
      transitions.push({
        eventType: "check_in",
        weight: synthetic.activityBias.check_in,
      });
      transitions.push({
        eventType: "high_five",
        weight: synthetic.activityBias.high_five,
      });
      break;
  }

  return transitions;
}

// ─── Room State Bias ─────────────────────────────────────────

/** Weight multiplier for synthetic events based on ambient room state. */
function getRoomStateBias(
  roomState: RoomState,
  eventType: SyntheticEventType
): number {
  switch (roomState) {
    case "quiet":
      // Quiet rooms need more joins to feel alive
      if (eventType === "participant_joined") return 1.5;
      if (eventType === "session_started") return 1.3;
      return 1.0;

    case "warming_up":
      // Warming rooms: favor session starts and sprints
      if (eventType === "session_started") return 1.4;
      if (eventType === "sprint_completed") return 1.2;
      if (eventType === "check_in") return 1.2;
      if (eventType === "high_five") return 1.2;
      if (eventType === "participant_left") return 0.3;
      return 1.0;

    case "focused":
      // Focused rooms: favor sprint completions, check-ins, and high-fives
      if (eventType === "sprint_completed") return 1.5;
      if (eventType === "check_in") return 1.3;
      if (eventType === "high_five") return 1.5;
      if (eventType === "participant_joined") return 0.5;
      if (eventType === "participant_left") return 0.3;
      return 1.0;

    case "flowing":
      // Flowing rooms: minimal synthetic activity, but high-fives feel natural
      if (eventType === "high_five") return 1.2;
      return 0.7;

    case "cooling_down":
      // Cooling rooms: favor leaves and session completions
      if (eventType === "participant_left") return 1.5;
      if (eventType === "session_completed") return 1.3;
      if (eventType === "participant_joined") return 0.4;
      return 0.8;

    default:
      return 1.0;
  }
}

// ─── Check-In Payload Generator ────────────────────────────

const SYNTHETIC_SHIP_TASKS: Record<SyntheticArchetype, string[]> = {
  coder: ["a new component", "a bug fix", "an API endpoint", "a refactor", "a test suite"],
  writer: ["a blog draft", "a chapter outline", "an edit pass", "a content brief", "a newsletter"],
  founder: ["a pitch update", "a landing page", "a feature spec", "a growth experiment", "investor notes"],
  gentle: ["a journal entry", "a study guide", "a design sketch", "a mood board", "a reading list"],
};

const SYNTHETIC_UPDATE_MSGS: string[] = [
  "Deep in flow right now",
  "Making steady progress",
  "Almost done with this chunk",
  "Hit a groove, keeping going",
  "Wrapping up a tricky section",
  "Feeling productive today",
  "One more push then break",
];

function generateCheckInPayload(
  synthetic: SyntheticParticipant
): Record<string, unknown> {
  const roll = Math.random();
  if (roll < 0.6) {
    return { action: "progress" };
  } else if (roll < 0.85) {
    const tasks = SYNTHETIC_SHIP_TASKS[synthetic.archetype];
    const task = tasks[Math.floor(Math.random() * tasks.length)];
    return { action: "ship", task_title: task };
  } else {
    const msg =
      SYNTHETIC_UPDATE_MSGS[
        Math.floor(Math.random() * SYNTHETIC_UPDATE_MSGS.length)
      ];
    return { action: "update", message: msg };
  }
}

// ─── High-Five Target Resolution ─────────────────────────────

interface RealUser {
  userId: string;
  displayName: string;
  /** Did this user complete a sprint in the last 5 min? */
  recentSprintComplete: boolean;
}

const SPRINT_COMPLETE_RECENCY_MS = 5 * 60 * 1000; // 5 min

/** Extract unique real users from recent events. */
function findRealUsersInRoom(recentEvents: ActivityEvent[]): RealUser[] {
  const userMap = new Map<string, RealUser>();
  const now = Date.now();

  for (const event of recentEvents) {
    if (event.actor_type === "synthetic" || !event.user_id) continue;
    const existing = userMap.get(event.user_id);
    const recentSprint =
      event.event_type === "sprint_completed" &&
      now - new Date(event.created_at).getTime() < SPRINT_COMPLETE_RECENCY_MS;

    userMap.set(event.user_id, {
      userId: event.user_id,
      displayName: event.body ?? "Someone",
      recentSprintComplete: existing?.recentSprintComplete || recentSprint,
    });
  }

  return Array.from(userMap.values());
}

/** Pick a high-five target, favoring users who just completed a sprint. */
function pickHighFiveTarget(realUsers: RealUser[]): RealUser | null {
  if (realUsers.length === 0) return null;

  // Strongly prefer someone who just completed a sprint
  const sprintFinishers = realUsers.filter((u) => u.recentSprintComplete);
  if (sprintFinishers.length > 0) {
    return sprintFinishers[Math.floor(Math.random() * sprintFinishers.length)];
  }

  // Otherwise pick any real user
  return realUsers[Math.floor(Math.random() * realUsers.length)];
}

// ─── Core Engine ─────────────────────────────────────────────

/** Generate tick events for a set of rooms. Returns proposals to insert. */
export function generateTickEvents(
  rooms: RoomWithEvents[]
): ProposedEvent[] {
  let globalBudget = MAX_EVENTS_GLOBAL;
  const proposals: ProposedEvent[] = [];

  for (const room of shuffle(rooms)) {
    if (globalBudget <= 0) break;

    const { recentEvents } = room;

    // Rate limit: synthetic events ≤ 40% of recent room events.
    // Exception: rooms with ZERO real-user events always allow synthetic
    // activity — otherwise persistent rooms with no visitors go cold.
    if (recentEvents.length > 0) {
      const syntheticCount = recentEvents.filter(
        (e) => e.actor_type === "synthetic"
      ).length;
      const realCount = recentEvents.length - syntheticCount;
      if (realCount > 0 && syntheticCount / recentEvents.length >= SYNTHETIC_RATIO_CAP) {
        continue;
      }
    }

    // Compute ambient room state for bias adjustments
    const roomState = computeRoomState(recentEvents, 0 /* participant count not available server-side; events suffice */);

    // In flowing rooms, reduce synthetic activity — real users are driving momentum
    if (roomState === "flowing" && Math.random() < 0.6) continue;

    // Find candidates with world affinity
    const candidates = SYNTHETIC_POOL.filter(
      (s) =>
        s.preferredWorldKeys.includes(room.world_key) ||
        Math.random() < WORLD_AFFINITY_MISS_CHANCE
    );

    if (candidates.length === 0) continue;

    const candidateIds = new Set(candidates.map((c) => c.id));
    const states = buildSyntheticStates(recentEvents, candidateIds);

    // Detect real users + recent sprint completions for high-five targeting
    const realUsers = findRealUsersInRoom(recentEvents);
    const hasRecentSprintComplete = realUsers.some((u) => u.recentSprintComplete);

    // Build all valid transitions across all candidates
    const allOptions: {
      item: { synthetic: SyntheticParticipant; eventType: SyntheticEventType };
      weight: number;
    }[] = [];

    for (const candidate of shuffle(candidates)) {
      const stateEntry = states.get(candidate.id);
      const currentState: SyntheticState = stateEntry?.state ?? "absent";
      const joinedAt = stateEntry?.joinedAt ?? null;

      const transitions = getValidTransitions(candidate, currentState, joinedAt);
      for (const t of transitions) {
        // Apply room-state-aware bias multipliers
        let adjustedWeight = t.weight;
        adjustedWeight *= getRoomStateBias(roomState, t.eventType);

        // Boost high-five weight 3× when a real user just completed a sprint
        if (t.eventType === "high_five" && hasRecentSprintComplete) {
          adjustedWeight *= 3.0;
        }

        // Skip high-fives entirely if no real users in the room
        if (t.eventType === "high_five" && realUsers.length === 0) continue;

        allOptions.push({
          item: { synthetic: candidate, eventType: t.eventType },
          weight: adjustedWeight,
        });
      }
    }

    if (allOptions.length === 0) continue;

    // Pick one event for this room
    const chosen = weightedRandom(allOptions);
    if (!chosen) continue;

    // For high-fives, resolve a real user target
    if (chosen.eventType === "high_five") {
      const target = pickHighFiveTarget(realUsers);
      if (!target) continue; // safety: no real users available
    }

    const basePayload: Record<string, unknown> = {
      synthetic_id: chosen.synthetic.id,
      synthetic_handle: chosen.synthetic.handle,
    };

    // Enrich events with action-specific payloads
    let payload = basePayload;
    if (chosen.eventType === "check_in") {
      payload = { ...basePayload, ...generateCheckInPayload(chosen.synthetic) };
    } else if (chosen.eventType === "high_five") {
      const target = pickHighFiveTarget(realUsers)!;
      payload = {
        ...basePayload,
        target_user_id: target.userId,
        target_display_name: target.displayName,
      };
    }

    proposals.push({
      party_id: room.id,
      event_type: chosen.eventType,
      body: chosen.synthetic.displayName,
      payload,
      created_at: new Date().toISOString(),
    });

    globalBudget -= 1;
  }

  return proposals;
}

// ─── Backfill ────────────────────────────────────────────────

/**
 * Generate backdated events for a room that has no recent synthetic activity.
 * Creates 1–3 events with timestamps spread over the last 5–45 minutes
 * to create the "people were already here" feeling.
 */
function generateBackfillEvents(room: RoomContext): ProposedEvent[] {
  // Pick candidates aligned with this room's world
  const candidates = SYNTHETIC_POOL.filter((s) =>
    s.preferredWorldKeys.includes(room.world_key)
  );
  if (candidates.length === 0) return [];

  const count = 1 + Math.floor(Math.random() * BACKFILL_MAX_EVENTS); // 1–3
  const picked = shuffle(candidates).slice(0, count);
  const events: ProposedEvent[] = [];

  // Generate a plausible mini-lifecycle per synthetic
  const timestamps = Array.from({ length: count * 2 }, () =>
    randomBackdatedTimestamp()
  ).sort(); // oldest first

  let tsIdx = 0;

  for (const synthetic of picked) {
    // Join event
    events.push({
      party_id: room.id,
      event_type: "participant_joined",
      body: synthetic.displayName,
      payload: {
        synthetic_id: synthetic.id,
        synthetic_handle: synthetic.handle,
        backdated: true,
      },
      created_at: timestamps[tsIdx] ?? randomBackdatedTimestamp(),
    });
    tsIdx++;

    // Maybe a session_started (70% chance)
    if (Math.random() < 0.7 && tsIdx < timestamps.length) {
      events.push({
        party_id: room.id,
        event_type: "session_started",
        body: synthetic.displayName,
        payload: {
          synthetic_id: synthetic.id,
          synthetic_handle: synthetic.handle,
          backdated: true,
        },
        created_at: timestamps[tsIdx] ?? randomBackdatedTimestamp(),
      });
      tsIdx++;
    }
  }

  return events;
}

// ─── Synthetic Presence Query ────────────────────────────────

/**
 * Derive how many synthetics are currently "active" (joined or in_session)
 * per room by scanning recent activity events. Returns a Map<partyId, count>.
 */
export async function getActiveSyntheticCounts(): Promise<Map<string, number>> {
  const supabase = createClient();
  const cutoff = new Date(Date.now() - RECENT_WINDOW_MS).toISOString();

  const { data, error } = await supabase
    .from("fp_activity_events")
    .select("party_id, event_type, payload, created_at")
    .eq("actor_type", "synthetic")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[synthetics] getActiveSyntheticCounts error:", error);
    return new Map();
  }

  // Group events by party_id
  const byParty = new Map<string, ActivityEvent[]>();
  for (const row of data ?? []) {
    const pid = row.party_id as string;
    if (!pid) continue;
    if (!byParty.has(pid)) byParty.set(pid, []);
    byParty.get(pid)!.push(row as unknown as ActivityEvent);
  }

  const allIds = new Set(SYNTHETIC_POOL.map((s) => s.id));
  const counts = new Map<string, number>();

  for (const [partyId, events] of byParty) {
    const states = buildSyntheticStates(events, allIds);
    let active = 0;
    for (const [, entry] of states) {
      if (entry.state === "joined" || entry.state === "in_session") {
        active++;
      }
    }
    if (active > 0) counts.set(partyId, active);
  }

  return counts;
}

// ─── Public API ──────────────────────────────────────────────

export interface TickResult {
  inserted: { partyId: string; eventType: string }[];
}

/**
 * Run one tick of synthetic activity.
 * @param targetPartyId — if provided, evaluate only this room.
 */
export async function runTick(
  targetPartyId?: string
): Promise<TickResult> {
  let rooms = await getActiveRooms();
  if (targetPartyId) {
    rooms = rooms.filter((r) => r.id === targetPartyId);
  }

  if (rooms.length === 0) return { inserted: [] };

  // Fetch recent events for each room
  const roomsWithEvents: RoomWithEvents[] = await Promise.all(
    rooms.map(async (room) => ({
      ...room,
      recentEvents: await getRecentRoomEvents(room.id),
    }))
  );

  const inserted: { partyId: string; eventType: string }[] = [];

  // Backfill: for rooms with no synthetic events in the last hour,
  // insert a few backdated events to seed ambient activity.
  for (const room of roomsWithEvents) {
    const cutoff = Date.now() - BACKFILL_WINDOW_MS;
    const hasSyntheticRecently = room.recentEvents.some(
      (e) =>
        e.actor_type === "synthetic" &&
        new Date(e.created_at).getTime() > cutoff
    );

    if (!hasSyntheticRecently) {
      const backfillEvents = generateBackfillEvents(room);
      for (const event of backfillEvents) {
        const ok = await insertSyntheticEvent(event);
        if (ok) {
          inserted.push({
            partyId: event.party_id,
            eventType: event.event_type,
          });
        }
      }
    }
  }

  // Standard tick: generate real-time events based on current room state
  // Re-fetch events after backfill to include newly inserted ones
  const updatedRooms: RoomWithEvents[] = await Promise.all(
    rooms.map(async (room) => ({
      ...room,
      recentEvents: await getRecentRoomEvents(room.id),
    }))
  );

  const proposals = generateTickEvents(updatedRooms);

  for (const proposal of proposals) {
    const ok = await insertSyntheticEvent(proposal);
    if (ok) {
      inserted.push({
        partyId: proposal.party_id,
        eventType: proposal.event_type,
      });
    }
  }

  return { inserted };
}
