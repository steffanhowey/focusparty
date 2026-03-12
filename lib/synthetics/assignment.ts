// ─── Deterministic Synthetic-to-World Assignment ─────────────
// Each synthetic is assigned to exactly ONE world so users never
// see the same coworker in multiple rooms when switching.
// ROOM_REGULARS get first-come-first-served priority by world order,
// remaining synthetics are placed by their preferredWorldKeys[0].

import { SYNTHETIC_POOL, ROOM_REGULARS, type SyntheticParticipant } from "./pool";

const WORLD_ORDER = ["default", "vibe-coding", "writer-room", "yc-build", "gentle-start"];

/** Max synthetics to show in a single room. */
const MAX_PER_ROOM = 8;

function buildWorldAssignments(): Map<string, SyntheticParticipant[]> {
  const assigned = new Set<string>();
  const assignments = new Map<string, SyntheticParticipant[]>();
  for (const wk of WORLD_ORDER) assignments.set(wk, []);

  const poolMap = new Map(SYNTHETIC_POOL.map((s) => [s.id, s]));

  // Pass 1: ROOM_REGULARS — first world in order claims the synthetic
  for (const wk of WORLD_ORDER) {
    const regulars = ROOM_REGULARS[wk] ?? [];
    for (const synId of regulars) {
      if (assigned.has(synId)) continue;
      const entry = poolMap.get(synId);
      if (!entry) continue;
      assignments.get(wk)!.push(entry);
      assigned.add(synId);
    }
  }

  // Pass 2: Remaining synthetics → their first preferred world
  for (const sp of SYNTHETIC_POOL) {
    if (assigned.has(sp.id)) continue;
    const target =
      sp.preferredWorldKeys.find((wk) => WORLD_ORDER.includes(wk)) ?? "default";
    assignments.get(target)!.push(sp);
    assigned.add(sp.id);
  }

  return assignments;
}

// Computed once at module load — immutable after that
const WORLD_ASSIGNMENTS = buildWorldAssignments();

/**
 * Get the deterministic set of synthetics assigned exclusively to a world.
 * Uses `roomSeed` (derived from partyId) to pick a stable subset of up to
 * MAX_PER_ROOM synthetics, so different parties in the same world still
 * vary slightly in which coworkers appear.
 */
export function getSyntheticsForRoom(
  worldKey: string,
  roomSeed: number
): SyntheticParticipant[] {
  const pool = WORLD_ASSIGNMENTS.get(worldKey) ?? [];
  if (pool.length <= MAX_PER_ROOM) return pool;

  // Deterministic shuffle using roomSeed, then take first MAX_PER_ROOM
  const indexed = pool.map((sp, i) => ({
    sp,
    sort: ((sp.id.charCodeAt(0) * 31 + roomSeed + i * 17) % 997),
  }));
  indexed.sort((a, b) => a.sort - b.sort);
  return indexed.slice(0, MAX_PER_ROOM).map((x) => x.sp);
}
