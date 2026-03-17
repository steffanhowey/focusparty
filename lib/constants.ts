import type { CharacterDef, CharacterId, PlanTier } from "./types";
import {
  FOREST_500,
  FOREST_400,
  TEAL_500,
  FOREST_300,
  FOREST_900,
} from "./palette";

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  ember: {
    id: "ember",
    name: "Ember",
    tagline: "The Warm Motivator",
    primary: FOREST_400,
    secondary: TEAL_500,
    accent: FOREST_300,
    glow: "rgba(74,158,106,0.25)",
    roomBg: `linear-gradient(135deg, ${FOREST_900} 0%, #162E21 50%, #1E3A2C 100%)`,
  },
  moss: {
    id: "moss",
    name: "Moss",
    tagline: "The Quiet Scholar",
    primary: FOREST_400,
    secondary: TEAL_500,
    accent: FOREST_300,
    glow: "rgba(74,158,106,0.25)",
    roomBg: `linear-gradient(135deg, ${FOREST_900} 0%, #162E21 50%, #1E3A2C 100%)`,
  },
  byte: {
    id: "byte",
    name: "Byte",
    tagline: "The Analytical Optimizer",
    primary: FOREST_500,
    secondary: TEAL_500,
    accent: FOREST_300,
    glow: "rgba(58,125,83,0.25)",
    roomBg: `linear-gradient(135deg, ${FOREST_900} 0%, #162E21 50%, #1E3A2C 100%)`,
  },
};

// Plan limits (from capabilities doc)
export const FREE_SESSIONS_PER_WEEK = 3;
export const STREAK_FREEZES_FREE_PER_WEEK = 1;
export const STREAK_FREEZES_PRO_PER_WEEK = 2;

export const PLAN_LABELS: Record<PlanTier, string> = {
  free: "Free",
  pro: "Pro",
  pro_plus: "Pro+",
};

export const SPRINT_DURATION_OPTIONS = [15, 25, 50, 75] as const;
export const BREAK_DURATION_OPTIONS = [5, 10, 15] as const;
export const STREAK_MILESTONES = [7, 30, 100, 365] as const;

/** Placeholder streak count for Hub sidebar until StreakProvider is wired. */
export const STUB_STREAK_DISPLAY = 12;

/** Placeholder display name when user is not loaded (e.g. anonymous). */
export const STUB_DISPLAY_NAME = "Guest";

/** Placeholder plan for sidebar until UserProfile is wired. */
export const STUB_PLAN: PlanTier = "free";
