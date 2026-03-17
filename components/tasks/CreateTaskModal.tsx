"use client";

import { useState, useCallback } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ChevronDown } from "lucide-react";
import type { Project, TaskPriority, TaskStatus } from "@/lib/types";
import { PRIORITY_CONFIG, STATUS_CONFIG } from "@/lib/taskConstants";
import { ProjectPicker } from "./ProjectPicker";

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTask: (input: {
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    project_id: string | null;
  }) => void;
  projects: Project[];
  defaultStatus?: TaskStatus;
  onCreateProject: (input: { name: string; color: string; emoji: string }) => Promise<Project | undefined>;
}

export function CreateTaskModal({
  isOpen,
  onClose,
  onCreateTask,
  projects,
  defaultStatus = "todo",
  onCreateProject,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [priority, setPriority] = useState<TaskPriority>("none");
  const [projectId, setProjectId] = useState<string | null>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onCreateTask({
      title: trimmed,
      status,
      priority,
      project_id: projectId,
    });
    setTitle("");
    setStatus(defaultStatus);
    setPriority("none");
    setProjectId(null);
    onClose();
  }, [title, status, priority, projectId, onCreateTask, onClose, defaultStatus]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New task">
      <div className="space-y-4">
        <Input
          variant="session"
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
          placeholder="Task title"
          className="w-full text-sm"
        />

        <div className="flex gap-3">
          {/* Status */}
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

          {/* Priority */}
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

        {/* Project */}
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

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={!title.trim()}
          >
            Create task
          </Button>
        </div>
      </div>
    </Modal>
  );
}
