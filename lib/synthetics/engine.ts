// ─── Synthetic Activity Engine ───────────────────────────────
// Evaluates rooms, decides whether to emit synthetic events,
// and inserts them via the admin Supabase client.
// Stateless per tick — implicit state is derived from recent events.

import { createClient } from "@/lib/supabase/admin";
import {
  SYNTHETIC_POOL,
  ROOM_REGULARS,
  type SyntheticArchetype,
  type SyntheticParticipant,
  type SyntheticEventType,
} from "./pool";
import { computeRoomState } from "@/lib/roomState";
import { eventDisplayText } from "@/lib/presence";
import { generateStatusMessage, pickFallbackMessage } from "./statusMessages";
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
const MAX_EVENTS_GLOBAL = 3; // lowered from 4 — real users remain primary
const SYNTHETIC_RATIO_CAP = 0.35; // lowered from 0.4
const RECENT_WINDOW_MS = 50 * 60 * 1000; // 50 min (was 2 hours — prevents ghost presences)
const RECENT_LIMIT = 20;
const BACKFILL_WINDOW_MS = 30 * 60 * 1000; // 30 min
const BACKFILL_MIN_AGO_MS = 5 * 60 * 1000; // 5 min
const BACKFILL_MAX_AGO_MS = 45 * 60 * 1000; // 45 min
const BACKFILL_MAX_EVENTS = 3;
const WORLD_AFFINITY_MISS_CHANCE = 0.15; // 15% chance to appear outside preferred worlds
const REGULAR_BOOST = 3.0; // weight multiplier for room regulars
const BUSY_ROOM_REAL_USER_THRESHOLD = 3; // if ≥3 real users active, suppress expressive events

// ─── Cooldown Constants ──────────────────────────────────────
// Per-synthetic cooldowns extracted from recent events each tick.
// Ranges are randomized per synthetic via a deterministic hash.

const COOLDOWN_VISIBLE_MIN_MS = 8 * 60 * 1000; // 8 min (was 4 — more natural pacing)
const COOLDOWN_VISIBLE_MAX_MS = 15 * 60 * 1000; // 15 min (was 8)
const COOLDOWN_UPDATE_MIN_MS = 12 * 60 * 1000; // 12 min (was 8)
const COOLDOWN_UPDATE_MAX_MS = 20 * 60 * 1000; // 20 min (was 15)
const COOLDOWN_HIGH_FIVE_MIN_MS = 15 * 60 * 1000; // 15 min
const COOLDOWN_HIGH_FIVE_MAX_MS = 30 * 60 * 1000; // 30 min
const HIGH_FIVE_ROOM_CAP_MS = 15 * 60 * 1000; // max 1 synthetic high-five per room per 15 min

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

// ─── Cooldown Helpers ────────────────────────────────────────

