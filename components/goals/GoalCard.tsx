"use client";

import { useState, useMemo } from "react";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  MoreHorizontal,
  Trash2,
  Archive,
} from "lucide-react";
import { MenuItem } from "@/components/ui/MenuItem";
import { GoalTaskList } from "./GoalTaskList";
import { computeGoalProgress } from "@/lib/goals";
import type { GoalRecord, TaskRecord } from "@/lib/types";

interface GoalCardProps {
  goal: GoalRecord;
  tasks: TaskRecord[];
  expanded: boolean;
  onToggleExpand: () => void;
  onCompleteGoal: (goalId: string) => void;
  onArchiveGoal: (goalId: string) => void;
  onDeleteGoal: (goalId: string) => void;
  onAddTask: (goalId: string, title: string) => void;
  onCompleteTask: (taskId: string) => void;
  onUncompleteTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onEditTask: (taskId: string, newTitle: string) => void;
  onAIBreakdown: (goalId: string) => void;
  isBreakingDown?: boolean;
}

export function GoalCard({
  goal,
  tasks,
  expanded,
  onToggleExpand,
  onCompleteGoal,
  onArchiveGoal,
  onDeleteGoal,
  onAddTask,
  onCompleteTask,
  onUncompleteTask,
  onDeleteTask,
  onEditTask,
  onAIBreakdown,
  isBreakingDown,
}: GoalCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const progress = useMemo(() => computeGoalProgress(tasks), [tasks]);
  const ChevronIcon = expanded ? ChevronDown : ChevronRight;

  return (
    <div
      className="rounded-xl border border-[var(--color-border-default)] transition-colors hover:border-white/12"
      style={{ background: "rgba(255,255,255,0.03)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex shrink-0 cursor-pointer items-center justify-center text-[var(--color-text-tertiary)] transition-colors hover:text-white"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          <ChevronIcon size={16} strokeWidth={2} />
        </button>

        <button
          type="button"
          onClick={onToggleExpand}
          className="min-w-0 flex-1 cursor-pointer text-left"
        >
          <h3 className="truncate text-sm font-semibold text-white">
            {goal.title}
          </h3>
          {goal.description && !expanded && (
            <p className="mt-0.5 truncate text-xs text-[var(--color-text-tertiary)]">
              {goal.description}
            </p>
          )}
        </button>

        {/* Progress */}
        <div className="flex shrink-0 items-center gap-2.5">
          {progress.total > 0 && (
            <>
              <span className="text-xs text-[var(--color-text-tertiary)]">
                {progress.completed}/{progress.total}
              </span>
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
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

          {/* Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-[var(--color-text-tertiary)] transition-colors hover:bg-white/[0.08] hover:text-white"
              aria-label="Goal options"
            >
              <MoreHorizontal size={15} />
            </button>
            {menuOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close menu"
                />
                <div
                  className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl py-1 shadow-xl"
                  style={{
                    background: "rgba(20,20,20,0.96)",
                    backdropFilter: "blur(16px)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <MenuItem
                    icon={<CheckCircle2 size={14} />}
                    onClick={() => {
                      onCompleteGoal(goal.id);
                      setMenuOpen(false);
                    }}
                  >
                    Mark complete
                  </MenuItem>
                  <MenuItem
                    icon={<Archive size={14} />}
                    onClick={() => {
                      onArchiveGoal(goal.id);
                      setMenuOpen(false);
                    }}
                  >
                    Archive
                  </MenuItem>
                  <MenuItem
                    icon={<Trash2 size={14} />}
                    danger
                    onClick={() => {
                      onDeleteGoal(goal.id);
                      setMenuOpen(false);
                    }}
                  >
                    Delete
                  </MenuItem>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Expanded: description + task list */}
      {expanded && (
        <div className="border-t border-white/6 px-4 pb-3 pt-3">
          {goal.description && (
            <p className="mb-3 text-xs leading-relaxed text-[var(--color-text-tertiary)]">
              {goal.description}
            </p>
          )}
          <GoalTaskList
            tasks={tasks}
            goalId={goal.id}
            onAddTask={(title) => onAddTask(goal.id, title)}
            onCompleteTask={onCompleteTask}
            onUncompleteTask={onUncompleteTask}
            onDeleteTask={onDeleteTask}
            onEditTask={onEditTask}
            onAIBreakdown={() => onAIBreakdown(goal.id)}
            isBreakingDown={isBreakingDown}
          />
        </div>
      )}
    </div>
  );
}
