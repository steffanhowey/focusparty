"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, X, Check, CheckCircle, ChevronRight } from "lucide-react";
import type { Task } from "@/lib/types";

interface TasksPanelProps {
  activeTask: Task | null;
  activeTasks: Task[];
  completedTasks: Task[];
  onSelectTask: (taskId: string) => void;
  onAddTask: (text: string) => Task;
  onCompleteTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
}

export function TasksPanel({
  activeTask,
  activeTasks,
  completedTasks,
  onSelectTask,
  onAddTask,
  onCompleteTask,
  onDeleteTask,
}: TasksPanelProps) {
  const [newTaskText, setNewTaskText] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(id);
  }, []);

  const handleAddTask = useCallback(() => {
    const trimmed = newTaskText.trim();
    if (!trimmed) return;
    const task = onAddTask(trimmed);
    onSelectTask(task.id);
    setNewTaskText("");
  }, [newTaskText, onAddTask, onSelectTask]);

  const handleCompleteTask = useCallback(
    (e: React.MouseEvent, taskId: string) => {
      e.stopPropagation();
      onCompleteTask(taskId);
    },
    [onCompleteTask]
  );

  const handleDeleteTask = useCallback(
    (e: React.MouseEvent, taskId: string) => {
      e.stopPropagation();
      onDeleteTask(taskId);
    },
    [onDeleteTask]
  );

  const hasTasks = activeTasks.length > 0 || completedTasks.length > 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden px-4 py-3">
      {/* Add task input */}
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-[var(--color-border-subtle)] bg-white/5 px-3 py-2">
        <input
          ref={inputRef}
          type="text"
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAddTask();
            }
          }}
          placeholder="Add a task..."
          className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-[var(--color-text-tertiary)] outline-none"
        />
        <button
          type="button"
          onClick={handleAddTask}
          disabled={!newTaskText.trim()}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--color-accent-primary)] text-white transition-opacity disabled:opacity-30"
          aria-label="Add task"
        >
          <Plus size={14} strokeWidth={2.5} />
        </button>
      </div>

      {/* Task lists */}
      <div className="flex-1 overflow-y-auto">
        {!hasTasks && (
          <p className="px-2 py-6 text-center text-xs text-[var(--color-text-tertiary)]">
            No tasks yet — add one above
          </p>
        )}

        {/* Active tasks */}
        {activeTasks.length > 0 && (
          <div>
            {activeTasks.map((task) => {
              const isSelected = activeTask?.id === task.id;
              return (
                <div
                  key={task.id}
                  onClick={() => onSelectTask(task.id)}
                  className="group flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.06]"
                  role="option"
                  aria-selected={isSelected}
                >
                  {/* Selection indicator */}
                  <div
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                      isSelected
                        ? "border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]"
                        : "border-[var(--color-border-default)]"
                    }`}
                  >
                    {isSelected && (
                      <div className="h-1.5 w-1.5 rounded-full bg-white" />
                    )}
                  </div>

                  {/* Task text */}
                  <span className="min-w-0 flex-1 truncate text-sm text-[var(--color-text-secondary)]">
                    {task.text}
                  </span>

                  {/* Complete button */}
                  <button
                    type="button"
                    onClick={(e) => handleCompleteTask(e, task.id)}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:bg-white/10 group-hover:opacity-100"
                    aria-label={`Complete ${task.text}`}
                  >
                    <CheckCircle size={13} strokeWidth={2} className="text-[var(--color-text-tertiary)]" />
                  </button>

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={(e) => handleDeleteTask(e, task.id)}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:bg-white/10 group-hover:opacity-100"
                    aria-label={`Delete ${task.text}`}
                  >
                    <X size={12} strokeWidth={2} className="text-[var(--color-text-tertiary)]" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Completed section */}
        {completedTasks.length > 0 && (
          <div className="mt-1 border-t border-[var(--color-border-subtle)] pt-1">
            <button
              type="button"
              onClick={() => setShowCompleted((s) => !s)}
              className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-secondary)]"
            >
              <ChevronRight
                size={12}
                strokeWidth={2}
                className={`transition-transform duration-200 ${showCompleted ? "rotate-90" : ""}`}
              />
              Completed ({completedTasks.length})
            </button>

            {showCompleted && (
              <div>
                {completedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left"
                  >
                    <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/10">
                      <Check size={10} strokeWidth={3} className="text-[var(--color-text-tertiary)]" />
                    </div>
                    <span className="min-w-0 flex-1 truncate text-xs text-[var(--color-text-tertiary)] line-through">
                      {task.text}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
