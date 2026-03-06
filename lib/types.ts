// FocusParty core types — aligned with FOCUSPARTY_SHELL_CAPABILITIES.md

export type CharacterId = "ember" | "moss" | "byte";

export type SessionPhase = "goal" | "sprint" | "review" | "break";

export type AuthState = "loading" | "anonymous" | "authenticated";

export type PlanTier = "free" | "pro" | "pro_plus";

export type GoalSource = "freetext" | "todoist" | "calendar";

export type SessionOutcome = "done" | "mostly" | "partial" | "stuck" | "abandoned";

export type BreakMode = "chat" | "silent" | "breathe";

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

export interface SprintRecord {
  started_at: string;
  ended_at: string;
  planned_minutes: number;
  actual_minutes: number;
}

export interface BreakRecord {
  started_at: string;
  ended_at: string;
  mode: BreakMode;
}

export interface SessionRecord {
  id: string;
  user_id: string;
  character: CharacterId;
  goal: string;
  goal_source: GoalSource;
  planned_duration: number;
  actual_duration: number;
  outcome: SessionOutcome;
  sprints: SprintRecord[];
  breaks: BreakRecord[];
  todoist_task_id: string | null;
  todoist_completed: boolean;
  started_at: string;
  ended_at: string;
  ai_messages_count: number;
  user_messages_count: number;
}

export interface CharacterDef {
  id: CharacterId;
  name: string;
  tagline: string;
  primary: string;
  secondary: string;
  accent: string;
  glow: string;
  roomBg: string;
}

export interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  completedAt: number | null;
}

export type ToastType = "info" | "success" | "warning" | "error" | "celebration";

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration?: number;
  character?: CharacterId;
}
