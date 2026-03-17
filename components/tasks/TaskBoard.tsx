"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useTasks } from "@/lib/useTasks";
import { useProjects } from "@/lib/useProjects";
import { useLabels } from "@/lib/useLabels";
import { useCurrentUser } from "@/lib/useCurrentUser";
import type {
  TaskRecord,
  TaskPriority,
  TaskStatus,
} from "@/lib/types";
import { FilterBar } from "./FilterBar";
import { KanbanBoard } from "./KanbanBoard";
import { CreateTaskModal } from "./CreateTaskModal";
import { TaskDetailModal } from "./TaskDetailModal";
import { LabelManager } from "./LabelManager";

export function TaskBoard({ goalId }: { goalId?: string }) {
  const { userId, isLoading: authLoading } = useCurrentUser();
  const {
    tasks,
    loading: tasksLoading,
    addTask,
    deleteTask,
    updateTask,
    reorderTasksByStatus,
  } = useTasks();
  const {
    projects,
    createProject,
  } = useProjects();
  const {
    labels,
    createLabel,
    updateLabel,
    deleteLabel,
  } = useLabels();

  // View state
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedPriorities, setSelectedPriorities] = useState<TaskPriority[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<TaskStatus[]>([]);
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailTask, setDetailTask] = useState<TaskRecord | null>(null);
  const [labelManagerOpen, setLabelManagerOpen] = useState(false);

  // Listen for header CTA click
  useEffect(() => {
    const handler = () => setCreateModalOpen(true);
    document.addEventListener("fp:create-task", handler);
    return () => document.removeEventListener("fp:create-task", handler);
  }, []);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    let result = tasks;

    // Scope to goal when drilled in
    if (goalId) {
      result = result.filter((t) => t.goal_id === goalId);
    }

    if (selectedProjectId) {
      result = result.filter((t) => t.project_id === selectedProjectId);
    }
    if (selectedPriorities.length > 0) {
      result = result.filter((t) => selectedPriorities.includes(t.priority));
    }
    if (selectedStatuses.length > 0) {
      result = result.filter((t) => selectedStatuses.includes(t.status));
    }
    if (selectedLabelIds.length > 0) {
      result = result.filter((t) =>
        t.labels?.some((l) => selectedLabelIds.includes(l.id))
      );
    }

    return result;
  }, [tasks, goalId, selectedProjectId, selectedPriorities, selectedStatuses, selectedLabelIds]);

  const handleAddTask = useCallback(
    async (title: string, status?: TaskStatus) => {
      const input: { title: string; status?: TaskStatus; goal_id?: string } =
        status && status !== "todo" ? { title, status } : { title };
      if (goalId) input.goal_id = goalId;
      await addTask(input);
    },
    [addTask, goalId]
  );

  const handleCreateFromModal = useCallback(
    async (input: {
      title: string;
      status: TaskStatus;
      priority: TaskPriority;
      project_id: string | null;
    }) => {
      await addTask({ ...input, ...(goalId ? { goal_id: goalId } : {}) });
    },
    [addTask, goalId]
  );

  const handleTaskClick = useCallback((task: TaskRecord) => {
    setDetailTask(task);
  }, []);

  const handleUpdateTask = useCallback(
    async (
      taskId: string,
      updates: Partial<Pick<TaskRecord, "title" | "status" | "priority" | "project_id" | "position">>
    ) => {
      await updateTask(taskId, updates);
    },
    [updateTask]
  );

  if (authLoading || tasksLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-sm text-[var(--sg-shell-500)]">
          Loading tasks...
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <FilterBar
        projects={projects}
        selectedProjectId={selectedProjectId}
        onProjectChange={setSelectedProjectId}
        selectedPriorities={selectedPriorities}
        onPriorityChange={setSelectedPriorities}
        selectedStatuses={selectedStatuses}
        onStatusChange={setSelectedStatuses}
        labels={labels}
        selectedLabelIds={selectedLabelIds}
        onLabelChange={setSelectedLabelIds}
      />

      <KanbanBoard
        tasks={filteredTasks}
        onAddTask={handleAddTask}
        onUpdateTask={handleUpdateTask}
        onReorderByStatus={reorderTasksByStatus}
        onTaskClick={handleTaskClick}
      />

      <CreateTaskModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreateTask={handleCreateFromModal}
        projects={projects}
        onCreateProject={createProject}
      />

      <TaskDetailModal
        isOpen={detailTask !== null}
        onClose={() => setDetailTask(null)}
        task={detailTask}
        projects={projects}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={deleteTask}
        onCreateProject={createProject}
      />

      <LabelManager
        isOpen={labelManagerOpen}
        onClose={() => setLabelManagerOpen(false)}
        labels={labels}
        onCreateLabel={createLabel}
        onUpdateLabel={updateLabel}
        onDeleteLabel={deleteLabel}
      />
    </div>
  );
}