/** Simple deterministic hash for a synthetic ID → number in [0,1). */
function syntheticHash(synId: string): number {
  let hash = 0;
  for (let i = 0; i < synId.length; i++) {
    hash = ((hash << 5) - hash + synId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) / 2147483647; // normalize to [0,1)
}

/** Pick a cooldown duration within a range, deterministic per synthetic. */
function cooldownForSynthetic(
  synId: string,
  minMs: number,
  maxMs: number
): number {
  return minMs + syntheticHash(synId) * (maxMs - minMs);
}

interface CooldownTimestamps {
  /** Last visible event (check_in, sprint_completed, high_five). */
  lastVisibleMs: number;
  /** Last check_in with action "update". */
  lastUpdateMs: number;
  /** Last high_five. */
  lastHighFiveMs: number;
}

/** Extract cooldown-relevant timestamps for a synthetic from recent events. */
function extractCooldowns(
  recentEvents: ActivityEvent[],
  syntheticId: string
): CooldownTimestamps {
  let lastVisibleMs = 0;
  let lastUpdateMs = 0;
  let lastHighFiveMs = 0;

  for (const e of recentEvents) {
    if (e.actor_type !== "synthetic") continue;
    const synId = (e.payload as Record<string, unknown> | null)?.synthetic_id as string | undefined;
    if (synId !== syntheticId) continue;

    const ts = new Date(e.created_at).getTime();

    // Visible events: check_in, sprint_completed, high_five
    if (
      e.event_type === "check_in" ||
      e.event_type === "sprint_completed" ||
      e.event_type === "high_five"
    ) {
      lastVisibleMs = Math.max(lastVisibleMs, ts);
    }

    // Update-specific
    if (
      e.event_type === "check_in" &&
      (e.payload as Record<string, unknown> | null)?.action === "update"
    ) {
      lastUpdateMs = Math.max(lastUpdateMs, ts);
    }

    // High-five-specific
    if (e.event_type === "high_five") {
      lastHighFiveMs = Math.max(lastHighFiveMs, ts);
    }
  }

  return { lastVisibleMs, lastUpdateMs, lastHighFiveMs };
}

/** Check if a room already had a synthetic high-five in the last 15 min. */
function roomHasRecentSyntheticHighFive(recentEvents: ActivityEvent[]): boolean {
  const cutoff = Date.now() - HIGH_FIVE_ROOM_CAP_MS;
  return recentEvents.some(
    (e) =>
      e.actor_type === "synthetic" &&
      e.event_type === "high_five" &&
      new Date(e.created_at).getTime() > cutoff
  );
}

/** Count distinct real user IDs with events in the last 30 min. */
function countRecentRealUsers(recentEvents: ActivityEvent[]): number {
  const cutoff = Date.now() - 30 * 60 * 1000;
  const userIds = new Set<string>();
  for (const e of recentEvents) {
    if (e.actor_type === "synthetic" || !e.user_id) continue;
    if (new Date(e.created_at).getTime() > cutoff) {
      userIds.add(e.user_id);
    }
  }
  return userIds.size;
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
      // Only expressive synthetics can check-in or high-five.
      // Atmosphere synthetics are silent presence — lifecycle only.
      if (synthetic.expressionMode === "expressive") {
        transitions.push({
          eventType: "check_in",
          weight: synthetic.activityBias.check_in,
        });
        transitions.push({
          eventType: "high_five",
          weight: synthetic.activityBias.high_five,
        });
      }
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

function generateCheckInPayload(
  synthetic: SyntheticParticipant,
  recentEvents?: ActivityEvent[]
): Record<string, unknown> {
  const roll = Math.random();
  if (roll < 0.45) {
    return { action: "progress" };
  } else if (roll < 0.70) {
    const tasks = SYNTHETIC_SHIP_TASKS[synthetic.archetype];
    const task = tasks[Math.floor(Math.random() * tasks.length)];
    return { action: "ship", task_title: task };
  } else {
    // "update" action — message will be enriched with AI in enrichProposalsWithAI()
    // Respect update-specific cooldown (8-15 min). If blocked, fall back to "progress".
    if (recentEvents) {
      const cooldowns = extractCooldowns(recentEvents, synthetic.id);
      if (cooldowns.lastUpdateMs > 0) {
        const cd = cooldownForSynthetic(synthetic.id, COOLDOWN_UPDATE_MIN_MS, COOLDOWN_UPDATE_MAX_MS);
        if (Date.now() - cooldowns.lastUpdateMs < cd) {
          return { action: "progress" };
        }
      }
    }
    return { action: "update", message: pickFallbackMessage(synthetic.archetype) };
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

    // Rate limit: synthetic events ≤ 40% of recent LIVE room events.
    // Backdated (backfill) events are excluded — they're ambient "people
    // were already here" flavor and shouldn't throttle real-time activity.
    // We also require a minimum number of live events before applying the
    // cap so that small rooms with 1-2 real events aren't choked.
    {
      const liveEvents = recentEvents.filter(
        (e) => !(e.payload as Record<string, unknown> | null)?.backdated
      );
      const syntheticLive = liveEvents.filter(
        (e) => e.actor_type === "synthetic"
      ).length;
      const realLive = liveEvents.length - syntheticLive;
      if (
        realLive > 0 &&
        liveEvents.length >= 8 &&
        syntheticLive / liveEvents.length >= SYNTHETIC_RATIO_CAP
      ) {
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

    // Busy-room check: if ≥3 real users active, only allow atmosphere lifecycle events
    const recentRealUserCount = countRecentRealUsers(recentEvents);
    const isBusyRoom = recentRealUserCount >= BUSY_ROOM_REAL_USER_THRESHOLD;

    // Per-room high-five cap: only 1 synthetic high-five per 15 min
    const roomHighFiveCapped = roomHasRecentSyntheticHighFive(recentEvents);

    // Room regulars for weight boosting
    const regulars = new Set(ROOM_REGULARS[room.world_key] ?? []);

    // Build all valid transitions across all candidates
    const allOptions: {
      item: { synthetic: SyntheticParticipant; eventType: SyntheticEventType };
      weight: number;
    }[] = [];

    const now = Date.now();

    for (const candidate of shuffle(candidates)) {
      const stateEntry = states.get(candidate.id);
      const currentState: SyntheticState = stateEntry?.state ?? "absent";
      const joinedAt = stateEntry?.joinedAt ?? null;

      // In busy rooms, suppress expressive transitions entirely
      const effectiveCandidate = isBusyRoom
        ? { ...candidate, expressionMode: "atmosphere" as const }
        : candidate;

      const transitions = getValidTransitions(effectiveCandidate, currentState, joinedAt);

      // Extract cooldowns for this synthetic
      const cooldowns = extractCooldowns(recentEvents, candidate.id);

      for (const t of transitions) {
        // Per-synthetic cooldown enforcement
        if (
          (t.eventType === "check_in" || t.eventType === "sprint_completed" || t.eventType === "high_five") &&
          cooldowns.lastVisibleMs > 0
        ) {
          const cd = cooldownForSynthetic(candidate.id, COOLDOWN_VISIBLE_MIN_MS, COOLDOWN_VISIBLE_MAX_MS);
          if (now - cooldowns.lastVisibleMs < cd) continue;
        }

        // High-five specific cooldown (15-30 min)
        if (t.eventType === "high_five" && cooldowns.lastHighFiveMs > 0) {
          const cd = cooldownForSynthetic(candidate.id, COOLDOWN_HIGH_FIVE_MIN_MS, COOLDOWN_HIGH_FIVE_MAX_MS);
          if (now - cooldowns.lastHighFiveMs < cd) continue;
        }

        // Per-room high-five cap
        if (t.eventType === "high_five" && roomHighFiveCapped) continue;

        // Apply room-state-aware bias multipliers
        let adjustedWeight = t.weight;
        adjustedWeight *= getRoomStateBias(roomState, t.eventType);

        // High-fives only fire when a real user recently completed a sprint
        if (t.eventType === "high_five" && !hasRecentSprintComplete) continue;

        // Skip high-fives entirely if no real users in the room
        if (t.eventType === "high_five" && realUsers.length === 0) continue;

        // Boost regulars for this room
        if (regulars.has(candidate.id)) {
          adjustedWeight *= REGULAR_BOOST;
        }

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
      payload = { ...basePayload, ...generateCheckInPayload(chosen.synthetic, recentEvents) };
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

// ─── AI Enrichment ──────────────────────────────────────────

/**
 * Enrich check_in "update" proposals with AI-generated status messages.
 * Mutates proposals in-place. Falls back to the existing static message
 * on any error so the tick is never blocked.
 */
async function enrichProposalsWithAI(
  proposals: ProposedEvent[],
  rooms: RoomWithEvents[]
): Promise<void> {
  const roomMap = new Map(rooms.map((r) => [r.id, r]));

  for (const proposal of proposals) {
    if (
      proposal.event_type !== "check_in" ||
      (proposal.payload as Record<string, unknown>).action !== "update"
    ) {
      continue;
    }

    const room = roomMap.get(proposal.party_id);
    if (!room) continue;

    const synId = proposal.payload.synthetic_id as string;
    const poolEntry = SYNTHETIC_POOL.find((s) => s.id === synId);
    if (!poolEntry) continue;

    // Build context for the AI prompt
    const recentActivity = room.recentEvents
      .slice(-5)
      .map((e) => {
        const name =
          e.actor_type === "synthetic"
            ? (e.body ?? "Someone")
            : (e.body ?? "Someone");
        return eventDisplayText(e.event_type, name, e.body, e.payload);
      });

    const recentSyntheticMessages = room.recentEvents
      .filter(
        (e) =>
          e.actor_type === "synthetic" &&
          e.event_type === "check_in" &&
          (e.payload as Record<string, unknown> | null)?.action === "update"
      )
      .slice(-3)
      .map((e) => (e.payload as Record<string, unknown>)?.message as string)
      .filter(Boolean);

    try {
      const message = await generateStatusMessage({
        archetype: poolEntry.archetype,
        displayName: poolEntry.displayName,
        worldKey: room.world_key,
        recentActivity,
        recentSyntheticMessages,
      });
      (proposal.payload as Record<string, unknown>).message = message;
    } catch (err) {
      // Keep the fallback message that was already set
      console.error("[synthetic-status] enrichment failed, keeping fallback:", err);
    }
  }
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

  const count = 1 + Math.floor(Math.random() * BACKFILL_MAX_EVENTS); // 1–3 synthetics
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
  // Kill switch: set SYNTHETICS_ENABLED=false to disable all synthetic activity
  if (process.env.SYNTHETICS_ENABLED === "false") {
    console.log("[synthetics/tick] DISABLED via SYNTHETICS_ENABLED env var");
    return { inserted: [] };
  }

  const allRooms = await getActiveRooms();
  let rooms = allRooms;
  if (targetPartyId) {
    rooms = rooms.filter((r) => r.id === targetPartyId);
  }

  console.log(
    `[synthetics/tick] target=${targetPartyId ?? "all"} activeRooms=${allRooms.length} matched=${rooms.length}` +
    (rooms.length > 0 ? ` room=${rooms[0].id} status=${rooms[0].status} world=${rooms[0].world_key}` : "")
  );

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

  console.log(`[synthetics/tick] backfill inserted=${inserted.length}`);

  // Standard tick: generate real-time events based on current room state
  // Re-fetch events after backfill to include newly inserted ones
  const updatedRooms: RoomWithEvents[] = await Promise.all(
    rooms.map(async (room) => ({
      ...room,
      recentEvents: await getRecentRoomEvents(room.id),
    }))
  );

  const proposals = generateTickEvents(updatedRooms);

  // Enrich "update" check-ins with AI-generated status messages
  await enrichProposalsWithAI(proposals, updatedRooms);

  console.log(
    `[synthetics/tick] proposals=${proposals.length}` +
    (proposals.length > 0 ? ` types=${proposals.map((p) => p.event_type).join(",")}` : "")
  );

  for (const proposal of proposals) {
    const ok = await insertSyntheticEvent(proposal);
    if (ok) {
      inserted.push({
        partyId: proposal.party_id,
        eventType: proposal.event_type,
      });
    }
  }

  console.log(
    `[synthetics/tick] done — total inserted=${inserted.length}` +
    (inserted.length > 0 ? ` events=${inserted.map((i) => i.eventType).join(",")}` : "")
  );
  return { inserted };
}
