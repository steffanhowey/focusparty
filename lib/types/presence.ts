// Presence and participant types

import type { CharacterId } from "./character";
import type { SessionPhase, BreakMode } from "./session";
import type { CommitmentType } from "./goal";

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
