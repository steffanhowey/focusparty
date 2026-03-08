"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDown, ChevronRight, Plus, Check } from "lucide-react";
import type { Task } from "@/lib/types";
import { DurationPills } from "./DurationPills";

interface SetupScreenProps {
  activeTask: Task | null;
  activeTasks: Task[];
  completedTasks: Task[];
  onStartTask: (taskId: string) => void;
  onCompleteTask: (taskId: string) => void;
  onAddTask: (text: string) => void;
  onDeleteTask: (taskId: string) => void;
  onStartSprint: (durationMinutes: number) => void;
}

const CARD_STYLE: React.CSSProperties = {
  background: "rgba(13,14,32,0.95)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  boxShadow:
    "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)",
  "--color-bg-elevated": "#11132b",
  "--color-text-primary": "#ffffff",
  "--color-text-secondary": "#c3c4ca",
  "--color-text-tertiary": "#888995",
  "--color-text-on-accent": "#ffffff",
  "--color-border-default": "rgba(255, 255, 255, 0.08)",
  "--color-border-focus": "#7c5cfc",
  "--color-bg-hover": "rgba(255, 255, 255, 0.08)",
} as React.CSSProperties;

export function SetupScreen({
  activeTask,
  activeTasks,
  completedTasks,
  onStartTask,
  onCompleteTask,
  onAddTask,
  onDeleteTask,
  onStartSprint,
}: SetupScreenProps) {
  const [taskPickerOpen, setTaskPickerOpen] = useState(!activeTask);
  const [duration, setDuration] = useState(25);
  const [showAddInput, setShowAddInput] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const prevTaskIdRef = useRef<string | null>(activeTask?.id ?? null);

  // Auto-close picker when a task is selected
  useEffect(() => {
    const currentId = activeTask?.id ?? null;
    if (currentId && currentId !== prevTaskIdRef.current) {
      setTaskPickerOpen(false);
    }
    prevTaskIdRef.current = currentId;
  }, [activeTask?.id]);

  // Close picker on click outside
  useEffect(() => {
    if (!taskPickerOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setTaskPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [taskPickerOpen]);

  // Focus add input when revealed
  useEffect(() => {
    if (showAddInput) {
      const id = setTimeout(() => addInputRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [showAddInput]);

  const handleAddTask = useCallback(() => {
    const trimmed = newTaskText.trim();
    if (!trimmed) return;
    onAddTask(trimmed);
    setNewTaskText("");
    setShowAddInput(false);
  }, [newTaskText, onAddTask]);

  const handleSelectTask = useCallback(
    (taskId: string) => {
      onStartTask(taskId);
      setTaskPickerOpen(false);
    },
    [onStartTask]
  );

  const hasTasks = activeTasks.length > 0 || completedTasks.length > 0;

  return (
    <div className="relative z-10 flex flex-1 items-center justify-center p-4">
      <div
        className="animate-fp-setup-enter w-full max-w-[480px] overflow-visible rounded-[var(--radius-lg)] border border-white/[0.08] p-8 shadow-xl"
        style={CARD_STYLE}
      >
        <h2
          className="mb-6 text-2xl font-bold text-[var(--color-text-primary)]"
          style={{ fontFamily: "var(--font-montserrat), sans-serif" }}
        >
          Ready to focus?
        </h2>

        <div className="space-y-5">
          {/* Task selector — inline dropdown */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
              What are you working on?
            </label>
            <div ref={dropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setTaskPickerOpen((o) => !o)}
                className="flex w-full cursor-pointer items-center justify-between rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-5 py-3 text-left transition-[border-color] hover:border-[var(--color-border-focus)]"
              >
                <span
                  className={`truncate text-sm ${
                    activeTask ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-tertiary)]"
                  }`}
                >
                  {activeTask ? activeTask.text : "Select or create a task"}
                </span>
                <ChevronDown
                  size={16}
                  strokeWidth={2}
                  className={`shrink-0 text-[var(--color-text-tertiary)] transition-transform duration-200 ${
                    taskPickerOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Dropdown panel — matches TasksPanel design */}
              {taskPickerOpen && (
                <div
                  className="absolute top-full left-0 mt-2 w-full rounded-xl border border-[var(--color-border-default)] shadow-2xl"
                  style={{
                    background: "rgba(13,14,32,0.95)",
                    backdropFilter: "blur(20px)",
                    zIndex: 50,
                    textShadow: "0 1px 4px rgba(0,0,0,0.6)",
                  }}
                >
                  <div className="max-h-[280px] overflow-y-auto px-3 py-2">
                    {/* Active tasks */}
                    {activeTasks.map((task) => {
                      const isSelected = activeTask?.id === task.id;
                      return (
                        <div
                          key={task.id}
                          className={`group flex items-center gap-3 border-b border-[var(--color-border-subtle)] px-2 py-3 last:border-b-0 ${
                            isSelected ? "rounded-lg bg-white/[0.06]" : ""
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleSelectTask(task.id)}
                            className="min-w-0 flex-1 cursor-pointer break-words text-left text-sm leading-snug text-[var(--color-text-secondary)] transition-colors hover:text-white"
                          >
                            {task.text}
                          </button>
                          <div className="flex h-5 shrink-0 items-center">
                            <button
                              type="button"
                              onClick={() => onCompleteTask(task.id)}
                              className="flex h-[18px] w-[18px] items-center justify-center rounded-[4px] border border-[var(--color-border-default)] transition-colors hover:border-emerald-500 hover:bg-emerald-500/10"
                              aria-label={`Complete ${task.text}`}
                            >
                              <Check
                                size={11}
                                strokeWidth={2.5}
                                className="text-transparent transition-colors group-hover:text-transparent [*:hover>&]:text-emerald-400"
                              />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Empty state */}
                    {!hasTasks && !showAddInput && (
                      <p className="px-2 py-6 text-center text-xs text-[var(--color-text-tertiary)]">
                        No tasks yet
                      </p>
                    )}

                    {/* Add task — toggle or inline input */}
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
                        className="flex items-center gap-2 px-2 py-3 text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-secondary)]"
                      >
                        <Plus size={14} strokeWidth={1.5} />
                        <span className="text-sm">Add task</span>
                      </button>
                    )}

                    {/* Completed section */}
                    {completedTasks.length > 0 && (
                      <div className="mt-1 border-t border-[var(--color-border-subtle)] pt-1">
                        <button
                          type="button"
                          onClick={() => setShowCompleted((s) => !s)}
                          className="flex items-center gap-2 px-2 py-3 text-sm text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-secondary)]"
                        >
                          Completed ({completedTasks.length})
                          <ChevronRight
                            size={14}
                            strokeWidth={1.5}
                            className={`transition-transform duration-200 ${
                              showCompleted ? "rotate-90" : ""
                            }`}
                          />
                        </button>

                        {showCompleted &&
                          completedTasks.map((task) => (
                            <div
                              key={task.id}
                              className="group flex items-center gap-3 border-b border-[var(--color-border-subtle)] px-2 py-3 last:border-b-0"
                            >
                              <span className="min-w-0 flex-1 break-words text-sm leading-snug text-[var(--color-text-tertiary)] line-through">
                                {task.text}
                              </span>
                              <div className="flex h-5 shrink-0 items-center">
                                <button
                                  type="button"
                                  onClick={() => onDeleteTask(task.id)}
                                  className="flex h-[18px] w-[18px] items-center justify-center rounded-[4px] bg-emerald-500 transition-colors hover:bg-emerald-400"
                                  aria-label={`Restore ${task.text}`}
                                >
                                  <Check size={11} strokeWidth={2.5} className="text-white" />
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
              Sprint duration
            </label>
            <DurationPills value={duration} onChange={setDuration} />
          </div>

          {/* Start button */}
          <button
            type="button"
            onClick={() => onStartSprint(duration)}
            disabled={!activeTask}
            className="mt-2 h-12 w-full cursor-pointer rounded-full bg-[var(--color-accent-primary)] font-semibold text-[var(--color-text-on-accent)] transition-all duration-150 hover:bg-[var(--color-accent-secondary)] hover:shadow-[var(--shadow-glow-purple)] disabled:cursor-not-allowed disabled:opacity-40"
            style={{ fontFamily: "var(--font-montserrat), sans-serif" }}
          >
            Let's focus
          </button>
        </div>
      </div>
    </div>
  );
}
