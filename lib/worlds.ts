// ─── World Configuration Layer ──────────────────────────────
// Defines persistent room identities ("worlds") that drive
// host personality defaults, sprint lengths, and room sizing.
// Keyed by the `world_key` column on fp_parties.

import type { HostPersonality } from "./hosts";
import type { VibeId } from "./musicConstants";
import { getDynamicWorldConfig } from "./roomDna";
import { FOREST_500, FOREST_300, TEAL_600, GOLD_600, CORAL_500 } from "./palette";

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
  /** Optional CSS for a geometric pattern overlay on placeholder covers. */
  placeholderPattern?: string;
  /** CSS gradient overlay for text readability over the environment image. */
  environmentOverlay: string;
  /** The music vibe assigned to rooms in this world. */
  vibeKey: VibeId;
  /**
   * Skill domain slugs this world naturally supports.
   * Used by the recommendation engine to suggest rooms for skill development.
   * Empty array = general-purpose, matches any domain.
   */
  skillDomains: string[];
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
    placeholderGradient: "linear-gradient(135deg, #0F2318 0%, #1E3A2C 100%)",
    placeholderPattern:
      "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
    environmentOverlay:
      "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0.3) 100%)",
    vibeKey: "calm-focus",
    skillDomains: [], // General purpose — matches any domain
  },

  "vibe-coding": {
    worldKey: "vibe-coding",
    label: "Vibe Coding",
    description: "Ship code alongside other builders.",
    hostPersonality: "vibe-coding",
    defaultSprintLength: 50,
    targetRoomSize: 12,
    accentColor: FOREST_300,
    placeholderGradient: "linear-gradient(135deg, #162E21 0%, #1a3a35 100%)",
    placeholderPattern:
      "repeating-linear-gradient(-45deg, rgba(255,255,255,0.03), rgba(255,255,255,0.03) 20px, transparent 20px, transparent 40px)",
    environmentOverlay:
      "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 40%, rgba(0,0,0,0.35) 100%)",
    vibeKey: "energizing-flow",
    skillDomains: ["technical-building", "workflow-automation"],
  },

  "writer-room": {
    worldKey: "writer-room",
    label: "Writer Room",
    description: "Quiet space for writing and editing drafts.",
    hostPersonality: "writer-room",
    defaultSprintLength: 45,
    targetRoomSize: 10,
    accentColor: TEAL_600,
    placeholderGradient: "linear-gradient(135deg, #1a3a35 0%, #3D8E8B 100%)",
    placeholderPattern:
      "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
    environmentOverlay:
      "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0.3) 100%)",
    vibeKey: "deep-concentration",
    skillDomains: ["writing-communication", "strategy-planning", "persuasion-sales"],
  },

  "yc-build": {
    worldKey: "yc-build",
    label: "YC Build Party",
    description: "Execution time for founders building startups.",
    hostPersonality: "yc-build",
    defaultSprintLength: 60,
    targetRoomSize: 15,
    accentColor: GOLD_600,
    placeholderGradient: "linear-gradient(135deg, #33280f 0%, #1E3A2C 100%)",
    placeholderPattern:
      "repeating-linear-gradient(-45deg, rgba(255,255,255,0.03), rgba(255,255,255,0.03) 20px, transparent 20px, transparent 40px)",
    environmentOverlay:
      "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 40%, rgba(0,0,0,0.3) 100%)",
    vibeKey: "energizing-flow",
    skillDomains: ["technical-building", "strategy-planning", "operations-execution"],
  },

  "gentle-start": {
    worldKey: "gentle-start",
    label: "Gentle Start",
    description: "Low pressure environment for building momentum.",
    hostPersonality: "gentle-start",
    defaultSprintLength: 25,
    targetRoomSize: 8,
    accentColor: CORAL_500,
    placeholderGradient: "linear-gradient(135deg, #1E3A2C 0%, #3A7D53 100%)",
    environmentOverlay:
      "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.45) 40%, rgba(0,0,0,0.25) 100%)",
    vibeKey: "ambient-chill",
    skillDomains: [], // Low-pressure — matches any domain for exploring-level users
  },
};

/** Get a world config by key, falling back to dynamic → default. */
export function getWorldConfig(worldKey: string): WorldConfig {
  if (worldKey in WORLD_CONFIGS) return WORLD_CONFIGS[worldKey as WorldKey];
  const dynamic = getDynamicWorldConfig(worldKey);
  if (dynamic) return dynamic;
  return WORLD_CONFIGS.default;
}

/**
 * Resolve the compatibility world/runtime profile for a party.
 * Phase A launch rooms can expose a different user-facing identity while
 * still pointing breaks, synthetics, hosts, and visuals at a legacy profile.
 */
export function getPartyRuntimeWorldKey(party: {
  runtime_profile_key?: string | null;
  world_key?: string | null;
} | null | undefined): string {
  if (party?.runtime_profile_key) return party.runtime_profile_key;
  if (party?.world_key) return party.world_key;
  return "default";
}

/**
 * Resolve the effective host personality for a party.
 * Uses the party's explicit host_personality if set and non-default,
 * otherwise falls back to the world's default host personality.
 */
export function getPartyHostPersonality(party: {
  host_personality?: string | null;
  runtime_profile_key?: string | null;
  world_key?: string | null;
}): string {
  // If party has an explicit personality set, use it
  if (party.host_personality && party.host_personality !== "default") {
    return party.host_personality;
  }
  // Otherwise inherit from the world config
  const world = getWorldConfig(getPartyRuntimeWorldKey(party));
  return world.hostPersonality;
}
