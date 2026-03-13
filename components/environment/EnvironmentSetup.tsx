"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Check, GitBranch, Loader2 } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { DurationPills } from "@/components/session/DurationPills";
import type { TaskRecord } from "@/lib/types";
import type { ExternalWorkItem } from "@/lib/integrations/types";

interface EnvironmentSetupProps {
  roomName: string;
  hostName: string;
  hostAvatarUrl: string;
  accentColor: string;
  defaultDuration: number;
  activeTask: TaskRecord | null;
  activeTasks: TaskRecord[];
  /** Unimported external items from connected integrations */
  externalItems?: ExternalWorkItem[];
  /** Import an external item as a local task, returns the new task ID */
  onImportExternalItem?: (item: ExternalWorkItem) => Promise<string | null>;
  /** Pre-filled goal from join config (freeform, no task required) */
  initialGoal?: string;
  onSelectTask: (taskId: string) => void;
  onAddTask: (text: string) => void;
  onStartSprint: (durationMinutes: number, freeformGoal?: string) => void;
}

/** Tiny inline provider icon (14px) */
function ProviderIcon({ provider }: { provider: string }) {
  if (provider === "github") {
    return (
      <svg width={14} height={14} viewBox="0 0 16 16" fill="currentColor" className="shrink-0 opacity-40">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
      </svg>
    );
  }
  // Generic fallback for future providers
  return <GitBranch size={14} className="shrink-0 opacity-40" />;
}

export function EnvironmentSetup({
  roomName,
  hostName,
  hostAvatarUrl,
  accentColor,
  defaultDuration,
  activeTask,
  activeTasks,
  externalItems,
  onImportExternalItem,
  initialGoal,
  onSelectTask,
  onAddTask,
  onStartSprint,
}: EnvironmentSetupProps) {
  const [duration, setDuration] = useState(defaultDuration);
  const [showTasks, setShowTasks] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const [importingId, setImportingId] = useState<string | null>(null);

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
          boxShadow: "var(--shadow-float)",
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
              className="mt-1.5 max-h-48 overflow-y-auto rounded-lg py-1 shadow-lg"
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
                  {task.linked_resource && (
                    <ProviderIcon provider={task.linked_resource.provider} />
                  )}
                  <span className="truncate">{task.title}</span>
                </button>
              ))}

              {/* External items (not yet imported) */}
              {externalItems && externalItems.length > 0 && (
                <>
                  {externalItems.map((item) => (
                    <button
                      key={item.externalId}
                      type="button"
                      disabled={importingId === item.externalId}
                      onClick={async () => {
                        if (!onImportExternalItem) return;
                        setImportingId(item.externalId);
                        const taskId = await onImportExternalItem(item);
                        setImportingId(null);
                        if (taskId) {
                          onSelectTask(taskId);
                          setShowTasks(false);
                        }
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-white/5 disabled:opacity-50"
                      style={{ color: "rgba(255,255,255,0.7)" }}
                    >
                      {importingId === item.externalId ? (
                        <Loader2 size={12} className="shrink-0 animate-spin opacity-50" />
                      ) : (
                        <ProviderIcon provider={item.provider} />
                      )}
                      <span className="truncate">{item.title}</span>
                    </button>
                  ))}
                </>
              )}

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
