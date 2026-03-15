// Break content types

import type { Scaffolding } from "../scaffolding/generator";
import type { BreakCategory } from "../breakConstants";

export type BreakDuration = 3 | 5 | 10;

export type BreakEngagementType = "started" | "completed" | "abandoned";

export interface BreakSegment {
  duration: number;      // 3, 5, or 10 (minutes)
  start: number;         // start time in seconds
  label: string;         // AI-generated segment description (max 60 chars)
}

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

export interface BreakEngagementEvent {
  id: string;
  content_item_id: string;
  user_id: string;
  event_type: BreakEngagementType;
  elapsed_seconds: number | null;
  created_at: string;
}
