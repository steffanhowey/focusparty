// Barrel export for all type domains

export type { CharacterId, CharacterDef } from "./character";

export type { PlanTier, AuthState } from "./user";
export type { User, UserProfile, UserPreferences, Streak } from "./user";

export type {
  SessionPhase,
  SessionOutcome,
  SessionMood,
  ProductivityRating,
  SessionStatus,
  GoalSource,
  GoalStatus,
  BreakMode,
} from "./session";
export type {
  SprintRecord,
  BreakRecord,
  SessionRecord,
  SessionReflection,
  SessionRow,
  SessionSprint,
  SessionGoal,
  SessionTaskRecord,
  SprintResolution,
} from "./session";

export type { TaskStatus, TaskPriority, TaskSortField, TaskSortDir } from "./task";
export type { Task, Project, Label, TaskRecord, TaskFilters, TaskSort } from "./task";

export type { GoalSystemStatus, CommitmentType, CommitmentStatus } from "./goal";
export type { GoalRecord, CommitmentRecord } from "./goal";

export type { ActivityActorType, ActivityEventType } from "./activity";
export type { ActivityEvent, ActivityFeedItem } from "./activity";

export type { RoomState } from "./room";

export type { ParticipantStatus } from "./presence";
export type { PresencePayload } from "./presence";

export type { HostTriggerType, HostMessageType } from "./host";
export type { HostGenerationInput, HostGenerationResult } from "./host";

export type { BreakDuration, BreakEngagementType } from "./break";
export type {
  BreakSegment,
  BreakContentItem,
  BreakContentCandidate,
  BreakContentScore,
  BreakEngagementEvent,
} from "./break";

export type { NoteRecord } from "./notes";

export type {
  ContentPerformance,
  RoomPerformance,
  CalibrationRecommendation,
  ScoreCalibration,
  AutoApprovalConfig,
  AutoApprovalLogEntry,
} from "./analytics";

export type { ContentLakeType, TaskType } from "./learning";
export type {
  AiTool,
  MissionBriefing,
  QuickCheck,
  ReflectionPrompt,
  PracticeType,
  PracticeItem,
  ContentLakeItem,
  ContentSearchResult,
  ArticleCandidate,
  PathItem,
  CurriculumModule,
  LearningPath,
  ItemState,
  LearningProgress,
} from "./learning";

export type {
  UserSessionStats,
  UserStreakStats,
  DailySessionCount,
  FavoritePartyStat,
  PartySummaryStats,
} from "./stats";

export type { ToastType } from "./ui";
export type { ToastItem } from "./ui";

export type {
  TrendDirection,
  InsightType,
  InsightStatus,
  TopicSkillRelationship,
} from "./intelligence";
export type {
  TopicSkillMapping,
  HeatHistoryEntry,
  SkillMarketState,
  PractitionerSnapshot,
  InsightEvidence,
  InsightRecommendation,
  SkillIntelligence,
  SkillRanking,
  IndexFinding,
  SkillIndexEntry,
} from "./intelligence";

export type { SkillFluency } from "./skills";
export type {
  SkillDomain,
  Skill,
  SkillTag,
  SkillWithDomain,
  UserSkill,
  SkillReceiptEntry,
  SkillReceipt,
} from "./skills";
