// Goal system types

export type GoalSystemStatus = "active" | "in_progress" | "completed" | "archived";

export type CommitmentType = "personal" | "social" | "locked";
export type CommitmentStatus = "active" | "succeeded" | "failed" | "cancelled";

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
