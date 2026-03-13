import type { GoalSystemStatus } from "./types";
import { STATUS_TODO, STATUS_IN_PROGRESS, STATUS_DONE } from "./palette";

/** Kanban column order for the goal board. */
export const GOAL_COLUMNS: Array<"active" | "in_progress" | "completed"> = [
  "active",
  "in_progress",
  "completed",
];

/** Display config for each goal board column. */
export const GOAL_STATUS_CONFIG: Record<
  "active" | "in_progress" | "completed",
  { label: string; color: string }
> = {
  active: { label: "To Do", color: STATUS_TODO },
  in_progress: { label: "In Progress", color: STATUS_IN_PROGRESS },
  completed: { label: "Done", color: STATUS_DONE },
};
