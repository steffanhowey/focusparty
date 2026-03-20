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
import { MenuItem } from "@/components/ui/MenuItem";
import { computeGoalProgress } from "@/lib/goals";
import type { GoalRecord, TaskRecord } from "@/lib/types";
import { BoardItemFrame } from "./BoardItemFrame";

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
      className="group md:cursor-grab md:touch-none md:active:cursor-grabbing"
    >
      <BoardItemFrame>
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
                isDoneColumn
                  ? "text-[var(--sg-shell-500)] line-through"
                  : "text-[var(--sg-shell-900)]"
              }`}
            >
              {goal.title}
            </p>

            {/* Meta row: progress + menu */}
            <div className="mt-1.5 flex items-center gap-1.5">
              {progress.total > 0 && (
                <>
                  <span className="text-xs text-[var(--sg-shell-500)]">
                    {progress.completed}/{progress.total} tasks
                  </span>
                  {/* Inline progress bar */}
                  <div className="h-1 w-16 overflow-hidden rounded-full bg-[var(--sg-shell-200)]">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${progress.percent}%`,
                        background:
                          progress.percent === 100
                            ? "var(--sg-forest-300)"
                            : "var(--sg-forest-500)",
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
                    className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-[var(--sg-shell-500)] opacity-0 transition-all group-hover:opacity-100 hover:bg-[var(--sg-shell-100)] hover:text-[var(--sg-shell-900)]"
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
                          background: "var(--sg-shell-white)",
                          backdropFilter: "blur(16px)",
                          border: "1px solid var(--sg-shell-border)",
                        }}
                      >
                        <MenuItem
                          icon={<CheckCircle2 size={14} />}
                          onClick={(e) =>
                            handleMenuClick(e, () => onCompleteGoal(goal.id))
                          }
                        >
                          Mark complete
                        </MenuItem>
                        <MenuItem
                          icon={<Archive size={14} />}
                          onClick={(e) =>
                            handleMenuClick(e, () => onArchiveGoal(goal.id))
                          }
                        >
                          Archive
                        </MenuItem>
                        <MenuItem
                          icon={<Trash2 size={14} />}
                          danger
                          onClick={(e) =>
                            handleMenuClick(e, () => onDeleteGoal(goal.id))
                          }
                        >
                          Delete
                        </MenuItem>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </BoardItemFrame>
    </div>
  );
});
