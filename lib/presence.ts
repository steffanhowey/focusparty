import type { SessionPhase, ParticipantStatus, PresencePayload, CharacterId } from "./types";

// ─── Phase → Status Mapping ──────────────────────────────────

/** Map a session phase to a room-readable participant status. */
export function phaseToStatus(phase: SessionPhase | null): ParticipantStatus {
  if (!phase) return "idle";
  switch (phase) {
    case "setup":
    case "breathing":
      return "starting";
    case "sprint":
      return "focused";
    case "review":
      return "reviewing";
    case "break":
      return "on_break";
    default:
      return "idle";
  }
}

// ─── Payload Construction ────────────────────────────────────

/** Build the canonical presence payload to track on the channel. */
export function buildPresencePayload(input: {
  userId: string;
  displayName: string;
  username?: string | null;
  avatarUrl?: string | null;
  character?: CharacterId | null;
  activeSessionId?: string | null;
  phase?: SessionPhase | null;
  goalPreview?: string | null;
}): PresencePayload {
  return {
    userId: input.userId,
    displayName: input.displayName,
    username: input.username ?? null,
    avatarUrl: input.avatarUrl ?? null,
    character: (input.character as CharacterId) ?? null,
    activeSessionId: input.activeSessionId ?? null,
    phase: input.phase ?? null,
    status: phaseToStatus(input.phase ?? null),
    goalPreview: input.goalPreview ?? null,
    updatedAt: new Date().toISOString(),
  };
}

// ─── Channel Naming ──────────────────────────────────────────

/** Presence channel name convention. */
export function presenceChannelName(partyId: string): string {
  return `party:${partyId}:presence`;
}

// ─── Status Display Config ───────────────────────────────────

export const PARTICIPANT_STATUS_CONFIG: Record<
  ParticipantStatus,
  { label: string; color: string; dotColor: string }
> = {
  idle: { label: "Idle", color: "#888888", dotColor: "#888888" },
  starting: { label: "Starting", color: "#F5C54E", dotColor: "#F5C54E" },
  focused: { label: "Focused", color: "#5BC682", dotColor: "#5BC682" },
  reviewing: { label: "Reviewing", color: "#5CC2EC", dotColor: "#5CC2EC" },
  on_break: { label: "On Break", color: "#8C55EF", dotColor: "#8C55EF" },
};

// ─── Event Display Text ──────────────────────────────────────

/** Build momentum-style display text for an activity event. */
export function eventDisplayText(
  eventType: string,
  displayName: string,
  body?: string | null
): string {
  const name = displayName || "Someone";
  switch (eventType) {
    case "session_started":
      return `${name} started a focus session`;
    case "session_completed":
      return `${name} completed a session`;
    case "sprint_started":
      return `${name} began a sprint`;
    case "sprint_completed":
      return `${name} completed a sprint`;
    case "goal_declared":
      return body ? `${name} set a goal: ${body}` : `${name} declared a goal`;
    case "goal_completed":
      return `${name} completed a goal`;
    case "task_completed":
      return `${name} finished a task`;
    case "reflection_submitted":
      return `${name} submitted a reflection`;
    case "participant_joined":
      return `${name} joined the party`;
    case "participant_left":
      return `${name} left the party`;
    case "host_prompt":
      return body ? `Host: ${body}` : "Host posted a prompt";
    case "high_five":
      return body ? `${name} high-fived ${body}` : `${name} sent a high five`;
    case "room_entered":
      return `${name} entered the room`;
    default:
      return `${name} did something`;
  }
}
