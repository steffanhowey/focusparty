// SkillGap core types

import type { BreakCategory } from "./breakConstants";
import type { Scaffolding } from "./scaffolding/generator";
export type { BreakCategory };

export type CharacterId = "ember" | "moss" | "byte";

export type SessionPhase = "setup" | "breathing" | "joining" | "sprint" | "review" | "break" | "resuming";

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
  /** FK to fp_linked_resources — set when this task was imported from an integration */
  linked_resource_id: string | null;
  labels?: Label[];
  project?: Project | null;
  /** Joined from fp_linked_resources when present */
  linked_resource?: {
    provider: string;
    resource_type: string;
    external_id: string;
    title: string;
    url: string | null;
  } | null;
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
  | "break_cancelled"
  | "integration_linked"
  | "integration_writeback"
  | "discussion_prompt";

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
  /** Linked external work item (GitHub issue, Linear issue, etc.) */
  linkedResource?: {
    provider: string;
    title: string;
    url: string | null;
    resourceType: string;
  } | null;
  /** Pre-written host guidance from auto-generated blueprint */
  blueprintHints?: {
    triggerHint: string;
    curriculumContext?: string;
  };
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
  /** Break content info — populated when phase === "break" */
  breakContentId: string | null;
  breakContentTitle: string | null;
  breakContentThumbnail: string | null;
  /** Current scaffolding learning state during break */
  breakLearningState: "pre_watch" | "watching" | "comprehension" | "exercise" | "discussion" | null;
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

// ─── Session Tasks ──────────────────────────────────────────

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

// ─── Break Segments ─────────────────────────────────────────

export type BreakDuration = 3 | 5 | 10;

export interface BreakSegment {
  duration: number;      // 3, 5, or 10 (minutes)
  start: number;         // start time in seconds
  label: string;         // AI-generated segment description (max 60 chars)
}

// ─── Break Content ──────────────────────────────────────────

export interface BreakContentItem {
  id: string;
  room_world_key: string;
  category: BreakCategory;
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
  /** AI-identified best segments per duration (3/5/10 min) */
  segments: BreakSegment[] | null;
  /** AI-assigned optimal break duration for this video */
  best_duration: 3 | 5 | 10 | null;
  /** AI-assigned topic tags for personalization (e.g. ["react", "system-design"]) */
  topics: string[] | null;
  /** AI-generated learning scaffolding (null for legacy/unscaffolded content) */
  scaffolding: Scaffolding | null;
  /** Scaffolding generation status */
  scaffolding_status: "none" | "pending" | "complete" | "failed" | null;
}

// ─── AI Curator — Candidates ────────────────────────────────

export interface BreakContentCandidate {
  id: string;
  source: string;
  external_id: string;
  world_key: string;
  category: BreakCategory;
  title: string;
  description: string | null;
  creator: string | null;
  channel_id: string | null;
  video_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  published_at: string | null;
  view_count: number | null;
  like_count: number | null;
  comment_count: number | null;
  discovered_at: string;
  status: "pending" | "evaluated" | "rejected" | "promoted";
  discovery_source: "scheduled" | "hot-topic" | "creator" | "manual";
}

// ─── AI Curator — Scores ────────────────────────────────────

