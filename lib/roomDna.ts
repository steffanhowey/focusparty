// ─── Dynamic Room DNA Resolution ─────────────────────────────
// Loads AI-generated room configurations from fp_room_blueprints
// and makes them available to the existing config getters
// (worlds.ts, hosts.ts, worldBreakProfiles.ts, etc.)
//
// Two-tier resolution: hardcoded configs → dynamic (this module) → default.

import { createClient } from "./supabase/client";
import type { WorldConfig } from "./worlds";
import type { HostConfig, HostStyleGuide } from "./hosts";
import type { WorldBreakProfile } from "./breaks/worldBreakProfiles";
import type { RoomVisualProfile } from "./roomVisualProfiles";
import type { VibeId } from "./musicConstants";

// ─── Types ──────────────────────────────────────────────────

/** Synthetic roster configuration from a blueprint. */
export interface SyntheticRoomConfig {
  /** Weighted archetype mix, e.g. { coder: 0.6, founder: 0.3, gentle: 0.1 } */
  archetypeMix: Record<string, number>;
  /** Target number of synthetics for this room (max 8). */
  targetCount: number;
}

/** Full Room DNA loaded from a blueprint. */
export interface RoomDna {
  worldKey: string;
  worldConfig: WorldConfig;
  hostConfig: HostConfig;
  breakProfile: WorldBreakProfile;
  visualProfile: RoomVisualProfile;
  syntheticConfig: SyntheticRoomConfig;
}

// ─── Cache ──────────────────────────────────────────────────

const dnaCache = new Map<string, RoomDna>();
const pendingLoads = new Map<string, Promise<RoomDna | null>>();

// ─── Loaders ────────────────────────────────────────────────

/**
 * Load Room DNA for a world_key from fp_room_blueprints (via fp_parties).
 * Caches the result. Returns null if no blueprint exists for this key.
 */
export async function loadRoomDna(worldKey: string): Promise<RoomDna | null> {
  // Return from cache if available
  if (dnaCache.has(worldKey)) return dnaCache.get(worldKey)!;

  // Deduplicate concurrent loads
  if (pendingLoads.has(worldKey)) return pendingLoads.get(worldKey)!;

  const promise = doLoadRoomDna(worldKey);
  pendingLoads.set(worldKey, promise);

  try {
    const result = await promise;
    if (result) dnaCache.set(worldKey, result);
    return result;
  } finally {
    pendingLoads.delete(worldKey);
  }
}

async function doLoadRoomDna(worldKey: string): Promise<RoomDna | null> {
  try {
    // Find the party by world_key, then load its blueprint
    const { data: party } = await createClient()
      .from("fp_parties")
      .select("blueprint_id")
      .eq("world_key", worldKey)
      .eq("persistent", true)
      .not("blueprint_id", "is", null)
      .limit(1)
      .single();

    if (!party?.blueprint_id) return null;

    const { data: bp, error: bpError } = await createClient()
      .from("fp_room_blueprints")
      .select(
        "world_config, host_config, synthetic_config, break_profile, visual_profile"
      )
      .eq("id", party.blueprint_id)
      .eq("status", "provisioned")
      .single();

    if (bpError || !bp) return null;

    return parseBlueprintToRoomDna(worldKey, bp);
  } catch (err) {
    console.error(`[roomDna] Failed to load DNA for "${worldKey}":`, err);
    return null;
  }
}

/**
 * Batch preload Room DNA for multiple world keys (e.g. lobby).
 */
export async function preloadRoomDna(worldKeys: string[]): Promise<void> {
  const uncached = worldKeys.filter((k) => !dnaCache.has(k));
  if (uncached.length === 0) return;

  try {
    const { data: parties } = await createClient()
      .from("fp_parties")
      .select("world_key, blueprint_id")
      .in("world_key", uncached)
      .eq("persistent", true)
      .not("blueprint_id", "is", null);

    if (!parties?.length) return;

    const bpIds = parties
      .map((p) => p.blueprint_id)
      .filter(Boolean) as string[];

    const { data: blueprints } = await createClient()
      .from("fp_room_blueprints")
      .select(
        "id, world_config, host_config, synthetic_config, break_profile, visual_profile"
      )
      .in("id", bpIds)
      .eq("status", "provisioned");

    if (!blueprints?.length) return;

    const bpMap = new Map(blueprints.map((bp) => [bp.id, bp]));

    for (const party of parties) {
      if (!party.blueprint_id) continue;
      const bp = bpMap.get(party.blueprint_id);
      if (!bp) continue;

      const dna = parseBlueprintToRoomDna(party.world_key, bp);
      if (dna) dnaCache.set(party.world_key, dna);
    }
  } catch (err) {
    console.error("[roomDna] Preload failed:", err);
  }
}

