"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDown, Plus, X, Check, ChevronRight, CircleCheckBig } from "lucide-react";
import type { Task } from "@/lib/types";

interface TaskDropdownProps {
  activeTask: Task | null;
  activeTasks: Task[];
  completedTasks: Task[];
  onSelectTask: (taskId: string) => void;
  onAddTask: (text: string) => Task;
  onCompleteTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
}

export function TaskDropdown({
  activeTask,
  activeTasks,
  completedTasks,
  onSelectTask,
  onAddTask,
  onCompleteTask,
  onDeleteTask,
}: TaskDropdownProps) {
  const [open, setOpen] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      const id = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(id);
    }
  }, [open]);

  const handleAddTask = useCallback(() => {
    const trimmed = newTaskText.trim();
    if (!trimmed) return;
    const task = onAddTask(trimmed);
    onSelectTask(task.id);
    setNewTaskText("");
    setOpen(false);
  }, [newTaskText, onAddTask, onSelectTask]);

  const handleSelectTask = useCallback(
    (taskId: string) => {
      onSelectTask(taskId);
      setOpen(false);
    },
    [onSelectTask]
  );

  const handleDeleteTask = useCallback(
    (e: React.MouseEvent, taskId: string) => {
      e.stopPropagation();
      onDeleteTask(taskId);
    },
    [onDeleteTask]
  );

  return (
    <div ref={containerRef} className="relative flex items-center">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 transition-colors hover:bg-white/10"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <CircleCheckBig
          size={15}
          strokeWidth={2}
          className="shrink-0 text-[var(--color-text-tertiary)]"
        />
        <span
          className={`max-w-[140px] truncate text-sm font-medium md:max-w-[260px] ${
            activeTask ? "text-white" : "text-[var(--color-text-tertiary)]"
          }`}
        >
          {activeTask ? activeTask.text : "Pick a task..."}
        </span>
        <ChevronDown
          size={14}
          strokeWidth={2}
          className={`text-[var(--color-text-tertiary)] transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute left-1/2 top-full mt-2 w-[calc(100vw-2rem)] max-w-[360px] -translate-x-1/2 rounded-xl border border-[var(--color-border-default)] p-2 shadow-2xl"
          style={{
            background: "rgba(13,14,32,0.95)",
            backdropFilter: "blur(20px)",
            zIndex: 25,
          }}
          role="listbox"
          aria-label="Tasks"
        >
          {/* Inline add input */}
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-[var(--color-border-subtle)] bg-white/5 px-3 py-2">
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

          {/* Active tasks */}
          {activeTasks.length === 0 && completedTasks.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-[var(--color-text-tertiary)]">
              No tasks yet — add one above
            </p>
          )}

          {activeTasks.length > 0 && (
            <div className="max-h-[240px] overflow-y-auto">
              {activeTasks.map((task) => {
                const isSelected = activeTask?.id === task.id;
                return (
                  <div
                    key={task.id}
                    onClick={() => handleSelectTask(task.id)}
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
                    {/* Delete */}
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
                <div className="max-h-[160px] overflow-y-auto">
                  {completedTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
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
      )}
    </div>
  );
}
