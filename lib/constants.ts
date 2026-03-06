import type { CharacterDef, CharacterId, PlanTier } from "./types";

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  ember: {
    id: "ember",
    name: "Ember",
    tagline: "The Warm Motivator",
    primary: "#E96861",
    secondary: "#EE984B",
    accent: "#F5C54E",
    glow: "rgba(233,104,97,0.25)",
    roomBg: "linear-gradient(135deg, #2a1a16 0%, #1f1520 50%, #11132B 100%)",
  },
  moss: {
    id: "moss",
    name: "Moss",
    tagline: "The Quiet Scholar",
    primary: "#5BC682",
    secondary: "#5CC2EC",
    accent: "#ADE2C0",
    glow: "rgba(91,198,130,0.25)",
    roomBg: "linear-gradient(135deg, #0f1f18 0%, #111a20 50%, #11132B 100%)",
  },
  byte: {
    id: "byte",
    name: "Byte",
    tagline: "The Analytical Optimizer",
    primary: "#535AEE",
    secondary: "#8C55EF",
    accent: "#A9ADF7",
    glow: "rgba(83,90,238,0.25)",
    roomBg: "linear-gradient(135deg, #12132e 0%, #1a1235 50%, #11132B 100%)",
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
