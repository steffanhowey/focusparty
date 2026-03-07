"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import type { Task } from "@/lib/types";
import { TaskListContent } from "./TaskListContent";
import { DurationPills } from "./DurationPills";

interface StartSessionModalProps {
  isOpen: boolean;
  activeTask: Task | null;
  activeTasks: Task[];
  completedTasks: Task[];
  onStartTask: (taskId: string) => void;
  onCompleteTask: (taskId: string) => void;
  onAddTask: (text: string) => void;
  onDeleteTask: (taskId: string) => void;
  onStartSprint: (durationMinutes: number) => void;
}

export function StartSessionModal({
  isOpen,
  activeTask,
  activeTasks,
  completedTasks,
  onStartTask,
  onCompleteTask,
  onAddTask,
  onDeleteTask,
  onStartSprint,
}: StartSessionModalProps) {
  const [mounted, setMounted] = useState(false);
  const [duration, setDuration] = useState(25);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);
  const previousActive = useRef<HTMLElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Focus management
  useEffect(() => {
    if (!isOpen) return;
    previousActive.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      previousActive.current?.focus();
    };
  }, [isOpen]);

  // Auto-focus first focusable element
  useEffect(() => {
    if (!isOpen || !mounted) return;
    const focusable = overlayRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.[0]?.focus();
  }, [isOpen, mounted]);

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

  const handleSubmit = () => {
    if (!activeTask) return;
    onStartSprint(duration);
  };

  if (!isOpen) return null;

  const content = (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="setup-modal-title"
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 40 }}
    >
      {/* Overlay — non-dismissible */}
      <div
        className="absolute inset-0 bg-[var(--color-navy-700)]/60 backdrop-blur-[8px]"
        aria-hidden
      />

      {/* Modal content */}
      <div
        className="relative w-full max-w-[480px] overflow-visible rounded-[var(--radius-lg)] border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="setup-modal-title"
          className="mb-6 text-2xl font-bold text-white"
          style={{ fontFamily: "var(--font-montserrat), sans-serif" }}
        >
          Ready to focus?
        </h2>

        {/* Task selector */}
        <div className="space-y-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
              What are you working on?
            </label>
            <div ref={dropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen((o) => !o)}
                className="flex w-full items-center justify-between rounded-full border border-[var(--color-border-default)] bg-white/[0.06] px-5 py-3 text-left transition-[border-color] hover:border-[var(--color-border-focus)]"
              >
                <span
                  className={`truncate text-sm ${
                    activeTask ? "text-white" : "text-[var(--color-text-tertiary)]"
                  }`}
                >
                  {activeTask ? activeTask.text : "Select to create a task"}
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
                    zIndex: 50,
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
            onClick={handleSubmit}
            disabled={!activeTask}
            className="mt-2 h-12 w-full rounded-full bg-[var(--color-accent-primary)] font-semibold text-white transition-all duration-150 hover:bg-[var(--color-purple-800)] hover:shadow-[var(--shadow-glow-purple)] disabled:opacity-50"
            style={{ fontFamily: "var(--font-montserrat), sans-serif" }}
          >
            Start sprint
          </button>
        </div>
      </div>
    </div>
  );

  return mounted && typeof document !== "undefined"
    ? createPortal(content, document.body)
    : null;
}
