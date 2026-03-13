import type { TaskPriority, TaskStatus } from "./types";
import {
  STATUS_TODO,
  STATUS_IN_PROGRESS,
  STATUS_DONE,
  PRIORITY_URGENT,
  PRIORITY_HIGH,
  PRIORITY_MEDIUM,
  PRIORITY_LOW,
  PROJECT_COLORS,
} from "./palette";

export const PRIORITY_CONFIG: Record<
  TaskPriority,
  { label: string; icon: string; color: string }
> = {
  p1: { label: "Urgent", icon: "⚡", color: PRIORITY_URGENT },
  p2: { label: "High", icon: "↑", color: PRIORITY_HIGH },
  p3: { label: "Medium", icon: "→", color: PRIORITY_MEDIUM },
  p4: { label: "Low", icon: "↓", color: PRIORITY_LOW },
  none: { label: "No priority", icon: "", color: "transparent" },
};

export const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; color: string }
> = {
  todo: { label: "To Do", color: STATUS_TODO },
  in_progress: { label: "In Progress", color: STATUS_IN_PROGRESS },
  done: { label: "Done", color: STATUS_DONE },
};

export const STATUS_COLUMNS: TaskStatus[] = ["todo", "in_progress", "done"];

export { PROJECT_COLORS };
