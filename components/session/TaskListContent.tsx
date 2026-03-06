"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Plus, X, Check, ChevronDown } from "lucide-react";
import type { Task } from "@/lib/types";

interface TaskListContentProps {
  activeTask: Task | null;
  activeTasks: Task[];
  completedTasks: Task[];
  onStartTask: (taskId: string) => void;
  onCompleteTask: (taskId: string) => void;
  onAddTask: (text: string) => void;
  onDeleteTask: (taskId: string) => void;
}

/**
 * Shared task list content used inside dropdown panels (GoalCard, StartSessionModal).
 * Renders add-input, current task, other tasks with Start buttons, and collapsible completed section.
 * Owns its own local state (input text, completed toggle) and auto-focuses on mount.
 */
export function TaskListContent({
  activeTask,
  activeTasks,
  completedTasks,
  onStartTask,
  onCompleteTask,
  onAddTask,
  onDeleteTask,
}: TaskListContentProps) {
  const [newTaskText, setNewTaskText] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);

  const otherTasks = useMemo(
    () => activeTasks.filter((t) => t.id !== activeTask?.id),
    [activeTasks, activeTask]
  );

  const hasTasks = activeTasks.length > 0 || completedTasks.length > 0;

  // Auto-focus add input on mount
  useEffect(() => {
    const id = setTimeout(() => addInputRef.current?.focus(), 100);
    return () => clearTimeout(id);
  }, []);

  const handleAddTask = useCallback(() => {
    const trimmed = newTaskText.trim();
    if (!trimmed) return;
    onAddTask(trimmed);
    setNewTaskText("");
  }, [newTaskText, onAddTask]);

  const handleDeleteTask = useCallback(
    (e: React.MouseEvent, taskId: string) => {
      e.stopPropagation();
      onDeleteTask(taskId);
    },
    [onDeleteTask]
  );

  return (
    <>
      {/* Inline add input */}
      <div className="mb-2 flex items-center gap-2 rounded-full border border-[var(--color-border-subtle)] bg-white/5 px-4 py-2 transition-[border-color] focus-within:border-[var(--color-border-focus)]">
        <input
          ref={addInputRef}
          type="text"
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAddTask();
            }
          }}
          placeholder="Create a new task..."
          className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-[var(--color-text-tertiary)] outline-none"
        />
        <button
          type="button"
          onClick={handleAddTask}
          disabled={!newTaskText.trim()}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--color-accent-primary)] text-white transition-opacity disabled:opacity-30"
          aria-label="Create task"
        >
          <Plus size={14} strokeWidth={2.5} />
        </button>
      </div>

      {/* Empty state */}
      {!hasTasks && (
        <p className="px-4 py-3 text-center text-xs text-[var(--color-text-tertiary)]">
          No tasks yet — create one above
        </p>
      )}

      <div className="-ml-2 max-h-[200px] overflow-y-auto pl-2">
        {/* Current task */}
        {activeTask && (
          <>
            <p className="px-4 pt-1 pb-0.5 text-xs text-[var(--color-text-tertiary)]">Current task</p>
            <div className="group relative flex w-full items-center rounded-lg px-4 py-2">
              <button
                type="button"
                onClick={() => onDeleteTask(activeTask.id)}
                className="absolute left-[2px] top-1/2 -translate-y-1/2 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
                aria-label={`Delete ${activeTask.text}`}
              >
                <X size={12} strokeWidth={2} className="text-[var(--color-text-tertiary)]" />
              </button>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
                {activeTask.text}
              </span>
              <button
                type="button"
                onClick={() => onCompleteTask(activeTask.id)}
                className="flex shrink-0 items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90"
              >
                <Check size={12} strokeWidth={2.5} />
                Done
              </button>
            </div>
          </>
        )}

        {/* Divider */}
        {activeTask && otherTasks.length > 0 && (
          <div className="my-1 border-t border-[var(--color-border-subtle)]" />
        )}

        {/* Other tasks */}
        {otherTasks.length > 0 && (
          <p className="px-4 pt-1 pb-0.5 text-xs text-[var(--color-text-tertiary)]">Tasks</p>
        )}
        {otherTasks.map((task) => (
          <div
            key={task.id}
            className="group relative flex w-full items-center rounded-lg px-4 py-2 text-left"
          >
            <button
              type="button"
              onClick={(e) => handleDeleteTask(e, task.id)}
              className="absolute left-[2px] top-1/2 -translate-y-1/2 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
              aria-label={`Delete ${task.text}`}
            >
              <X size={12} strokeWidth={2} className="text-[var(--color-text-tertiary)]" />
            </button>
            <span className="min-w-0 flex-1 truncate text-sm text-[var(--color-text-secondary)]">
              {task.text}
            </span>
            <button
              type="button"
              onClick={() => onStartTask(task.id)}
              className="shrink-0 rounded-md bg-[var(--color-accent-primary)] px-2.5 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90"
            >
              Start
            </button>
          </div>
        ))}
      </div>

      {/* Completed section */}
      {completedTasks.length > 0 && (
        <div className="mt-1 border-t border-[var(--color-border-subtle)] pt-1">
          <button
            type="button"
            onClick={() => setShowCompleted((s) => !s)}
            className="flex items-center gap-1 rounded-lg px-4 py-1.5 text-xs text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-secondary)]"
          >
            Completed ({completedTasks.length})
            <ChevronDown
              size={12}
              strokeWidth={2}
              className={`transition-transform duration-200 ${showCompleted ? "" : "-rotate-90"}`}
            />
          </button>

          {showCompleted && (
            <div className="max-h-[120px] overflow-y-auto">
              {completedTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex w-full items-center gap-2.5 rounded-lg px-4 py-1.5 text-left"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-[var(--color-text-secondary)] line-through">
                    {task.text}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
