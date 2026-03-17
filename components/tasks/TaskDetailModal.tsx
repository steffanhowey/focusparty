"use client";

import { useState, useCallback, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { TaskRecord, Project, TaskPriority, TaskStatus } from "@/lib/types";
import { PRIORITY_CONFIG, STATUS_CONFIG } from "@/lib/taskConstants";
import { Trash2, ChevronDown } from "lucide-react";
import { ProjectPicker } from "./ProjectPicker";

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskRecord | null;
  projects: Project[];
  onUpdateTask: (taskId: string, updates: Partial<Pick<TaskRecord, "title" | "status" | "priority" | "project_id">>) => void;
  onDeleteTask: (taskId: string) => void;
  onCreateProject: (input: { name: string; color: string; emoji: string }) => Promise<Project | undefined>;
}

export function TaskDetailModal({
  isOpen,
  onClose,
  task,
  projects,
  onUpdateTask,
  onDeleteTask,
  onCreateProject,
}: TaskDetailModalProps) {
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("none");
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setStatus(task.status);
      setPriority(task.priority);
      setProjectId(task.project_id);
    }
  }, [task]);

  const handleSave = useCallback(() => {
    if (!task) return;
    const trimmed = title.trim();
    if (!trimmed) return;

    const updates: Partial<Pick<TaskRecord, "title" | "status" | "priority" | "project_id">> = {};
    if (trimmed !== task.title) updates.title = trimmed;
    if (status !== task.status) updates.status = status;
    if (priority !== task.priority) updates.priority = priority;
    if (projectId !== task.project_id) updates.project_id = projectId;

    if (Object.keys(updates).length > 0) {
      onUpdateTask(task.id, updates);
    }
    onClose();
  }, [task, title, status, priority, projectId, onUpdateTask, onClose]);

  const handleDelete = useCallback(() => {
    if (!task) return;
    onDeleteTask(task.id);
    onClose();
  }, [task, onDeleteTask, onClose]);

  if (!task) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Task details">
      <div className="space-y-4">
        <Input
          variant="session"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
          }}
          placeholder="Task title"
          className="w-full text-sm"
        />

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs text-[var(--sg-shell-500)]">
              Status
            </label>
            <div className="relative">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="h-10 w-full cursor-pointer appearance-none rounded-full border border-[var(--sg-shell-border)] bg-[var(--sg-shell-50)] px-4 pr-9 text-sm text-[var(--sg-shell-600)] transition-colors hover:border-[var(--sg-forest-400)] focus:border-[var(--sg-forest-400)] focus:outline-none"
              >
                {(Object.keys(STATUS_CONFIG) as TaskStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_CONFIG[s].label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                strokeWidth={1.5}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--sg-shell-400)]"
              />
            </div>
          </div>

          <div className="flex-1">
            <label className="mb-1.5 block text-xs text-[var(--sg-shell-500)]">
              Priority
            </label>
            <div className="relative">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="h-10 w-full cursor-pointer appearance-none rounded-full border border-[var(--sg-shell-border)] bg-[var(--sg-shell-50)] px-4 pr-9 text-sm text-[var(--sg-shell-600)] transition-colors hover:border-[var(--sg-forest-400)] focus:border-[var(--sg-forest-400)] focus:outline-none"
              >
                {(Object.keys(PRIORITY_CONFIG) as TaskPriority[]).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_CONFIG[p].icon} {PRIORITY_CONFIG[p].label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                strokeWidth={1.5}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--sg-shell-400)]"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs text-[var(--sg-shell-500)]">
            Project
          </label>
          <ProjectPicker
            value={projectId}
            onChange={setProjectId}
            projects={projects}
            onCreateProject={onCreateProject}
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button
            variant="danger"
            size="sm"
            leftIcon={<Trash2 size={14} strokeWidth={1.5} />}
            onClick={handleDelete}
          >
            Delete
          </Button>
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
