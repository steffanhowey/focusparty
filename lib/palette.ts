// ─── SkillGap Color Palette (New System) ─────────────────────
// Maps 1:1 to --sg-* CSS custom properties in globals.css.
// Use CSS vars in Tailwind/JSX. Import from here for JS configs
// (chart colors, inline style objects, status maps).
// RULE: Never hardcode a hex string. Import from this file.
// ─────────────────────────────────────────────────────────────

// ── Core Palette ──────────────────────────────────────────────

export const FOREST_900 = "#0F2318";
export const FOREST_800 = "#162E21";
export const FOREST_700 = "#1E3A2C";
export const FOREST_600 = "#2A5340";
export const FOREST_500 = "#3A7D53";
export const FOREST_400 = "#4A9E6A";
export const FOREST_300 = "#6BBF87";
export const FOREST_200 = "#A3D9B5";

export const TEAL_600 = "#3D8E8B";
export const TEAL_500 = "#5BA8A0";
export const TEAL_400 = "#7CC0B8";

export const GOLD_900 = "#5C4D0E";
export const GOLD_600 = "#B89C1E";
export const GOLD_500 = "#CDBE3D";

export const CORAL_600 = "#D64540";
export const CORAL_500 = "#E96861";

export const SAGE_700 = "#5A7A5E";
export const SAGE_500 = "#8BAF8E";

export const SHELL_900 = "#262626";
export const SHELL_700 = "#525252";
export const SHELL_600 = "#6B6B6B";
export const SHELL_500 = "#8A8A8A";
export const SHELL_400 = "#A3A3A3";
export const SHELL_300 = "#D4D4D4";

// ── Semantic: Status ──────────────────────────────────────────

export const STATUS_TODO = SHELL_500;
export const STATUS_IN_PROGRESS = TEAL_600;
export const STATUS_DONE = FOREST_300;

// ── Semantic: Participant ─────────────────────────────────────

export const PARTICIPANT_IDLE = SHELL_500;
export const PARTICIPANT_FOCUSED = FOREST_300;

// ── Semantic: Tone (activity feed) ────────────────────────────

export const TONE_SUCCESS = FOREST_300;
export const TONE_NEUTRAL = SHELL_500;

// ── Semantic: Room State ──────────────────────────────────────

export const ROOM_QUIET = SHELL_500;
export const ROOM_WARMING = GOLD_600;
export const ROOM_FOCUSED = FOREST_400;
export const ROOM_FLOWING = TEAL_500;
export const ROOM_COOLING = SAGE_500;

// ── Semantic: Priority ────────────────────────────────────────

export const PRIORITY_URGENT = CORAL_600;
export const PRIORITY_HIGH = GOLD_600;
export const PRIORITY_MEDIUM = GOLD_500;
export const PRIORITY_LOW = SHELL_500;

// ── Semantic: Celebration ─────────────────────────────────────

export const CELEBRATION_GOLD = GOLD_500;

// ── Project Colors (for rotation) ─────────────────────────────

export const PROJECT_COLORS = [
  FOREST_500,
  TEAL_600,
  GOLD_600,
  FOREST_300,
  SAGE_500,
  SHELL_500,
] as const;

// ── Backward Compatibility (DEPRECATED — remove as components migrate) ──

/** @deprecated Use FOREST_300 */
export const GREEN_700 = FOREST_300;
/** @deprecated Use TEAL_500 */
export const CYAN_700 = TEAL_500;
/** @deprecated Use GOLD_500 */
export const GOLD_700 = GOLD_500;
/** @deprecated Use GOLD_600 */
export const AMBER_700 = GOLD_600;
/** @deprecated Use GOLD_600 */
export const ORANGE_700 = GOLD_600;
/** @deprecated Use CORAL_500 */
export const CORAL_700 = CORAL_500;
/** @deprecated Use CORAL_600 */
export const RED_700 = CORAL_600;
/** @deprecated Use FOREST_500 */
export const PURPLE_700 = FOREST_500;
/** @deprecated Use TEAL_600 */
export const INDIGO_700 = TEAL_600;
/** @deprecated Use TEAL_600 */
export const VIOLET_700 = TEAL_600;
/** @deprecated Use FOREST_900 */
export const NAVY_800 = FOREST_900;
/** @deprecated Use SHELL_500 */
export const NAVY_500 = SHELL_500;
/** @deprecated Use SHELL_300 */
export const NAVY_400 = SHELL_300;
/** @deprecated Use GOLD_600 */
export const CELEBRATION_AMBER = GOLD_600;
