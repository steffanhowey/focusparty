"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Check, Plus, Trash2, Sparkles, Loader2 } from "lucide-react";
import type { TaskRecord } from "@/lib/types";

interface GoalTaskListProps {
  tasks: TaskRecord[];
  goalId: string;
  onAddTask: (title: string) => void;
  onCompleteTask: (taskId: string) => void;
  onUncompleteTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onEditTask: (taskId: string, newTitle: string) => void;
  onAIBreakdown?: () => void;
  isBreakingDown?: boolean;
}

export function GoalTaskList({
  tasks,
  goalId,
  onAddTask,
  onCompleteTask,
  onUncompleteTask,
  onDeleteTask,
  onEditTask,
  onAIBreakdown,
  isBreakingDown,
}: GoalTaskListProps) {
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const activeTasks = tasks.filter((t) => t.status !== "done");
  const completedTasks = tasks.filter((t) => t.status === "done");

  const handleAddTask = useCallback(() => {
    const trimmed = newTaskTitle.trim();
    if (!trimmed) return;
    onAddTask(trimmed);
    setNewTaskTitle("");
    inputRef.current?.focus();
  }, [newTaskTitle, onAddTask]);

  const handleStartEdit = useCallback((task: TaskRecord) => {
    setEditingId(task.id);
    setEditValue(task.title);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (editingId && editValue.trim()) {
      onEditTask(editingId, editValue.trim());
    }
    setEditingId(null);
    setEditValue("");
  }, [editingId, editValue, onEditTask]);

  return (
    <div className="space-y-1 pl-1">
      {/* Active tasks */}
      {activeTasks.map((task) => (
        <div
          key={task.id}
          className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.04]"
        >
          <button
            type="button"
            onClick={() => onCompleteTask(task.id)}
            className="flex h-4.5 w-4.5 shrink-0 cursor-pointer items-center justify-center rounded-xs border border-white/20 transition-colors hover:border-white/40 hover:bg-white/10"
            aria-label="Complete task"
          >
            <Check size={10} strokeWidth={2.5} className="opacity-0 group-hover:opacity-40" />
          </button>

          {editingId === task.id ? (
            <input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSaveEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveEdit();
                if (e.key === "Escape") { setEditingId(null); setEditValue(""); }
              }}
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none"
            />
          ) : (
            <span
              className="min-w-0 flex-1 cursor-text truncate text-sm text-[var(--color-text-secondary)]"
              onDoubleClick={() => handleStartEdit(task)}
            >
              {task.title}
            </span>
          )}

          {task.ai_generated && (
            <Sparkles size={12} className="shrink-0 text-[var(--color-accent-primary)]/50" />
          )}

          <button
            type="button"
            onClick={() => onDeleteTask(task.id)}
            className="shrink-0 cursor-pointer opacity-0 transition-opacity group-hover:opacity-100"
            aria-label="Delete task"
          >
            <Trash2 size={13} className="text-[var(--color-coral-700)]/70 hover:text-[var(--color-coral-700)]" />
          </button>
        </div>
      ))}

      {/* Completed tasks (collapsed if any) */}
      {completedTasks.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {completedTasks.map((task) => (
            <div
              key={task.id}
              className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.04]"
            >
              <button
                type="button"
                onClick={() => onUncompleteTask(task.id)}
                className="flex h-4.5 w-4.5 shrink-0 cursor-pointer items-center justify-center rounded-xs border border-white/20 bg-white/10"
                aria-label="Uncomplete task"
              >
                <Check size={10} strokeWidth={2.5} className="text-white/50" />
              </button>
              <span className="min-w-0 flex-1 truncate text-sm text-[var(--color-text-tertiary)] line-through">
                {task.title}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Add task inline */}
      <div className="flex items-center gap-2.5 px-2 py-1.5">
        <Plus size={14} className="shrink-0 text-white/20" />
        <input
          ref={inputRef}
          type="text"
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAddTask();
          }}
          placeholder="Add a task..."
          className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder-white/25 outline-none"
        />
      </div>

      {/* AI breakdown button */}
      {onAIBreakdown && (
        <button
          type="button"
          onClick={onAIBreakdown}
          disabled={isBreakingDown}
          className="mt-1 flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-[var(--color-accent-primary)] transition-colors hover:bg-[var(--color-accent-primary)]/10 disabled:cursor-default disabled:opacity-50"
        >
          {isBreakingDown ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Sparkles size={14} />
          )}
          {isBreakingDown ? "Breaking down..." : "Break down with AI"}
        </button>
      )}
    </div>
  );
}
