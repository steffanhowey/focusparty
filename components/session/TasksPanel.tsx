"use client";

import { useState, useRef, useEffect, useCallback, useMemo, memo } from "react";
import { Plus, X, ChevronRight, Check } from "lucide-react";
import type { Task } from "@/lib/types";

interface TasksPanelProps {
  activeTask: Task | null;
  activeTasks: Task[];
  completedTasks: Task[];
  onStartTask: (taskId: string) => void;
  onCompleteTask: (taskId: string) => void;
  onAddTask: (text: string) => void;
  onDeleteTask: (taskId: string) => void;
  onEditTask: (taskId: string, newText: string) => void;
}

export const TasksPanel = memo(function TasksPanel({
  activeTask,
  activeTasks,
  completedTasks,
  onStartTask,
  onCompleteTask,
  onAddTask,
  onDeleteTask,
  onEditTask,
}: TasksPanelProps) {
  const [newTaskText, setNewTaskText] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [showAddInput, setShowAddInput] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editOriginal, setEditOriginal] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const otherTasks = useMemo(
    () => activeTasks.filter((t) => t.id !== activeTask?.id),
    [activeTasks, activeTask]
  );

  // Focus add input when revealed
  useEffect(() => {
    if (showAddInput) {
      const id = setTimeout(() => addInputRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [showAddInput]);

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingId) {
      const id = setTimeout(() => {
        editInputRef.current?.focus();
        editInputRef.current?.select();
      }, 50);
      return () => clearTimeout(id);
    }
  }, [editingId]);

  const handleAddTask = useCallback(() => {
    const trimmed = newTaskText.trim();
    if (!trimmed) return;
    onAddTask(trimmed);
    setNewTaskText("");
    setShowAddInput(false);
  }, [newTaskText, onAddTask]);

  const handleDeleteTask = useCallback(
    (e: React.MouseEvent, taskId: string) => {
      e.stopPropagation();
      onDeleteTask(taskId);
    },
    [onDeleteTask]
  );

  const startEditing = useCallback((task: Task) => {
    setEditingId(task.id);
    setEditText(task.text);
    setEditOriginal(task.text);
  }, []);

  const commitEdit = useCallback(() => {
    if (!editingId) return;
    const trimmed = editText.trim();
    if (trimmed && trimmed !== editOriginal) {
      onEditTask(editingId, trimmed);
    }
    setEditingId(null);
    setEditText("");
    setEditOriginal("");
  }, [editingId, editText, editOriginal, onEditTask]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditText("");
    setEditOriginal("");
  }, []);

  const hasTasks = activeTasks.length > 0 || completedTasks.length > 0;

  const renderTaskText = (task: Task, className: string) => {
    if (editingId === task.id) {
      return (
        <input
          ref={editInputRef}
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitEdit();
            }
            if (e.key === "Escape") cancelEdit();
          }}
          onBlur={commitEdit}
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none"
        />
      );
    }
    return (
      <span
        className={`min-w-0 flex-1 cursor-text truncate ${className}`}
        onClick={() => startEditing(task)}
      >
        {task.text}
      </span>
    );
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden px-4 py-3" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>
      {/* Task lists */}
      <div className="-ml-2 flex-1 overflow-y-auto pl-2">
        {/* In Progress task */}
        {activeTask && (
          <div className="mb-2 ml-2 rounded-lg bg-white/[0.04] border border-[var(--color-border-subtle)] p-2">
          <p className="px-2 pt-0.5 pb-0.5 text-xs text-[var(--color-text-tertiary)]">Current task</p>
          <div className="group relative flex w-full items-center rounded-lg px-2 py-1.5">
            <button
              type="button"
              onClick={() => onDeleteTask(activeTask.id)}
              className="absolute left-[-6px] top-1/2 -translate-y-1/2 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
              aria-label={`Delete ${activeTask.text}`}
            >
              <X size={12} strokeWidth={2} className="text-[var(--color-text-tertiary)]" />
            </button>
            {renderTaskText(activeTask, "text-sm font-medium text-white")}
            <button
              type="button"
              onClick={() => onCompleteTask(activeTask.id)}
              className="flex shrink-0 items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90"
            >
              <Check size={12} strokeWidth={2.5} />
              Done
            </button>
          </div>
          </div>
        )}

        {!hasTasks && !showAddInput && (
          <p className="px-4 py-6 text-center text-xs text-[var(--color-text-tertiary)]">
            No tasks yet
          </p>
        )}

        {/* Other available tasks */}
        {otherTasks.length > 0 && (
          <div>
            <p className="px-4 pt-1 pb-0.5 text-xs text-[var(--color-text-tertiary)]">Tasks</p>
            {otherTasks.map((task) => (
              <div
                key={task.id}
                className="group relative flex w-full items-center rounded-lg px-4 py-2 text-left"
              >
                <button
                  type="button"
                  onClick={(e) => handleDeleteTask(e, task.id)}
                  className="absolute left-[-6px] top-1/2 -translate-y-1/2 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label={`Delete ${task.text}`}
                >
                  <X size={12} strokeWidth={2} className="text-[var(--color-text-tertiary)]" />
                </button>
                {renderTaskText(task, "text-sm text-[var(--color-text-secondary)]")}
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
        )}

        {/* Add task: toggle button or inline input */}
        {showAddInput ? (
          <div className="mt-1 ml-2 flex items-center gap-2 rounded-full border border-[var(--color-border-subtle)] bg-white/5 px-4 py-2">
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
              placeholder="Task name..."
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
        ) : (
          <button
            type="button"
            onClick={() => setShowAddInput(true)}
            className="mt-1 flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-secondary)]"
          >
            <Plus size={12} strokeWidth={2} />
            Add task
          </button>
        )}

        {/* Completed section */}
        {completedTasks.length > 0 && (
          <div className="mt-1 border-t border-[var(--color-border-subtle)] pt-1">
            <button
              type="button"
              onClick={() => setShowCompleted((s) => !s)}
              className="flex items-center gap-1 rounded-lg px-4 py-1.5 text-xs text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-secondary)]"
            >
              Completed ({completedTasks.length})
              <ChevronRight
                size={12}
                strokeWidth={2}
                className={`transition-transform duration-200 ${showCompleted ? "rotate-90" : ""}`}
              />
            </button>

            {showCompleted && (
              <div>
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
      </div>
    </div>
  );
});
