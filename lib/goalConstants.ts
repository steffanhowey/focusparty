import type { GoalSystemStatus } from "./types";

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
  active: { label: "To Do", color: "#888888" },
  in_progress: { label: "In Progress", color: "#7c5cfc" },
  completed: { label: "Done", color: "#5BC682" },
};
