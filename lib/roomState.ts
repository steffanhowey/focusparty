// ─── Ambient Room State Engine ───────────────────────────────
// Computes dynamic room mood from recent activity events.
// Pure function — no DB queries, no side effects.
// Callers provide events; this module provides intelligence.

import type { ActivityEvent, RoomState } from "./types";

// ─── Display Config ──────────────────────────────────────────

export const ROOM_STATE_CONFIG: Record<
  RoomState,
  { label: string; icon: string; color: string }
> = {
  quiet: { label: "Quiet Room", icon: "🌙", color: "#888995" },
  warming_up: { label: "Warming Up", icon: "🌿", color: "#F59E0B" },
  focused: { label: "Deep Focus", icon: "🔥", color: "#EF4444" },
  flowing: { label: "Flowing", icon: "⚡", color: "#8B5CF6" },
  cooling_down: { label: "Cooling Down", icon: "🌊", color: "#5CC2EC" },
};

// ─── Constants ───────────────────────────────────────────────

/** Only count events from the last 30 minutes for heat scoring. */
const HOT_WINDOW_MS = 30 * 60 * 1000;

/** Number of most-recent events to check for trend direction. */
const TREND_WINDOW = 5;

/** Minimum endings in trend window to trigger cooling_down. */
const COOLING_THRESHOLD = 3;

/** Minimum starts/joins in trend window to trigger warming_up. */
const WARMING_THRESHOLD = 3;

// Event type buckets
const JOIN_TYPES = new Set(["participant_joined"]);
const START_TYPES = new Set(["session_started", "sprint_started"]);
const COMPLETION_TYPES = new Set(["sprint_completed"]);
const ENDING_TYPES = new Set(["session_completed", "participant_left"]);
const WARMING_TYPES = new Set([
  "participant_joined",
  "session_started",
  "sprint_started",
]);

// ─── Core Computation ────────────────────────────────────────

/**
 * Compute the ambient state of a room from recent activity.
 *
 * @param events — Recent activity events (oldest-first or any order).
 *                 Typically the last 20 events from a 2-hour window.
 * @param participantCount — Current live participant count.
 */
export function computeRoomState(
  events: ActivityEvent[],
  participantCount: number
): RoomState {
  if (events.length === 0) {
    return participantCount <= 1 ? "quiet" : "warming_up";
  }

  const now = Date.now();
  const hotCutoff = now - HOT_WINDOW_MS;

  // ── 1. Count events by type in the hot window ──
  let joins = 0;
  let starts = 0;
  let completions = 0;
  let endings = 0;

  for (const event of events) {
    const ts = new Date(event.created_at).getTime();
    if (ts < hotCutoff) continue;

    const et = event.event_type;
    if (JOIN_TYPES.has(et)) joins++;
    else if (START_TYPES.has(et)) starts++;
    else if (COMPLETION_TYPES.has(et)) completions++;
    else if (ENDING_TYPES.has(et)) endings++;
  }

  // ── 2. Compute heat score ──
  const heat = starts * 2 + completions * 3 + joins * 1 - endings * 1;

  // ── 3. Compute trend from last N events ──
  // Sort by created_at descending to get the most recent events
  const sorted = [...events].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const recentSlice = sorted.slice(0, TREND_WINDOW);

  let warmingCount = 0;
  let coolingCount = 0;
  for (const event of recentSlice) {
    if (WARMING_TYPES.has(event.event_type)) warmingCount++;
    if (ENDING_TYPES.has(event.event_type)) coolingCount++;
  }

  const isCooling = coolingCount >= COOLING_THRESHOLD;
  const isWarming = warmingCount >= WARMING_THRESHOLD;

  // ── 4. Map to state ──

  // Cooling trend takes priority — room is winding down
  if (isCooling && heat < 5) {
    return "cooling_down";
  }

  // High heat = flowing
  if (heat >= 7) {
    return "flowing";
  }

  // Moderate heat = focused
  if (heat >= 3) {
    return "focused";
  }

  // Low heat with warming trend
  if (isWarming || (heat > 0 && participantCount >= 2)) {
    return "warming_up";
  }

  // Default: quiet
  return "quiet";
}
