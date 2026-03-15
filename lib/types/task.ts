// Task system types

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "none" | "p4" | "p3" | "p2" | "p1";

/** @deprecated Use TaskRecord instead */
export interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  completedAt: number | null;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  color: string;
  emoji: string;
  is_default: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Label {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface TaskRecord {
  id: string;
  user_id: string;
  project_id: string | null;
  goal_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  position: number;
  ai_generated: boolean;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  /** FK to fp_linked_resources — set when this task was imported from an integration */
  linked_resource_id: string | null;
  labels?: Label[];
  project?: Project | null;
  /** Joined from fp_linked_resources when present */
  linked_resource?: {
    provider: string;
    resource_type: string;
    external_id: string;
    title: string;
    url: string | null;
  } | null;
}

export interface TaskFilters {
  projectId?: string | null;
  priority?: TaskPriority[];
  labelIds?: string[];
  status?: TaskStatus[];
  search?: string;
}

export type TaskSortField = "position" | "priority" | "created_at";
export type TaskSortDir = "asc" | "desc";

export interface TaskSort {
  field: TaskSortField;
  direction: TaskSortDir;
}