// ─── Sync Accessors (read from cache only) ──────────────────

export function getDynamicWorldConfig(worldKey: string): WorldConfig | null {
  return dnaCache.get(worldKey)?.worldConfig ?? null;
}

export function getDynamicHostConfig(worldKey: string): HostConfig | null {
  return dnaCache.get(worldKey)?.hostConfig ?? null;
}

export function getDynamicBreakProfile(
  worldKey: string
): WorldBreakProfile | null {
  return dnaCache.get(worldKey)?.breakProfile ?? null;
}

export function getDynamicVisualProfile(
  worldKey: string
): RoomVisualProfile | null {
  return dnaCache.get(worldKey)?.visualProfile ?? null;
}

export function getDynamicSyntheticConfig(
  worldKey: string
): SyntheticRoomConfig | null {
  return dnaCache.get(worldKey)?.syntheticConfig ?? null;
}

/**
 * Directly set a RoomDna into the cache (used by provisioning).
 */
export function setRoomDna(worldKey: string, dna: RoomDna): void {
  dnaCache.set(worldKey, dna);
}

// ─── Parser ─────────────────────────────────────────────────

function parseBlueprintToRoomDna(
  worldKey: string,
  bp: {
    world_config: unknown;
    host_config: unknown;
    synthetic_config: unknown;
    break_profile: unknown;
    visual_profile: unknown;
  }
): RoomDna | null {
  try {
    const wc = bp.world_config as Record<string, unknown>;
    const hc = bp.host_config as Record<string, unknown>;
    const sc = bp.synthetic_config as Record<string, unknown>;
    const brk = bp.break_profile as WorldBreakProfile;
    const vis = bp.visual_profile as RoomVisualProfile;

    const worldConfig: WorldConfig = {
      worldKey: worldKey as WorldConfig["worldKey"],
      label: (wc.label as string) ?? worldKey,
      description: (wc.description as string) ?? "",
      hostPersonality: worldKey as WorldConfig["hostPersonality"],
      defaultSprintLength: (wc.defaultSprintLength as number) ?? 50,
      targetRoomSize: (wc.targetRoomSize as number) ?? 10,
      accentColor: (wc.accentColor as string) ?? "#3B82F6",
      placeholderGradient:
        (wc.placeholderGradient as string) ??
        "linear-gradient(135deg, #1a1c3a 0%, #1e2a4a 50%, #162040 100%)",
      environmentOverlay:
        (wc.environmentOverlay as string) ??
        "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0.3) 100%)",
      vibeKey: (wc.vibeKey as VibeId) ?? "calm-focus",
    };

    const styleGuide: HostStyleGuide = {
      toneInstruction: (hc.toneInstruction as string) ?? "",
      triggerHints: (hc.triggerHints as Record<string, string>) ?? {},
    };

    const hostConfig: HostConfig = {
      partyKey: worldKey as HostConfig["partyKey"],
      hostName: (hc.hostName as string) ?? "Host",
      tone: (hc.tone as string) ?? "balanced, clear",
      styleGuide,
      cooldownSeconds: (hc.cooldownSeconds as number) ?? 600,
      avatarUrl:
        (hc.avatarUrl as string) ??
        `https://api.dicebear.com/9.x/bottts-neutral/png?seed=${encodeURIComponent((hc.hostName as string) ?? worldKey)}&size=64`,
    };

    const syntheticConfig: SyntheticRoomConfig = {
      archetypeMix: (sc.archetypeMix as Record<string, number>) ?? {
        coder: 0.5,
        founder: 0.3,
        gentle: 0.2,
      },
      targetCount: Math.min((sc.targetCount as number) ?? 6, 8),
    };

    return {
      worldKey,
      worldConfig,
      hostConfig,
      breakProfile: brk,
      visualProfile: { ...vis, worldKey: worldKey as RoomVisualProfile["worldKey"] },
      syntheticConfig,
    };
  } catch (err) {
    console.error(`[roomDna] Failed to parse blueprint for "${worldKey}":`, err);
    return null;
  }
}
