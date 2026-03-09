// ─── World Configuration Layer ──────────────────────────────
// Defines persistent room identities ("worlds") that drive
// host personality defaults, sprint lengths, and room sizing.
// Keyed by the `world_key` column on fp_parties.

import type { HostPersonality } from "./hosts";

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
}

export const WORLD_CONFIGS: Record<WorldKey, WorldConfig> = {
  default: {
    worldKey: "default",
    label: "Focus Room",
    description: "General purpose focus space.",
    hostPersonality: "default",
    defaultSprintLength: 50,
    targetRoomSize: 10,
    accentColor: "#3B82F6",
  },

  "vibe-coding": {
    worldKey: "vibe-coding",
    label: "Vibe Coding",
    description: "Ship code alongside other builders.",
    hostPersonality: "vibe-coding",
    defaultSprintLength: 50,
    targetRoomSize: 12,
    accentColor: "#10B981",
  },

  "writer-room": {
    worldKey: "writer-room",
    label: "Writer Room",
    description: "Quiet space for writing and editing drafts.",
    hostPersonality: "writer-room",
    defaultSprintLength: 45,
    targetRoomSize: 10,
    accentColor: "#8B5CF6",
  },

  "yc-build": {
    worldKey: "yc-build",
    label: "YC Build Party",
    description: "Execution time for founders building startups.",
    hostPersonality: "yc-build",
    defaultSprintLength: 60,
    targetRoomSize: 15,
    accentColor: "#F59E0B",
  },

  "gentle-start": {
    worldKey: "gentle-start",
    label: "Gentle Start",
    description: "Low pressure environment for building momentum.",
    hostPersonality: "gentle-start",
    defaultSprintLength: 25,
    targetRoomSize: 8,
    accentColor: "#EC4899",
  },
};

/** Get a world config by key, falling back to default if unknown. */
export function getWorldConfig(worldKey: string): WorldConfig {
  return WORLD_CONFIGS[worldKey as WorldKey] ?? WORLD_CONFIGS.default;
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
