// ─── Deterministic Synthetic-to-World Assignment ─────────────
// Each synthetic is assigned to exactly ONE world so users never
// see the same coworker in multiple rooms when switching.
// ROOM_REGULARS get first-come-first-served priority by world order,
// remaining synthetics are placed by their preferredWorldKeys[0].

import { SYNTHETIC_POOL, ROOM_REGULARS, type SyntheticParticipant } from "./pool";
import { getDynamicSyntheticConfig } from "../roomDna";

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
 *
 * For factory-created rooms (world_key not in WORLD_ORDER), uses the
 * blueprint's archetype_mix weights to select from the full pool.
 */
export function getSyntheticsForRoom(
  worldKey: string,
  roomSeed: number
): SyntheticParticipant[] {
  // For hardcoded worlds, use the static assignment map
  if (WORLD_ASSIGNMENTS.has(worldKey)) {
    const pool = WORLD_ASSIGNMENTS.get(worldKey)!;
    if (pool.length <= MAX_PER_ROOM) return pool;

    const indexed = pool.map((sp, i) => ({
      sp,
      sort: ((sp.id.charCodeAt(0) * 31 + roomSeed + i * 17) % 997),
    }));
    indexed.sort((a, b) => a.sort - b.sort);
    return indexed.slice(0, MAX_PER_ROOM).map((x) => x.sp);
  }

  // For factory rooms, build a dynamic selection from the full pool
  // using the blueprint's archetype mix weights
  const dynConfig = getDynamicSyntheticConfig(worldKey);
  const targetCount = dynConfig?.targetCount ?? 6;
  const archetypeMix = dynConfig?.archetypeMix ?? { coder: 0.5, founder: 0.3, gentle: 0.2 };

  // Collect synthetics not assigned to any hardcoded world (unassigned overflow)
  const assignedIds = new Set<string>();
  for (const pool of WORLD_ASSIGNMENTS.values()) {
    for (const sp of pool) assignedIds.add(sp.id);
  }
  const unassigned = SYNTHETIC_POOL.filter((sp) => !assignedIds.has(sp.id));

  // If there aren't enough unassigned, use the full pool
  const candidatePool = unassigned.length >= targetCount ? unassigned : SYNTHETIC_POOL;

  // Score each candidate by archetype affinity
  const scored = candidatePool.map((sp) => {
    const weight = archetypeMix[sp.archetype] ?? 0.1;
    const hash = (sp.id.charCodeAt(0) * 31 + roomSeed + sp.id.charCodeAt(sp.id.length - 1) * 17) % 997;
    return { sp, sort: hash * (1 + weight) };
  });
  scored.sort((a, b) => a.sort - b.sort);

  return scored.slice(0, Math.min(targetCount, MAX_PER_ROOM)).map((x) => x.sp);
}
