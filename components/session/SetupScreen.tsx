"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { TaskRecord, PresencePayload } from "@/lib/types";
import { LiveParticipantsStrip } from "@/components/party/LiveParticipantsStrip";
import { DurationPills } from "./DurationPills";

interface SetupScreenProps {
  activeTask: TaskRecord | null;
  activeTasks: TaskRecord[];
  completedTasks: TaskRecord[];
  onStartTask: (taskId: string) => void;
  onCompleteTask: (taskId: string) => void;
  onAddTask: (text: string) => void;
  onDeleteTask: (taskId: string) => void;
  onStartSprint: (durationMinutes: number) => void;
  roomName?: string | null;
  roomSubtitle?: string | null;
  hostAvatarUrl?: string | null;
  defaultDuration?: number;
  presenceParticipants?: PresencePayload[];
  focusingCount?: number;
  roomStateIcon?: string;
  roomStateLabel?: string;
  roomStateColor?: string;
  currentUserId?: string | null;
}

const CARD_STYLE: React.CSSProperties = {
  background: "rgba(15,35,24,0.95)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  boxShadow: "var(--shadow-float)",
  "--color-bg-elevated": "var(--sg-forest-800)",
  "--color-text-primary": "#ffffff",
  "--color-text-secondary": "rgba(255,255,255,0.7)",
  "--color-text-tertiary": "rgba(255,255,255,0.4)",
  "--color-text-on-accent": "#ffffff",
  "--color-border-default": "rgba(255, 255, 255, 0.08)",
  "--color-border-focus": "var(--sg-forest-400)",
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
  roomName,
  roomSubtitle,
  hostAvatarUrl,
  defaultDuration,
  presenceParticipants,
  focusingCount = 0,
  roomStateIcon,
  roomStateLabel,
  roomStateColor,
  currentUserId,
}: SetupScreenProps) {
  const router = useRouter();
  const [taskPickerOpen, setTaskPickerOpen] = useState(false);
  const [duration, setDuration] = useState(defaultDuration ?? 25);
  const [showAddInput, setShowAddInput] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
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
    <div className="relative z-10 flex flex-1 flex-col items-center justify-center p-4">
      {roomName && (
        <div className="mb-3 w-full max-w-[480px]">
          <Button
            variant="ghost"
            size="xs"
            leftIcon={<ArrowLeft size={14} />}
            onClick={() => router.push("/practice")}
          >
            Back to rooms
          </Button>
        </div>
      )}
      <div
        className="animate-fp-setup-enter w-full max-w-[480px] overflow-visible rounded-lg border border-white/[0.08] p-8 shadow-xl"
        style={CARD_STYLE}
      >
        {roomName && (
          <div className="mb-5">
            <h2
              className="text-xl font-bold text-[var(--color-text-primary)]"
            >
              {roomName}
            </h2>
            {roomSubtitle && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)]">
                {hostAvatarUrl && (
                  <img
                    src={hostAvatarUrl}
                    alt=""
                    width={20}
                    height={20}
                    className="rounded-full"
                  />
                )}
                {roomSubtitle}
              </p>
            )}
          </div>
        )}

        {/* Signals of life — only in room context */}
        {roomName && presenceParticipants && presenceParticipants.length > 0 && (
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: focusingCount > 0 ? "var(--color-green-700)" : "var(--color-amber-700)" }}
              />
              <span>
                {focusingCount > 0
                  ? `${focusingCount} focusing now`
                  : `${presenceParticipants.length} here now`}
              </span>
              {focusingCount > 0 && (
                <span className="text-[var(--color-text-tertiary)]">&middot; Sprint in progress</span>
              )}
              {roomStateIcon && roomStateLabel && (
                <span style={{ color: roomStateColor }}>
                  &middot; {roomStateIcon} {roomStateLabel}
                </span>
              )}
            </div>
            <LiveParticipantsStrip
              participants={presenceParticipants}
              currentUserId={currentUserId}
              size="sm"
              maxVisible={4}
            />
          </div>
        )}

        {!roomName && (
          <h2
            className="mb-6 text-2xl font-bold text-[var(--color-text-primary)]"
          >
            Ready to focus?
          </h2>
        )}

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
                className="flex w-full cursor-pointer items-center justify-between rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-5 py-3 text-left outline-none"
              >
                <span
                  className={`truncate text-sm ${
                    activeTask ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-tertiary)]"
                  }`}
                >
                  {activeTask ? activeTask.title : "Select or create a task"}
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
                  className="absolute top-full left-0 mt-2 w-full rounded-xl border border-[var(--color-border-default)]"
                  style={{
                    background: "rgba(15,35,24,0.95)",
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
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => handleSelectTask(task.id)}
                          className="flex w-full items-center gap-3 border-b border-[var(--color-border-subtle)] px-2 py-3 text-left last:border-b-0"
                        >
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                              isSelected
                                ? "border-[var(--color-border-focus)] bg-[var(--color-border-focus)]"
                                : "border-[var(--color-border-default)]"
                            }`}
                          >
                            {isSelected && (
                              <span className="h-1.5 w-1.5 rounded-full bg-white" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1 cursor-pointer break-words text-sm leading-snug text-[var(--color-text-secondary)] transition-colors hover:text-white">
                            {task.title}
                          </span>
                        </button>
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
                          <span className="shrink-0 text-2xs text-[var(--color-text-tertiary)]">
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
          <Button
            variant="cta"
            fullWidth
            onClick={() => onStartSprint(duration)}
            disabled={!activeTask}
            className="mt-2"
          >
            Let's focus
          </Button>
        </div>
      </div>
    </div>
  );
}
