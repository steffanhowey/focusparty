"use client";

import { useState, useCallback, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { GoalTaskList } from "./GoalTaskList";
import { ProjectMultiPicker } from "./ProjectMultiPicker";
import type { GoalRecord, TaskRecord, Project } from "@/lib/types";
import { GOAL_STATUS_CONFIG } from "@/lib/goalConstants";
import { Trash2, Archive, ChevronDown } from "lucide-react";

const EDITABLE_STATUSES: Array<"active" | "in_progress" | "completed"> = [
  "active",
  "in_progress",
  "completed",
];

interface GoalDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: GoalRecord | null;
  tasks: TaskRecord[];
  projects: Project[];
  projectIds: string[];
  onUpdateGoal: (
    goalId: string,
    updates: Partial<Pick<GoalRecord, "title" | "description" | "status" | "target_date" | "completed_at">>
  ) => void;
  onSetGoalProjects: (goalId: string, projectIds: string[]) => void;
  onDeleteGoal: (goalId: string) => void;
  onArchiveGoal: (goalId: string) => void;
  onCreateProject: (input: { name: string; color: string; emoji: string }) => Promise<Project | undefined>;
  onAddTask: (goalId: string, title: string) => void;
  onCompleteTask: (taskId: string) => void;
  onUncompleteTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onEditTask: (taskId: string, newTitle: string) => void;
}

export function GoalDetailModal({
  isOpen,
  onClose,
  goal,
  tasks,
  projects,
  projectIds,
  onUpdateGoal,
  onSetGoalProjects,
  onDeleteGoal,
  onArchiveGoal,
  onCreateProject,
  onAddTask,
  onCompleteTask,
  onUncompleteTask,
  onDeleteTask,
  onEditTask,
}: GoalDetailModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"active" | "in_progress" | "completed">("active");
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  useEffect(() => {
    if (goal) {
      setTitle(goal.title);
      setDescription(goal.description ?? "");
      setStatus(
        goal.status === "archived" ? "active" : (goal.status as "active" | "in_progress" | "completed")
      );
      setSelectedProjectIds(projectIds);
    }
  }, [goal, projectIds]);

  const handleSave = useCallback(() => {
    if (!goal) return;
    const trimmed = title.trim();
    if (!trimmed) return;

    const updates: Partial<Pick<GoalRecord, "title" | "description" | "status" | "completed_at">> = {};
    if (trimmed !== goal.title) updates.title = trimmed;
    if (description.trim() !== (goal.description ?? "")) {
      updates.description = description.trim() || null;
    }
    if (status !== goal.status) {
      updates.status = status;
      if (status === "completed") {
        updates.completed_at = new Date().toISOString();
      } else if (goal.status === "completed") {
        updates.completed_at = null;
      }
    }

    if (Object.keys(updates).length > 0) {
      onUpdateGoal(goal.id, updates);
    }

    // Sync projects if changed
    const sortedCurrent = [...projectIds].sort().join(",");
    const sortedNew = [...selectedProjectIds].sort().join(",");
    if (sortedCurrent !== sortedNew) {
      onSetGoalProjects(goal.id, selectedProjectIds);
    }

    onClose();
  }, [goal, title, description, status, selectedProjectIds, projectIds, onUpdateGoal, onSetGoalProjects, onClose]);

  const handleDelete = useCallback(() => {
    if (!goal) return;
    onDeleteGoal(goal.id);
    onClose();
  }, [goal, onDeleteGoal, onClose]);

  const handleArchive = useCallback(() => {
    if (!goal) return;
    onArchiveGoal(goal.id);
    onClose();
  }, [goal, onArchiveGoal, onClose]);

  const handleAddTask = useCallback(
    (taskTitle: string) => {
      if (!goal) return;
      onAddTask(goal.id, taskTitle);
    },
    [goal, onAddTask]
  );

  if (!goal) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Goal details">
      <div className="space-y-4">
        {/* Title */}
        <Input
          variant="session"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
          }}
          placeholder="Goal title"
          className="w-full text-sm"
        />

        {/* Status */}
        <div>
          <label className="mb-1.5 block text-xs text-[var(--sg-shell-500)]">
            Status
          </label>
          <div className="relative">
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as "active" | "in_progress" | "completed")
              }
              className="h-10 w-full cursor-pointer appearance-none rounded-full border border-[var(--sg-shell-border)] bg-[var(--sg-shell-50)] px-4 pr-9 text-sm text-[var(--sg-shell-600)] transition-colors hover:border-[var(--sg-forest-400)] focus:border-[var(--sg-forest-400)] focus:outline-none"
            >
              {EDITABLE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {GOAL_STATUS_CONFIG[s].label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              strokeWidth={1.5}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--sg-shell-500)]"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="mb-1.5 block text-xs text-[var(--sg-shell-500)]">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description..."
            rows={2}
            className="w-full resize-none rounded-md border border-[var(--sg-shell-border)] bg-[var(--sg-shell-50)] px-4 py-2.5 text-sm text-[var(--sg-shell-900)] placeholder:text-[var(--sg-shell-400)] transition-colors hover:border-[var(--sg-forest-400)] focus:border-[var(--sg-forest-400)] focus:outline-none"
          />
        </div>

        {/* Projects */}
        <div>
          <label className="mb-1.5 block text-xs text-[var(--sg-shell-500)]">
            Projects
          </label>
          <ProjectMultiPicker
            value={selectedProjectIds}
            onChange={setSelectedProjectIds}
            projects={projects}
            onCreateProject={onCreateProject}
          />
        </div>

        {/* Tasks */}
        <div>
          <label className="mb-1.5 block text-xs text-[var(--sg-shell-500)]">
            Tasks
          </label>
          <div className="max-h-48 overflow-y-auto rounded-md border border-[var(--sg-shell-border)] bg-[var(--sg-shell-50)] px-1 py-1">
            <GoalTaskList
              tasks={tasks}
              goalId={goal.id}
              onAddTask={handleAddTask}
              onCompleteTask={onCompleteTask}
              onUncompleteTask={onUncompleteTask}
              onDeleteTask={onDeleteTask}
              onEditTask={onEditTask}
            />
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-1">
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash2 size={14} strokeWidth={1.5} />}
              onClick={handleDelete}
            >
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Archive size={14} strokeWidth={1.5} />}
              onClick={handleArchive}
            >
              Archive
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={!title.trim()}
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
