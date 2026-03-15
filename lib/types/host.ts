// AI Host types

import type { RoomState } from "./room";

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
