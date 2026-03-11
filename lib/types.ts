// FocusParty core types — aligned with FOCUSPARTY_SHELL_CAPABILITIES.md

export type CharacterId = "ember" | "moss" | "byte";

export type SessionPhase = "setup" | "breathing" | "sprint" | "review" | "break";

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

/** @deprecated Use TaskRecord instead */
export interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  completedAt: number | null;
}

// ─── Global Task System ─────────────────────────────────────

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "none" | "p4" | "p3" | "p2" | "p1";

export interface Project {
  id: string;
  user_id: string;
  name: string;
  color: string;
  emoji: string;
  is_default: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Label {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface TaskRecord {
  id: string;
  user_id: string;
  project_id: string | null;
  goal_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  position: number;
  ai_generated: boolean;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  labels?: Label[];
  project?: Project | null;
}

export interface TaskFilters {
  projectId?: string | null;
  priority?: TaskPriority[];
  labelIds?: string[];
  status?: TaskStatus[];
  search?: string;
}

export type TaskSortField = "position" | "priority" | "created_at";
export type TaskSortDir = "asc" | "desc";

export interface TaskSort {
  field: TaskSortField;
  direction: TaskSortDir;
}

export type SessionMood = "energized" | "focused" | "neutral" | "tired" | "frustrated";

export type ProductivityRating = 1 | 2 | 3 | 4 | 5;

export interface SessionReflection {
  mood: SessionMood | null;
  productivity: ProductivityRating | null;
  sessionDurationSec: number;
}

// ─── Session Persistence ──────────────────────────────────────

export type SessionStatus = "active" | "completed" | "abandoned";

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

export type GoalStatus = "declared" | "completed" | "abandoned" | "partial";

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

export type ActivityActorType = "user" | "host" | "system" | "synthetic";

export type ActivityEventType =
  | "session_started"
  | "session_completed"
  | "sprint_started"
  | "sprint_completed"
  | "goal_declared"
  | "goal_completed"
  | "task_completed"
  | "reflection_submitted"
  | "participant_joined"
  | "participant_left"
  | "host_prompt"
  | "high_five"
  | "room_entered"
  | "check_in"
  | "commitment_declared"
  | "commitment_succeeded"
  | "commitment_failed"
  | "goal_shipped"
  | "break_started"
  | "break_completed"
  | "break_cancelled";

// ─── Room State ──────────────────────────────────────────────

export type RoomState =
  | "quiet"
  | "warming_up"
  | "focused"
  | "flowing"
  | "cooling_down";

// ─── AI Host ─────────────────────────────────────────────────

export type HostTriggerType =
  | "session_started"
  | "sprint_started"
  | "sprint_midpoint"
  | "sprint_near_end"
  | "review_entered"
  | "session_completed";

export type HostMessageType = "opening" | "midpoint" | "reflection" | "transition";

export interface HostGenerationInput {
  partyId: string;
  partyName: string;
  hostPersonality: string;
  triggerType: HostTriggerType;
  goalSummary: string | null;
  recentActivity: string[];
  recentHostMessages: string[];
  participantCount: number;
  sprintNumber: number | null;
  sprintDurationSec: number | null;
  sprintElapsedSec: number | null;
  roomState: RoomState | null;
}

export interface HostGenerationResult {
  shouldPost: boolean;
  messageType: HostMessageType;
  body: string;
  reason: string;
}

export interface ActivityEvent {
  id: string;
  party_id: string | null;
  session_id: string | null;
  user_id: string | null;
  actor_type: ActivityActorType;
  event_type: ActivityEventType;
  body: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

// ─── Presence ────────────────────────────────────────────────

export type ParticipantStatus =
  | "idle"
  | "starting"
  | "focused"
  | "reviewing"
  | "on_break";

export interface PresencePayload {
  userId: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  character: CharacterId | null;
  activeSessionId: string | null;
  phase: SessionPhase | null;
  status: ParticipantStatus;
  goalPreview: string | null;
  commitmentType: CommitmentType | null;
  sprintStartedAt: string | null;
  sprintDurationSec: number | null;
  updatedAt: string;
}

export interface ActivityFeedItem extends ActivityEvent {
  displayText: string;
}

// ─── Progress + Stats ─────────────────────────────────────────

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

// ─── Toast System ─────────────────────────────────────────────

export type ToastType = "info" | "success" | "warning" | "error" | "celebration";

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration?: number;
  character?: CharacterId;
}

// ─── Goal System ─────────────────────────────────────────────

export type GoalSystemStatus = "active" | "in_progress" | "completed" | "archived";

export interface GoalRecord {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: GoalSystemStatus;
  position: number;
  ai_generated: boolean;
  target_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Commitment System ───────────────────────────────────────

export type CommitmentType = "personal" | "social" | "locked";
export type CommitmentStatus = "active" | "succeeded" | "failed" | "cancelled";

export interface CommitmentRecord {
  id: string;
  user_id: string;
  session_goal_id: string | null;
  session_id: string | null;
  goal_id: string | null;
  type: CommitmentType;
  status: CommitmentStatus;
  declared_at: string;
  resolved_at: string | null;
  metadata: Record<string, unknown>;
}

export type SprintResolution = "completed" | "partial" | "continue" | "abandon";

// ─── Break Content ──────────────────────────────────────────

export interface BreakContentItem {
  id: string;
  room_world_key: string;
  category: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  video_url: string;
  source_name: string | null;
  duration_seconds: number | null;
  sort_order: number;
  status: string;
  created_at: string;
  /** AI curator fields (nullable — legacy seed rows won't have these) */
  candidate_id: string | null;
  taste_score: number | null;
  pinned: boolean;
  expires_at: string | null;
  editorial_note: string | null;
}

// ─── AI Curator — Candidates ────────────────────────────────

export interface BreakContentCandidate {
  id: string;
  source: string;
  external_id: string;
  world_key: string;
  title: string;
  description: string | null;
  creator: string | null;
  video_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  published_at: string | null;
  view_count: number | null;
  like_count: number | null;
  comment_count: number | null;
  discovered_at: string;
  status: "pending" | "evaluated" | "rejected" | "promoted";
}

// ─── AI Curator — Scores ────────────────────────────────────

export interface BreakContentScore {
  id: string;
  candidate_id: string;
  world_key: string;
  taste_score: number;
  relevance_score: number | null;
  engagement_score: number | null;
  educational_density: number | null;
  creator_authority: number | null;
  freshness_score: number | null;
  novelty_score: number | null;
  evaluation_notes: string | null;
  editorial_note: string | null;
  evaluated_at: string;
}

// ─── AI Curator — Engagement ────────────────────────────────

export type BreakEngagementType = "started" | "completed" | "abandoned";

export interface BreakEngagementEvent {
  id: string;
  content_item_id: string;
  user_id: string;
  event_type: BreakEngagementType;
  elapsed_seconds: number | null;
  created_at: string;
}
