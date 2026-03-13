"use client";

import { useState, useCallback } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { TaskPicker } from "./TaskPicker";
import type { TaskRecord } from "@/lib/types";

interface CreateGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: TaskRecord[];
  onCreateGoal: (input: {
    title: string;
    description?: string | null;
    taskIds?: string[];
  }) => void;
}

export function CreateGoalModal({
  isOpen,
  onClose,
  tasks,
  onCreateGoal,
}: CreateGoalModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  const handleSubmit = useCallback(() => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onCreateGoal({
      title: trimmed,
      description: description.trim() || null,
      taskIds: selectedTaskIds.length > 0 ? selectedTaskIds : undefined,
    });
    setTitle("");
    setDescription("");
    setSelectedTaskIds([]);
    onClose();
  }, [title, description, selectedTaskIds, onCreateGoal, onClose]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New goal">
      <div className="space-y-4">
        <Input
          variant="session"
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) handleSubmit();
          }}
          placeholder="What do you want to achieve?"
          className="w-full text-sm"
        />

        <div>
          <label className="mb-1.5 block text-xs text-[var(--color-text-tertiary)]">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add more context..."
            rows={2}
            className="w-full resize-none rounded-md border border-[var(--color-border-default)] bg-white/[0.06] px-4 py-2.5 text-sm text-[var(--color-text-secondary)] placeholder-[var(--color-text-tertiary)] transition-colors focus:border-[var(--color-border-focus)] focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs text-[var(--color-text-tertiary)]">
            Tasks (optional)
          </label>
          <TaskPicker
            value={selectedTaskIds}
            onChange={setSelectedTaskIds}
            tasks={tasks}
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
            Create goal
          </Button>
        </div>
      </div>
    </Modal>
  );
}
