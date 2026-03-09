"use client";

import { useState, useRef, useEffect, useCallback, memo } from "react";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import type { TaskRecord, TaskStatus } from "@/lib/types";
import { STATUS_CONFIG } from "@/lib/taskConstants";
import { TaskCard } from "./TaskCard";

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: TaskRecord[];
  onAddTask?: (title: string, status: TaskStatus) => void;
  onTaskClick?: (task: TaskRecord) => void;
}

export const KanbanColumn = memo(function KanbanColumn({
  status,
  tasks,
  onAddTask,
  onTaskClick,
}: KanbanColumnProps) {
  const cfg = STATUS_CONFIG[status];
  const isDone = status === "done";
  const [showAddInput, setShowAddInput] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);

  const { setNodeRef, isOver } = useDroppable({
    id: `column-${status}`,
    data: { type: "column", status },
  });

  useEffect(() => {
    if (showAddInput) {
      const id = setTimeout(() => addInputRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [showAddInput]);

  const handleAdd = useCallback(() => {
    const trimmed = newTaskText.trim();
    if (!trimmed) return;
    onAddTask?.(trimmed, status);
    setNewTaskText("");
    setShowAddInput(false);
  }, [newTaskText, onAddTask, status]);

  const taskIds = tasks.map((t) => t.id);

  return (
    <div className="flex min-w-0 flex-1 basis-0 flex-col rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-3">
      {/* Column header */}
      <div className="mb-3 flex items-center gap-2">
        <span
          className="text-sm font-medium"
          style={{ color: cfg.color }}
        >
          {cfg.label}
        </span>
        <span className="text-xs text-[var(--color-text-tertiary)]">
          {tasks.length}
        </span>
      </div>

      {/* Droppable area */}
      <div
        ref={setNodeRef}
        className={`flex min-h-[80px] flex-1 flex-col gap-2 rounded-lg transition-colors ${
          isOver ? "bg-[var(--color-bg-hover)]" : ""
        }`}
      >
        <SortableContext
          items={taskIds}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={onTaskClick}
            />
          ))}
        </SortableContext>

        {/* Inline add */}
        {!isDone && (
          <>
            {showAddInput ? (
              <div className="flex items-center gap-2 px-2 py-3">
                <Plus size={14} strokeWidth={1.5} className="shrink-0 text-[var(--color-text-tertiary)]" />
                <input
                  ref={addInputRef}
                  type="text"
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAdd();
                    }
                    if (e.key === "Escape") {
                      setShowAddInput(false);
                      setNewTaskText("");
                    }
                  }}
                  onBlur={() => {
                    if (!newTaskText.trim()) {
                      setShowAddInput(false);
                    }
                  }}
                  placeholder="New task..."
                  className="min-w-0 flex-1 bg-transparent text-sm text-[var(--color-text-secondary)] placeholder:text-[var(--color-text-tertiary)] outline-none"
                />
                {newTaskText.trim() && (
                  <span className="shrink-0 text-[11px] text-[var(--color-text-tertiary)]">
                    ↵
                  </span>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddInput(true)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-secondary)]"
              >
                <Plus size={14} strokeWidth={1.5} />
                Add task
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
});
