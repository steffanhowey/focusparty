// ─── SkillGap Color Palette ──────────────────────────────────
// Single source of truth for every color used in JS/TS config
// objects. Each constant maps 1:1 to a CSS custom property in
// globals.css — use CSS vars in Tailwind classes; import from
// here when you need a raw hex in JS (chart configs, status
// maps, inline style objects, etc.).
//
// RULE: Never hardcode a hex string in a config or component.
//       Import from this file instead.
// ─────────────────────────────────────────────────────────────

// ── Core Palette ─────────────────────────────────────────────
// (mirrors :root custom properties in globals.css)

export const GREEN_700 = "#5BC682"; // --color-green-700
export const CYAN_700 = "#5CC2EC"; // --color-cyan-700
export const GOLD_700 = "#F5C54E"; // --color-gold-700
export const AMBER_700 = "#F59E0B"; // --color-amber-700
export const ORANGE_700 = "#EE984B"; // --color-orange-700
export const CORAL_700 = "#E96861"; // --color-coral-700
export const RED_700 = "#EF5555"; // --color-red-700
export const PURPLE_700 = "#535AEE"; // --color-purple-700
export const INDIGO_700 = "#7c5cfc"; // --color-indigo-700
export const VIOLET_700 = "#8C55EF"; // --color-violet-700
export const NAVY_800 = "#0a0a0a"; // --color-navy-800
export const NAVY_500 = "#888888"; // --color-navy-500
export const NAVY_400 = "#c0c0c0"; // --color-navy-400

// ── Semantic: Status (tasks, goals) ──────────────────────────

export const STATUS_TODO = NAVY_500;
export const STATUS_IN_PROGRESS = INDIGO_700;
export const STATUS_DONE = GREEN_700;

// ── Semantic: Participant Status ─────────────────────────────

export const PARTICIPANT_IDLE = NAVY_500;
export const PARTICIPANT_FOCUSED = GREEN_700;

// ── Semantic: Tone (activity feed) ───────────────────────────

export const TONE_SUCCESS = GREEN_700;
export const TONE_NEUTRAL = NAVY_500;

// ── Semantic: Room State ─────────────────────────────────────

export const ROOM_QUIET = NAVY_500;
export const ROOM_WARMING = AMBER_700;
export const ROOM_FOCUSED = CORAL_700;
export const ROOM_FLOWING = VIOLET_700;
export const ROOM_COOLING = CYAN_700;

// ── Semantic: Priority ───────────────────────────────────────

export const PRIORITY_URGENT = RED_700;
export const PRIORITY_HIGH = ORANGE_700;
export const PRIORITY_MEDIUM = AMBER_700;
export const PRIORITY_LOW = NAVY_500;

// ── Semantic: Celebration / Reward ───────────────────────────

export const CELEBRATION_AMBER = AMBER_700;

// ── Project Default Colors ───────────────────────────────────

export const PROJECT_COLORS = [
  INDIGO_700,
  RED_700,
  ORANGE_700,
  AMBER_700,
  GREEN_700,
  CYAN_700,
] as const;
