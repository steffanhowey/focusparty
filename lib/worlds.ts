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
  /** Cover image URL for room cards. */
  coverImage: string;
  /** High-res environment image for the immersive session background. */
  environmentImage: string;
  /** CSS gradient overlay for text readability over the environment image. */
  environmentOverlay: string;
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
    coverImage:
      "https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&q=80",
    environmentImage:
      "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&q=80",
    environmentOverlay:
      "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0.3) 100%)",
  },

  "vibe-coding": {
    worldKey: "vibe-coding",
    label: "Vibe Coding",
    description: "Ship code alongside other builders.",
    hostPersonality: "vibe-coding",
    defaultSprintLength: 50,
    targetRoomSize: 12,
    accentColor: "#10B981",
    coverImage:
      "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&q=80",
    environmentImage:
      "https://images.unsplash.com/photo-1550439062-609e1531270e?w=1920&q=80",
    environmentOverlay:
      "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 40%, rgba(0,0,0,0.35) 100%)",
  },

  "writer-room": {
    worldKey: "writer-room",
    label: "Writer Room",
    description: "Quiet space for writing and editing drafts.",
    hostPersonality: "writer-room",
    defaultSprintLength: 45,
    targetRoomSize: 10,
    accentColor: "#8B5CF6",
    coverImage:
      "https://images.unsplash.com/photo-1471107340929-a87cd0f5b5f3?w=600&q=80",
    environmentImage:
      "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1920&q=80",
    environmentOverlay:
      "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0.3) 100%)",
  },

  "yc-build": {
    worldKey: "yc-build",
    label: "YC Build Party",
    description: "Execution time for founders building startups.",
    hostPersonality: "yc-build",
    defaultSprintLength: 60,
    targetRoomSize: 15,
    accentColor: "#F59E0B",
    coverImage:
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=600&q=80",
    environmentImage:
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1920&q=80",
    environmentOverlay:
      "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 40%, rgba(0,0,0,0.3) 100%)",
  },

  "gentle-start": {
    worldKey: "gentle-start",
    label: "Gentle Start",
    description: "Low pressure environment for building momentum.",
    hostPersonality: "gentle-start",
    defaultSprintLength: 25,
    targetRoomSize: 8,
    accentColor: "#EC4899",
    coverImage:
      "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&q=80",
    environmentImage:
      "https://images.unsplash.com/photo-1416339306562-f3d12fefd36f?w=1920&q=80",
    environmentOverlay:
      "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.45) 40%, rgba(0,0,0,0.25) 100%)",
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
