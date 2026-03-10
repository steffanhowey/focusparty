"use client";

import { useState, useMemo, memo, type MouseEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Grip,
  CheckCircle2,
  MoreHorizontal,
  Trash2,
  Archive,
} from "lucide-react";
import { computeGoalProgress } from "@/lib/goals";
import type { GoalRecord, TaskRecord } from "@/lib/types";

interface GoalBoardCardProps {
  goal: GoalRecord;
  tasks: TaskRecord[];
  onClick: () => void;
  onCompleteGoal: (goalId: string) => void;
  onArchiveGoal: (goalId: string) => void;
  onDeleteGoal: (goalId: string) => void;
  isDoneColumn?: boolean;
}

export const GoalBoardCard = memo(function GoalBoardCard({
  goal,
  tasks,
  onClick,
  onCompleteGoal,
  onArchiveGoal,
  onDeleteGoal,
  isDoneColumn,
}: GoalBoardCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const progress = useMemo(() => computeGoalProgress(tasks), [tasks]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: goal.id,
    data: { type: "goal", goal },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const handleMenuClick = (e: MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
    setMenuOpen(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      aria-label={`Goal: ${goal.title}`}
      className="group w-full rounded-[var(--radius-sm)] border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-3 text-left transition-shadow hover:shadow-[var(--shadow-sm)] md:cursor-grab md:touch-none md:active:cursor-grabbing"
    >
      <div className="flex items-start gap-2">
        {/* Drag handle icon — desktop only */}
        <div
          className="hidden h-5 shrink-0 items-center justify-center text-[var(--color-text-tertiary)] md:flex"
          aria-hidden
        >
          <Grip size={14} strokeWidth={1.5} />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={`break-words text-sm leading-snug ${
              isDoneColumn
                ? "text-[var(--color-text-tertiary)] line-through"
                : "text-[var(--color-text-primary)]"
            }`}
          >
            {goal.title}
          </p>

          {/* Meta row: progress + menu */}
          <div className="mt-1.5 flex items-center gap-1.5">
            {progress.total > 0 && (
              <>
                <span className="text-xs text-[var(--color-text-tertiary)]">
                  {progress.completed}/{progress.total} tasks
                </span>
                {/* Inline progress bar */}
                <div className="h-1 w-16 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${progress.percent}%`,
                      background:
                        progress.percent === 100
                          ? "#5BC682"
                          : "var(--color-accent-primary)",
                    }}
                  />
                </div>
              </>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Menu — stop propagation so clicks don't trigger card onClick or drag */}
            {!isDoneColumn && (
              <div
                className="relative"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(!menuOpen);
                  }}
                  className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-[var(--color-text-tertiary)] opacity-0 transition-all group-hover:opacity-100 hover:bg-white/[0.08] hover:text-white"
                  aria-label="Goal options"
                >
                  <MoreHorizontal size={14} />
                </button>
                {menuOpen && (
                  <>
                    <button
                      type="button"
                      className="fixed inset-0 z-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                      }}
                      aria-label="Close menu"
                    />
                    <div
                      className="absolute right-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-xl py-1 shadow-xl"
                      style={{
                        background: "rgba(20,20,20,0.96)",
                        backdropFilter: "blur(16px)",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) =>
                          handleMenuClick(e, () => onCompleteGoal(goal.id))
                        }
                        className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-xs text-[var(--color-text-secondary)] transition-colors hover:bg-white/[0.08]"
                      >
                        <CheckCircle2 size={14} />
                        Mark complete
                      </button>
                      <button
                        type="button"
                        onClick={(e) =>
                          handleMenuClick(e, () => onArchiveGoal(goal.id))
                        }
                        className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-xs text-[var(--color-text-secondary)] transition-colors hover:bg-white/[0.08]"
                      >
                        <Archive size={14} />
                        Archive
                      </button>
                      <button
                        type="button"
                        onClick={(e) =>
                          handleMenuClick(e, () => onDeleteGoal(goal.id))
                        }
                        className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-xs text-red-400 transition-colors hover:bg-red-500/10"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
