"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import type { Task } from "@/lib/types";
import { TaskListContent } from "./TaskListContent";
import { DurationPills } from "./DurationPills";

interface GoalCardProps {
  activeTask: Task | null;
  activeTasks: Task[];
  completedTasks: Task[];
  onStartTask: (taskId: string) => void;
  onCompleteTask: (taskId: string) => void;
  onAddTask: (text: string) => void;
  onDeleteTask: (taskId: string) => void;
  currentDurationMin: number;
  onChangeDuration: (durationMinutes: number) => void;
  onResetTimer: () => void;
}

export function GoalCard({
  activeTask,
  activeTasks,
  completedTasks,
  onStartTask,
  onCompleteTask,
  onAddTask,
  onDeleteTask,
  currentDurationMin,
  onChangeDuration,
  onResetTimer,
}: GoalCardProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click outside or Escape to close dropdown
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [dropdownOpen]);

  const handleStartTask = useCallback(
    (taskId: string) => {
      onStartTask(taskId);
      setDropdownOpen(false);
    },
    [onStartTask]
  );

  return (
    <div
      className="absolute top-0 left-1/2 w-[calc(100%-2rem)] max-w-[460px] -translate-x-1/2 rounded-2xl border border-[var(--color-border-default)] p-4 backdrop-blur-xl md:p-6"
      style={{
        background: "rgba(13,14,32,0.92)",
        zIndex: 20,
      }}
    >
      <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
        Switch task
      </p>

      {/* Task selector dropdown */}
      <div ref={dropdownRef} className="relative">
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
            {activeTask ? activeTask.text : "Select a task..."}
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
            className="absolute top-full left-0 mt-2 w-full rounded-xl border border-[var(--color-border-default)] p-2 shadow-2xl"
            style={{
              background: "rgba(13,14,32,0.95)",
              backdropFilter: "blur(20px)",
              zIndex: 30,
            }}
          >
            <TaskListContent
              activeTask={activeTask}
              activeTasks={activeTasks}
              completedTasks={completedTasks}
              onStartTask={handleStartTask}
              onCompleteTask={onCompleteTask}
              onAddTask={onAddTask}
              onDeleteTask={onDeleteTask}
            />
          </div>
        )}
      </div>

      {/* Timer controls */}
      <div className="mt-4 flex items-center gap-2">
        <DurationPills value={currentDurationMin} onChange={onChangeDuration} />
        <button
          type="button"
          onClick={onResetTimer}
          className="ml-auto flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs text-[var(--color-text-tertiary)] transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Reset timer"
        >
          <RotateCcw size={12} strokeWidth={2} />
          Reset
        </button>
      </div>
    </div>
  );
}
