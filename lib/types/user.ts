// User and authentication types

import type { CharacterId } from "./character";

export type PlanTier = "free" | "pro" | "pro_plus";

export interface User {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  default_character: CharacterId;
  timezone: string;
  created_at: string;
  onboarding_completed: boolean;
  plan: PlanTier;
  sessions_this_week: number;
  weekly_session_limit: number | null;
}

export interface UserPreferences {
  default_sprint_duration: 15 | 25 | 50 | 75;
  default_break_duration: 5 | 10 | 15;
  sprints_per_session: 1 | 2 | 3 | 4;
  camera_default: "on" | "off";
  ambient_sound_default: string | null;
  ambient_volume: number;
  notification_sounds: boolean;
  browser_notifications: boolean;
  daily_reminder_time: string | null;
  keyboard_shortcuts: boolean;
  reduced_motion: boolean;
}

export interface Streak {
  current: number;
  longest: number;
  last_session_date: string | null;
  freezes_remaining: number;
  freeze_used_today: boolean;
  is_at_risk: boolean;
  milestone_pending: number | null;
}

export type AuthState = "loading" | "anonymous" | "authenticated";
