// User statistics types

export interface UserSessionStats {
  totalCompletedSessions: number;
  totalFocusMinutes: number;
  totalCompletedSprints: number;
  sessionsThisWeek: number;
}

export interface UserStreakStats {
  currentStreak: number;
  bestStreak: number;
  /** ISO date strings (YYYY-MM-DD) of active days, sorted descending. */
  activeDays: string[];
}

export interface DailySessionCount {
  /** YYYY-MM-DD */
  day: string;
  sessions: number;
}

export interface FavoritePartyStat {
  partyId: string;
  partyName: string;
  sessionCount: number;
  character: string | null;
}

export interface PartySummaryStats {
  sessionsToday: number;
  completedSprintsToday: number;
}
