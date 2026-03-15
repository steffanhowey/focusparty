// Activity and event types

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

export interface ActivityFeedItem extends ActivityEvent {
  displayText: string;
}
