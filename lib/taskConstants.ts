import type { TaskPriority, TaskStatus } from "./types";

export const PRIORITY_CONFIG: Record<
  TaskPriority,
  { label: string; icon: string; color: string }
> = {
  p1: { label: "Urgent", icon: "⚡", color: "#ef4444" },
  p2: { label: "High", icon: "↑", color: "#f97316" },
  p3: { label: "Medium", icon: "→", color: "#eab308" },
  p4: { label: "Low", icon: "↓", color: "#9ca3af" },
  none: { label: "No priority", icon: "", color: "transparent" },
};

export const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; color: string }
> = {
  todo: { label: "To Do", color: "#888888" },
  in_progress: { label: "In Progress", color: "#7c5cfc" },
  done: { label: "Done", color: "#5BC682" },
};

export const STATUS_COLUMNS: TaskStatus[] = ["todo", "in_progress", "done"];

export const PROJECT_COLORS = [
  "#7c5cfc",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
] as const;