export interface BreakContentScore {
  id: string;
  candidate_id: string;
  world_key: string;
  taste_score: number;
  relevance_score: number | null;
  engagement_score: number | null;
  content_density: number | null;
  creator_authority: number | null;
  freshness_score: number | null;
  novelty_score: number | null;
  evaluation_notes: string | null;
  editorial_note: string | null;
  /** AI-identified best segments per duration */
  segments: BreakSegment[] | null;
  /** AI-recommended duration for this content */
  best_duration: 3 | 5 | 10 | null;
  /** AI-assigned topic tags for personalization */
  topics: string[] | null;
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

// ─── Notes ──────────────────────────────────────────────────

export interface NoteRecord {
  id: string;
  user_id: string;
  party_id: string;
  session_id: string | null;
  break_category: string | null;
  content_item_id: string | null;
  note_text: string;
  created_at: string;
  updated_at: string;
}

// ─── Analytics & Performance ─────────────────────────────────

export interface ContentPerformance {
  id: string;
  videoId: string;
  worldKey: string;
  periodDate: string;
  impressions: number;
  starts: number;
  completions: number;
  abandonments: number;
  extensions: number;
  avgWatchSeconds: number;
  completionRate: number;
  engagementScore: number;
}

export interface RoomPerformance {
  id: string;
  roomId: string;
  periodDate: string;
  uniqueParticipants: number;
  totalSessions: number;
  totalSprints: number;
  avgSessionMinutes: number;
  retentionRate: number;
  breakCompletionRate: number;
}

export interface CalibrationRecommendation {
  dimension: string;
  currentWeight: number;
  recommendedWeight: number;
  reason: string;
}

export interface ScoreCalibration {
  id: string;
  calibrationType: "taste_score" | "heat_score" | "creator_authority";
  runAt: string;
  sampleSize: number;
  correlation: number;
  currentWeights: Record<string, number>;
  recommendedWeights: Record<string, number> | null;
  recommendations: CalibrationRecommendation[];
  autoApplied: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

export interface AutoApprovalConfig {
  id: string;
  enabled: boolean;
  minHeatScore: number;
  minContentScore: number;
  minCreatorAuthority: number;
  minCurriculumItems: number;
  maxDailyApprovals: number;
  updatedAt: string;
  updatedBy: string | null;
}

export interface AutoApprovalLogEntry {
  id: string;
  blueprintId: string;
  criteriaSnapshot: AutoApprovalConfig;
  scoresSnapshot: Record<string, number>;
  decision: "approved" | "skipped" | "cap_reached";
  reason: string | null;
  createdAt: string;
}

// ─── Content Lake (Learn) ───────────────────────────────────

export type ContentLakeType = "video" | "article" | "practice";

/** The four task types in a curriculum */
export type TaskType = "watch" | "do" | "check" | "reflect";

/** An AI tool in the registry */
export interface AiTool {
  name: string;
  slug: string;
  url: string;
  description: string;
  /** Tool icon identifier for UI (maps to lucide-react icon name) */
  icon: string;
  /** Category of tool */
  category: "coding" | "writing" | "design" | "research" | "general";
  /** What the user should paste/submit after using the tool */
  submission_type: "text" | "screenshot" | "either";
  /** Short instruction shown after tool opens */
  paste_instruction: string;
  /** Whether this tool supports deep-linking with pre-filled prompts */
  supports_deep_link: boolean;
  /** Template for deep-link URL. Use {{prompt}} placeholder. Null if not supported. */
  deep_link_template: string | null;
}

/** Mission briefing for a Do task — everything needed for tool practice */
export interface MissionBriefing {
  /** 1-sentence action-oriented objective: "Build a..." / "Use X to..." */
  objective: string;
  /** Why this connects to what was just learned (1-2 sentences) */
  context: string;
  /** The primary AI tool for this mission */
  tool: AiTool;
  /** Ready-to-paste prompt for the tool */
  tool_prompt: string;
  /** Step-by-step instructions (3-5 steps) */
  steps: string[];
  /** What "done" looks like — checkable criteria */
  success_criteria: string[];
  /** Starter code or template (if applicable) */
  starter_code: string | null;
  /** How much guidance this mission provides */
  guidance_level: "guided" | "scaffolded" | "independent" | "solo";
  /** What type of submission is expected */
  submission_type: "text" | "screenshot" | "either";
}

/** Quick comprehension check — shown inline, not as a separate step */
export interface QuickCheck {
  /** The question */
  question: string;
  /** For multiple choice: array of options. Null = free-text response. */
  options: string[] | null;
  /** The correct answer (for MC) or reference answer (for free-text) */
  correct_answer: string;
  /** Hint shown after first wrong attempt */
  hint: string;
}

/** Reflection prompt at module boundaries */
export interface ReflectionPrompt {
  /** The reflection question, personalized to user context */
  prompt: string;
  /** Minimum character count to submit (default 50) */
  min_length: number;
}

/** @deprecated — Use MissionBriefing, QuickCheck, or ReflectionPrompt instead */
export type PracticeType = "comprehension" | "tool_challenge" | "paste_back";

/** @deprecated — Use MissionBriefing, QuickCheck, or ReflectionPrompt instead */
export interface PracticeItem {
  practice_type: PracticeType;
  title: string;
  prompt: string;
  instructions: string[] | null;
  tools: AiTool[] | null;
  starter_code: string | null;
  success_criteria: string | null;
  reference_answer: string | null;
  estimated_minutes: number;
}

export interface ContentLakeItem {
  id: string;
  content_type: ContentLakeType;
  external_id: string;
  source: string;
  source_url: string;
  title: string;
  description: string | null;
  creator_name: string | null;
  thumbnail_url: string | null;
  published_at: string | null;
  duration_seconds: number | null;
  article_word_count: number | null;
  quality_score: number | null;
  topics: string[];
  editorial_note: string | null;
  scaffolding: Scaffolding | null;
  scaffolding_status: string | null;
  indexed_at: string;
}

export interface ContentSearchResult extends ContentLakeItem {
  similarity: number;
  combined_score: number;
}

export interface ArticleCandidate {
  id: string;
  source: string;
  source_url: string;
  source_id: string;
  feed_label: string | null;
  title: string;
  summary: string | null;
  full_text: string | null;
  word_count: number | null;
  author: string | null;
  published_at: string | null;
  status: "pending" | "evaluated" | "rejected" | "indexed";
  quality_score: number | null;
  relevance_scores: Record<string, number> | null;
  topics: string[];
  editorial_note: string | null;
  evaluated_at: string | null;
  signal_id: string | null;
  discovered_at: string;
}

// ─── Learning Paths ─────────────────────────────────────────

/** A single task in a curriculum-based learning path */
export interface PathItem {
  /** Unique ID for this item within the path */
  item_id: string;
  /** What type of task this is */
  task_type: TaskType;
  /** Position in the overall path (0-indexed) */
  position: number;
  /** Which module this belongs to */
  module_index: number;
  /** Display title for this task */
  title: string;
  /** 1-sentence explanation of why this task matters here */
  connective_text: string;
  /** Estimated seconds for this task */
  duration_seconds: number;

