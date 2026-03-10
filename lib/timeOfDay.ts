// ─── Time-of-Day State ──────────────────────────────────────
// Determines the environmental time state from the user's local
// clock. Used to select the right AI-generated room background.

export type TimeOfDayState = "morning" | "afternoon" | "evening" | "late_night";

/** Hour boundaries for each time state (start hour → state). */
const TIME_BOUNDARIES: [number, TimeOfDayState][] = [
  [6, "morning"], //  06:00 – 10:59
  [11, "afternoon"], //  11:00 – 16:59
  [17, "evening"], //  17:00 – 21:59
  [22, "late_night"], //  22:00 – 05:59 (wraps)
];

/**
 * Determine the time-of-day state from the user's local clock.
 * Uses `Date.getHours()` — local timezone, no server dependency.
 */
export function getUserTimeState(now?: Date): TimeOfDayState {
  const hour = (now ?? new Date()).getHours();

  for (let i = TIME_BOUNDARIES.length - 1; i >= 0; i--) {
    if (hour >= TIME_BOUNDARIES[i][0]) return TIME_BOUNDARIES[i][1];
  }

  // hour < 6 → still late_night from previous day
  return "late_night";
}

/** All valid time states in chronological order. */
export const TIME_OF_DAY_STATES: TimeOfDayState[] = [
  "morning",
  "afternoon",
  "evening",
  "late_night",
];

/** Human-readable labels for display. */
export const TIME_STATE_LABELS: Record<TimeOfDayState, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  late_night: "Late Night",
};
