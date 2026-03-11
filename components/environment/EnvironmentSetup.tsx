"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Check } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { DurationPills } from "@/components/session/DurationPills";
import type { TaskRecord } from "@/lib/types";

interface EnvironmentSetupProps {
  roomName: string;
  hostName: string;
  hostAvatarUrl: string;
  accentColor: string;
  defaultDuration: number;
  activeTask: TaskRecord | null;
  activeTasks: TaskRecord[];
  /** Pre-filled goal from join config (freeform, no task required) */
  initialGoal?: string;
  onSelectTask: (taskId: string) => void;
  onAddTask: (text: string) => void;
  onStartSprint: (durationMinutes: number, freeformGoal?: string) => void;
}

export function EnvironmentSetup({
  roomName,
  hostName,
  hostAvatarUrl,
  accentColor,
  defaultDuration,
  activeTask,
  activeTasks,
  initialGoal,
  onSelectTask,
  onAddTask,
  onStartSprint,
}: EnvironmentSetupProps) {
  const [duration, setDuration] = useState(defaultDuration);
  const [showTasks, setShowTasks] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");

  const canStart = !!(activeTask || initialGoal);

  const handleAddTask = () => {
    const text = newTaskText.trim();
    if (!text) return;
    onAddTask(text);
    setNewTaskText("");
  };

  const handleStart = () => {
    if (!canStart) return;
    onStartSprint(duration, activeTask ? undefined : initialGoal);
  };

  return (
    <div className="relative z-20 flex flex-1 items-center justify-center">
      <div
        className="w-full max-w-md rounded-xl p-6"
        style={{
          background: "rgba(10,10,10,0.85)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow:
            "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        {/* Room header */}
        <div className="mb-5 flex items-center gap-2">
          <Image
            src={hostAvatarUrl}
            alt={hostName}
            width={28}
            height={28}
            className="rounded-full"
          />
          <div>
            <h2 className="text-sm font-semibold text-white">{roomName}</h2>
            <p className="text-xs text-white/50">{hostName} hosting</p>
          </div>
        </div>

        {/* Task selector */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-white/50">
            What will you focus on?
          </label>

          {/* Selected task or placeholder */}
          <button
            type="button"
            onClick={() => setShowTasks(!showTasks)}
            className="flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: activeTask || initialGoal ? "white" : "rgba(255,255,255,0.4)",
            }}
          >
            <span className="truncate">
              {activeTask?.title ?? initialGoal ?? "Select a task..."}
            </span>
            {showTasks ? (
              <ChevronUp size={16} className="shrink-0 text-white/40" />
            ) : (
              <ChevronDown size={16} className="shrink-0 text-white/40" />
            )}
          </button>

          {/* Task dropdown */}
          {showTasks && (
            <div
              className="mt-1.5 max-h-48 overflow-y-auto rounded-lg py-1 shadow-2xl"
              style={{
                background: "rgba(10,10,10,0.95)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {activeTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => {
                    onSelectTask(task.id);
                    setShowTasks(false);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-white/5"
                  style={{
                    color:
                      activeTask?.id === task.id
                        ? accentColor
                        : "rgba(255,255,255,0.7)",
                  }}
                >
                  {activeTask?.id === task.id && (
                    <Check size={12} className="shrink-0" />
                  )}
                  <span className="truncate">{task.title}</span>
                </button>
              ))}

              {/* Add task inline */}
              <div className="flex items-center gap-1.5 border-t border-white/8 px-3 py-2">
                <input
                  type="text"
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                  placeholder="Add a task..."
                  className="flex-1 bg-transparent text-xs text-white/70 placeholder-white/30 outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddTask}
                  disabled={!newTaskText.trim()}
                  className="cursor-pointer rounded p-0.5 text-white/40 transition hover:text-white/70 disabled:opacity-30"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Duration */}
        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-medium text-white/50">
            Sprint duration
          </label>
          <DurationPills value={duration} onChange={setDuration} />
        </div>

        {/* Start button */}
        <Button
          variant="cta"
          fullWidth
          onClick={handleStart}
          disabled={!canStart}
          style={{ background: accentColor }}
        >
          Let&apos;s focus
        </Button>
      </div>
    </div>
  );
}
