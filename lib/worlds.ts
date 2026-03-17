// ─── World Configuration Layer ──────────────────────────────
// Defines persistent room identities ("worlds") that drive
// host personality defaults, sprint lengths, and room sizing.
// Keyed by the `world_key` column on fp_parties.

import type { HostPersonality } from "./hosts";
import type { VibeId } from "./musicConstants";
import { FOREST_500, FOREST_300, TEAL_600, GOLD_600, CORAL_500, FOREST_900 } from "./palette";

export type WorldKey =
  | "default"
  | "vibe-coding"
  | "writer-room"
  | "yc-build"
  | "gentle-start";

export interface WorldConfig {
  worldKey: WorldKey;
  label: string;
  description: string;
  /** Maps to a HostPersonality key in lib/hosts.ts. */
  hostPersonality: HostPersonality;
  /** Default sprint duration in minutes for this world. */
  defaultSprintLength: number;
  /** Ideal number of participants for rooms in this world. */
  targetRoomSize: number;
  /** Accent color hex for UI elements (pills, borders) in this world. */
  accentColor: string;
  /** CSS gradient used as placeholder when no AI background is available. */
  placeholderGradient: string;
  /** CSS gradient overlay for text readability over the environment image. */
  environmentOverlay: string;
  /** The music vibe assigned to rooms in this world. */
  vibeKey: VibeId;
}

export const WORLD_CONFIGS: Record<WorldKey, WorldConfig> = {
  default: {
    worldKey: "default",
    label: "Focus Room",
    description: "General purpose focus space.",
    hostPersonality: "default",
    defaultSprintLength: 50,
    targetRoomSize: 10,
    accentColor: FOREST_500,
    placeholderGradient:
      `linear-gradient(135deg, ${FOREST_900} 0%, #1a2a20 50%, ${FOREST_900} 100%)`,
    environmentOverlay:
      "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0.3) 100%)",
    vibeKey: "calm-focus",
  },

  "vibe-coding": {
    worldKey: "vibe-coding",
    label: "Vibe Coding",
    description: "Ship code alongside other builders.",
    hostPersonality: "vibe-coding",
    defaultSprintLength: 50,
    targetRoomSize: 12,
    accentColor: FOREST_300,
    placeholderGradient:
      `linear-gradient(135deg, #0f2318 0%, #152e21 50%, #0d2618 100%)`,
    environmentOverlay:
      "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 40%, rgba(0,0,0,0.35) 100%)",
    vibeKey: "energizing-flow",
  },

  "writer-room": {
    worldKey: "writer-room",
    label: "Writer Room",
    description: "Quiet space for writing and editing drafts.",
    hostPersonality: "writer-room",
    defaultSprintLength: 45,
    targetRoomSize: 10,
    accentColor: TEAL_600,
    placeholderGradient:
      `linear-gradient(135deg, #1a2a28 0%, #1e3530 50%, #162e2a 100%)`,
    environmentOverlay:
      "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0.3) 100%)",
    vibeKey: "deep-concentration",
  },

  "yc-build": {
    worldKey: "yc-build",
    label: "YC Build Party",
    description: "Execution time for founders building startups.",
    hostPersonality: "yc-build",
    defaultSprintLength: 60,
    targetRoomSize: 15,
    accentColor: GOLD_600,
    placeholderGradient:
      `linear-gradient(135deg, #2a2010 0%, #33280f 50%, #211a08 100%)`,
    environmentOverlay:
      "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 40%, rgba(0,0,0,0.3) 100%)",
    vibeKey: "energizing-flow",
  },

  "gentle-start": {
    worldKey: "gentle-start",
    label: "Gentle Start",
    description: "Low pressure environment for building momentum.",
    hostPersonality: "gentle-start",
    defaultSprintLength: 25,
    targetRoomSize: 8,
    accentColor: CORAL_500,
    placeholderGradient:
      `linear-gradient(135deg, #2a1a18 0%, #331e1c 50%, #201010 100%)`,
    environmentOverlay:
      "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.45) 40%, rgba(0,0,0,0.25) 100%)",
    vibeKey: "ambient-chill",
  },
};

/** Get a world config by key, falling back to dynamic → default. */
export function getWorldConfig(worldKey: string): WorldConfig {
  if (worldKey in WORLD_CONFIGS) return WORLD_CONFIGS[worldKey as WorldKey];
  // Dynamic lookup for factory-created rooms
  const { getDynamicWorldConfig } = require("./roomDna");
  const dynamic = getDynamicWorldConfig(worldKey);
  if (dynamic) return dynamic;
  return WORLD_CONFIGS.default;
}

/**
 * Resolve the effective host personality for a party.
 * Uses the party's explicit host_personality if set and non-default,
 * otherwise falls back to the world's default host personality.
 */
export function getPartyHostPersonality(party: {
  host_personality?: string | null;
  world_key?: string | null;
}): string {
  // If party has an explicit personality set, use it
  if (party.host_personality && party.host_personality !== "default") {
    return party.host_personality;
  }
  // Otherwise inherit from the world config
  const world = getWorldConfig(party.world_key ?? "default");
  return world.hostPersonality;
}
