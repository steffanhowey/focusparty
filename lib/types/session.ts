// Session types and records

import type { CharacterId } from "./character";

export type SessionPhase = "setup" | "breathing" | "joining" | "sprint" | "review" | "break" | "resuming";

export type SessionOutcome = "done" | "mostly" | "partial" | "stuck" | "abandoned";

export type SessionMood = "energized" | "focused" | "neutral" | "tired" | "frustrated";

export type ProductivityRating = 1 | 2 | 3 | 4 | 5;

export type SessionStatus = "active" | "completed" | "abandoned";

export type GoalSource = "freetext" | "todoist" | "calendar";

export type GoalStatus = "declared" | "completed" | "abandoned" | "partial";

export type BreakMode = "chat" | "silent" | "breathe";

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

export interface SessionReflection {
  mood: SessionMood | null;
  productivity: ProductivityRating | null;
  sessionDurationSec: number;
}

export interface SessionRow {
  id: string;
  user_id: string;
  party_id: string | null;
  task_id: string | null;
  character: string | null;
  goal_text: string | null;
  phase: SessionPhase;
  status: SessionStatus;
  planned_duration_sec: number;
  actual_duration_sec: number | null;
  reflection_mood: SessionMood | null;
  reflection_productivity: ProductivityRating | null;
  started_at: string;
  ended_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SessionSprint {
  id: string;
  session_id: string;
  sprint_number: number;
  duration_sec: number;
  started_at: string;
  ended_at: string | null;
  completed: boolean;
  metadata: Record<string, unknown>;
}

export interface SessionGoal {
  id: string;
  session_id: string;
  sprint_id: string | null;
  user_id: string;
  task_id: string | null;
  goal_id: string | null;
  body: string;
  status: GoalStatus;
  declared_at: string;
  completed_at: string | null;
  metadata: Record<string, unknown>;
}

export interface SessionTaskRecord {
  id: string;
  session_id: string;
  user_id: string;
  text: string;
  completed: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type SprintResolution = "completed" | "partial" | "continue" | "abandon";
