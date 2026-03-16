// Learning and curriculum types

import type { Scaffolding } from "../scaffolding/generator";

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
  /** Clip start time in seconds — play from here instead of 0 (watch tasks only) */
  clip_start_seconds: number | null;
  /** Clip end time in seconds — stop here instead of video end (watch tasks only) */
  clip_end_seconds: number | null;

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
  /** Skills this path develops (populated from fp_skill_tags) */
  skill_tags?: Array<{
    skill_slug: string;
    skill_name: string;
    domain_name: string;
    relevance: "primary" | "secondary";
    /** User's current fluency (populated only in path detail for authenticated users) */
    user_fluency?: string;
  }>;
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