  // ── Watch task fields (only present when task_type === 'watch') ──
  /** Content lake item ID (watch tasks only) */
  content_id: string | null;
  /** video or article (watch tasks only) */
  content_type: ContentLakeType | null;
  /** Creator name (watch tasks only) */
  creator_name: string | null;
  /** Video/article URL (watch tasks only) */
  source_url: string | null;
  /** Thumbnail (watch tasks only) */
  thumbnail_url: string | null;
  /** Quality score from content lake (watch tasks only) */
  quality_score: number | null;

  // ── Do task fields (only present when task_type === 'do') ──
  /** Mission briefing for tool practice (do tasks only) */
  mission: MissionBriefing | null;

  // ── Check task fields (only present when task_type === 'check') ──
  /** Quick check question (check tasks only) */
  check: QuickCheck | null;

  // ── Reflect task fields (only present when task_type === 'reflect') ──
  /** Reflection prompt (reflect tasks only) */
  reflection: ReflectionPrompt | null;

  // ── @deprecated fields for backward compat with old paths ──
  /** @deprecated — Use task_type instead */
  section?: "foundations" | "applied" | "advanced";
  /** @deprecated — Use MissionBriefing/QuickCheck/ReflectionPrompt instead */
  practice?: PracticeItem | null;
}

/** A module in a curriculum (replaces fixed sections) */
export interface CurriculumModule {
  /** Module index (0-based) */
  index: number;
  /** Module title: "See What's Possible", "Your First Component", etc. */
  title: string;
  /** 1-sentence description of what this module covers */
  description: string;
  /** How many tasks in this module */
  task_count: number;
  /** Estimated duration in seconds */
  duration_seconds: number;
}

/** A complete curriculum-based learning path */
export interface LearningPath {
  id: string;
  title: string;
  description: string;
  /** The user-facing goal: what they'll be able to DO when done */
  goal?: string;
  query: string;
  topics: string[];
  /** Primary tool(s) featured in this path */
  primary_tools?: string[];
  difficulty_level: "beginner" | "intermediate" | "advanced";
  estimated_duration_seconds: number;
  items: PathItem[];
  /** Curriculum modules */
  modules?: CurriculumModule[];
  /** How this path was generated */
  source?: "search" | "discovery" | "trending";
  view_count: number;
  start_count: number;
  completion_count: number;
  created_at: string;
}

/** Per-item progress state */
export interface ItemState {
  completed: boolean;
  completed_at?: string;
  time_spent_seconds?: number;
  /** For do tasks: what the user submitted */
  submission_text?: string;
  /** For do tasks: screenshot URL if submitted */
  submission_image_url?: string;
  /** AI evaluation result */
  evaluation?: {
    quality: "nailed_it" | "good" | "needs_iteration";
    feedback: string;
    criteria_results?: { criterion: string; passed: boolean }[];
  };
  /** Number of attempts */
  attempts?: number;
  /** Whether the user skipped this task */
  skipped?: boolean;
}

/** User progress through a learning path */
export interface LearningProgress {
  id: string;
  user_id: string;
  path_id: string;
  started_at: string;
  last_activity_at: string;
  completed_at: string | null;
  current_item_index: number;
  items_completed: number;
  items_total: number;
  time_invested_seconds: number;
  item_states: Record<string, ItemState>;
  status: "in_progress" | "completed" | "abandoned";
}
