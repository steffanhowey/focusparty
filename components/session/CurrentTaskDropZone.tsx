"use client";

import { useState, useCallback } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Check, Target } from "lucide-react";
import type { Task } from "@/lib/types";

export const CURRENT_TASK_ZONE_ID = "current-task-zone";

interface CurrentTaskDropZoneProps {
  activeTask: Task | null;
  onCompleteTask: (taskId: string) => void;
}

export function CurrentTaskDropZone({
  activeTask,
  onCompleteTask,
}: CurrentTaskDropZoneProps) {
  const { isOver, setNodeRef } = useDroppable({ id: CURRENT_TASK_ZONE_ID });
  const [celebrating, setCelebrating] = useState(false);

  const handleComplete = useCallback(() => {
    if (!activeTask) return;
    setCelebrating(true);
    setTimeout(() => {
      onCompleteTask(activeTask.id);
      setCelebrating(false);
    }, 500);
  }, [activeTask, onCompleteTask]);

  // Celebration state
  if (celebrating) {
    return (
      <div
        ref={setNodeRef}
        className="flex items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6"
      >
        <div className="animate-fp-celebrate flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500">
          <Check size={20} strokeWidth={3} className="text-white" />
        </div>
      </div>
    );
  }

  // Empty state — ghost card
  if (!activeTask) {
    return (
      <div
        ref={setNodeRef}
        className={`
          rounded-xl border-2 border-dashed transition-all duration-200
          ${
            isOver
              ? "border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10 scale-[1.02]"
              : "border-[var(--color-border-default)] bg-white/[0.02]"
          }
        `}
      >
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-5">
          <Target
            size={18}
            strokeWidth={1.5}
            className={`transition-colors duration-200 ${
              isOver ? "text-[var(--color-accent-primary)]" : "text-[var(--color-text-tertiary)]"
            }`}
          />
          <p
            className={`text-center text-xs transition-colors duration-200 ${
              isOver ? "text-[var(--color-text-secondary)]" : "text-[var(--color-text-tertiary)]"
            }`}
          >
            Drag a task here to focus on it
          </p>
        </div>
      </div>
    );
  }

  // Filled state — active task
  return (
    <div
      ref={setNodeRef}
      className="rounded-xl border border-[var(--color-border-default)] bg-white/[0.06] p-3"
      style={{
        boxShadow:
          "0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
        Current Task
      </p>
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 text-sm font-medium text-white">
          {activeTask.text}
        </span>
        <button
          type="button"
          onClick={handleComplete}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
        >
          <Check size={12} strokeWidth={2.5} />
          Done
        </button>
      </div>
    </div>
  );
}
