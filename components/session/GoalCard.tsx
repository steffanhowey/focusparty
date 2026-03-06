"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, Plus, Check, X } from "lucide-react";
import type { CharacterId, Task } from "@/lib/types";
import { CHARACTERS } from "@/lib/constants";

const DURATIONS = [15, 25, 50, 75] as const;

interface GoalCardProps {
  character: CharacterId;
  activeTask: Task | null;
  activeTasks: Task[];
  completedTasks: Task[];
  onSelectTask: (taskId: string) => void;
  onAddTask: (text: string) => Task;
  onDeleteTask: (taskId: string) => void;
  onStartSprint: (durationMinutes: number) => void;
}

export function GoalCard({
  character,
  activeTask,
  activeTasks,
  completedTasks,
  onSelectTask,
  onAddTask,
  onDeleteTask,
  onStartSprint,
}: GoalCardProps) {
  const [duration, setDuration] = useState(25);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const c = CHARACTERS[character];

  const handleSubmit = () => {
    if (!activeTask) return;
    onStartSprint(duration);
  };

  // Click outside to close dropdown
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  // Escape to close
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDropdownOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [dropdownOpen]);

  // Focus add input when dropdown opens
  useEffect(() => {
    if (dropdownOpen) {
      const id = setTimeout(() => addInputRef.current?.focus(), 100);
      return () => clearTimeout(id);
    }
  }, [dropdownOpen]);

  const handleAddTask = useCallback(() => {
    const trimmed = newTaskText.trim();
    if (!trimmed) return;
    const task = onAddTask(trimmed);
    onSelectTask(task.id);
    setNewTaskText("");
    setDropdownOpen(false);
  }, [newTaskText, onAddTask, onSelectTask]);

  const handleSelectTask = useCallback(
    (taskId: string) => {
      onSelectTask(taskId);
      setDropdownOpen(false);
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

  const hasTasks = activeTasks.length > 0 || completedTasks.length > 0;

  return (
    <div
      className="absolute bottom-6 left-1/2 w-[calc(100%-2rem)] max-w-[460px] -translate-x-1/2 rounded-2xl border border-[var(--color-border-default)] p-4 backdrop-blur-xl md:p-6"
      style={{
        background: "rgba(13,14,32,0.92)",
        zIndex: 20,
      }}
    >
      <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
        <span style={{ color: c.primary }}>{c.name}:</span> What are we working
        on?
      </p>

      {/* Task selector dropdown */}
      <div ref={dropdownRef} className="relative mb-4">
        <button
          type="button"
          onClick={() => setDropdownOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-full border border-[var(--color-border-default)] bg-white/5 px-5 py-3 text-left transition-[border-color] hover:border-[var(--color-border-focus)]"
        >
          <span
            className={`truncate text-sm ${
              activeTask ? "text-white" : "text-[var(--color-text-tertiary)]"
            }`}
          >
            {activeTask ? activeTask.text : "Select or create a task..."}
          </span>
          <ChevronDown
            size={16}
            strokeWidth={2}
            className={`shrink-0 text-[var(--color-text-tertiary)] transition-transform duration-200 ${
              dropdownOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* Dropdown panel */}
        {dropdownOpen && (
          <div
            className="absolute bottom-full left-0 mb-2 w-full rounded-xl border border-[var(--color-border-default)] p-2 shadow-2xl"
            style={{
              background: "rgba(13,14,32,0.95)",
              backdropFilter: "blur(20px)",
              zIndex: 30,
            }}
          >
            {/* Inline add input */}
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-[var(--color-border-subtle)] bg-white/5 px-3 py-2 transition-[border-color] focus-within:border-[var(--color-border-focus)]">
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

            {/* Active tasks */}
            {!hasTasks && (
              <p className="px-2 py-3 text-center text-xs text-[var(--color-text-tertiary)]">
                No tasks yet — create one above
              </p>
            )}

            {activeTasks.length > 0 && (
              <div className="max-h-[200px] overflow-y-auto">
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
                      <span className="min-w-0 flex-1 truncate text-sm text-[var(--color-text-secondary)]">
                        {task.text}
                      </span>
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
                  <ChevronDown
                    size={12}
                    strokeWidth={2}
                    className={`transition-transform duration-200 ${showCompleted ? "" : "-rotate-90"}`}
                  />
                  Completed ({completedTasks.length})
                </button>

                {showCompleted && (
                  <div className="max-h-[120px] overflow-y-auto">
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
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDuration(d)}
              className="rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-150"
              style={{
                background: d === duration ? "var(--color-accent-primary)" : "transparent",
                color: d === duration ? "white" : "var(--color-text-tertiary)",
                border: d === duration ? "none" : "1px solid var(--color-border-default)",
              }}
            >
              {d}m
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!activeTask}
          className="rounded-full bg-[var(--color-accent-primary)] px-6 py-2.5 text-sm font-semibold text-white transition-opacity duration-150 disabled:opacity-50"
        >
          Start sprint
        </button>
      </div>
    </div>
  );
}
