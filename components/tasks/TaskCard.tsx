"use client";

import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Grip, Folder } from "lucide-react";
import type { TaskRecord } from "@/lib/types";
import { LabelChip } from "./LabelChip";

interface TaskCardProps {
  task: TaskRecord;
  onClick?: (task: TaskRecord) => void;
}

export const TaskCard = memo(function TaskCard({
  task,
  onClick,
}: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { type: "task", task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const isDone = task.status === "done";

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick?.(task)}
      aria-label={`Task: ${task.title}`}
      className="group w-full rounded-sm border border-[var(--sg-shell-border)] bg-white p-3 text-left transition-shadow hover:shadow-sm md:cursor-grab md:touch-none md:active:cursor-grabbing"
    >
      <div className="flex items-start gap-2">
        {/* Drag handle icon — desktop only */}
        <div
          className="hidden h-5 shrink-0 items-center justify-center text-[var(--sg-shell-400)] md:flex"
          aria-hidden
        >
          <Grip size={14} strokeWidth={1.5} />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={`break-words text-sm leading-snug ${
              isDone
                ? "text-[var(--sg-shell-400)] line-through"
                : "text-[var(--sg-shell-900)]"
            }`}
          >
            {task.title}
          </p>

          {/* Meta row: project + labels */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {task.project && (
              <span
                className="inline-flex items-center gap-1 text-xs text-[var(--sg-shell-500)]"
              >
                <Folder size={11} strokeWidth={1.5} />
                {task.project.name}
              </span>
            )}
            {task.labels?.map((label) => (
              <LabelChip key={label.id} label={label} />
            ))}
          </div>
        </div>
      </div>
    </button>
  );
});
