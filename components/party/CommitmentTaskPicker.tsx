"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { ChevronRight, ChevronDown, Target, Check, Play } from "lucide-react";
import type { GoalRecord, TaskRecord } from "@/lib/types";

interface CommitmentTaskPickerProps {
  goals: GoalRecord[];
  tasks: TaskRecord[];
  selectedTaskId: string | null;
  selectedGoalId: string | null;
  accentColor: string;
  onSelectTask: (taskId: string, taskTitle: string, goalId: string | null) => void;
  onSelectGoal: (goalId: string, goalTitle: string) => void;
  onClose: () => void;
  /** Render inline (no absolute positioning or background) for use inside a popover container */
  inline?: boolean;
}

export function CommitmentTaskPicker({
  goals,
  tasks,
  selectedTaskId,
  selectedGoalId,
  accentColor,
  onSelectTask,
  onSelectGoal,
  onClose,
  inline = false,
}: CommitmentTaskPickerProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (dropdownRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [onClose]);

  // Group tasks by goal
  const goalTaskMap = useMemo(() => {
    const map = new Map<string, TaskRecord[]>();
    for (const goal of goals) {
      map.set(goal.id, tasks.filter((t) => t.goal_id === goal.id));
    }
    return map;
  }, [goals, tasks]);

  const standaloneTasks = useMemo(
    () => tasks.filter((t) => !t.goal_id),
    [tasks]
  );

  const toggleExpanded = (goalId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(goalId)) next.delete(goalId);
      else next.add(goalId);
      return next;
    });
  };

  const handleGoalClick = (goal: GoalRecord) => {
    const goalTasks = goalTaskMap.get(goal.id) ?? [];
    if (goalTasks.length === 0) {
      // No tasks — select the goal itself
      onSelectGoal(goal.id, goal.title);
    } else {
      // Has tasks — toggle expand/collapse
      toggleExpanded(goal.id);
    }
  };

  const hasContent = goals.length > 0 || standaloneTasks.length > 0;
  if (!hasContent) return null;

  return (
    <div
      ref={dropdownRef}
      className={
        inline
          ? "max-h-56 overflow-y-auto py-1"
          : "absolute left-0 right-0 z-20 mx-5 mt-1.5 max-h-56 overflow-y-auto rounded-xl py-1 shadow-lg"
      }
      style={
        inline
          ? undefined
          : {
              background: "rgba(15,35,24,0.95)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,0.08)",
            }
      }
    >
      {/* Commitment groups */}
      {goals.map((goal) => {
        const goalTasks = goalTaskMap.get(goal.id) ?? [];
        const isExpanded = expandedIds.has(goal.id);
        const hasTasks = goalTasks.length > 0;
        const isGoalSelected = selectedGoalId === goal.id && !selectedTaskId;

        return (
          <div key={goal.id}>
            {/* Goal row */}
            <button
              type="button"
              onClick={() => handleGoalClick(goal)}
              className="group flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/[0.06]"
            >
              {/* Expand chevron or target icon */}
              {hasTasks ? (
                isExpanded ? (
                  <ChevronDown size={12} strokeWidth={2} className="shrink-0 text-white/30" />
                ) : (
                  <ChevronRight size={12} strokeWidth={2} className="shrink-0 text-white/30" />
                )
              ) : (
                <Target size={12} strokeWidth={1.5} className="shrink-0" style={{ color: isGoalSelected ? accentColor : "rgba(255,255,255,0.25)" }} />
              )}

              <span
                className="truncate text-xs font-semibold"
                style={{ color: isGoalSelected ? accentColor : "rgba(255,255,255,0.7)" }}
              >
                {goal.title}
              </span>

              {hasTasks ? (
                <span className="ml-auto shrink-0 text-2xs text-white/25">
                  {goalTasks.length} {goalTasks.length === 1 ? "task" : "tasks"}
                </span>
              ) : (
                <Play
                  size={12}
                  strokeWidth={2}
                  className={`ml-auto shrink-0 transition-colors ${isGoalSelected ? "fill-current" : "text-white/25 group-hover:text-white/50"}`}
                  style={isGoalSelected ? { color: accentColor } : undefined}
                />
              )}
            </button>

            {/* Expanded task list */}
            {hasTasks && isExpanded && (
              <div className="pb-1">
                {goalTasks.map((task) => {
                  const isSelected = selectedTaskId === task.id;
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => onSelectTask(task.id, task.title, goal.id)}
                      className="group flex w-full cursor-pointer items-center gap-2 py-1.5 pl-7 pr-3 text-left text-xs transition-colors hover:bg-white/[0.06]"
                      style={{ color: isSelected ? accentColor : "rgba(255,255,255,0.55)" }}
                    >
                      <span className="truncate">{task.title}</span>
                      <Play
                        size={12}
                        strokeWidth={2}
                        className={`ml-auto shrink-0 transition-colors ${isSelected ? "fill-current" : "text-white/25 group-hover:text-white/50"}`}
                        style={isSelected ? { color: accentColor } : undefined}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Standalone tasks */}
      {standaloneTasks.length > 0 && (
        <>
          {goals.length > 0 && (
            <div className="mx-2 my-1 h-px bg-white/[0.06]" />
          )}
          <div className="px-3 pt-1.5 pb-1 text-2xs font-semibold uppercase tracking-wider text-white/25">
            Tasks
          </div>
          {standaloneTasks.map((task) => {
            const isSelected = selectedTaskId === task.id;
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => onSelectTask(task.id, task.title, null)}
                className="group flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-white/[0.06]"
                style={{ color: isSelected ? accentColor : "rgba(255,255,255,0.55)" }}
              >
                <span className="truncate">{task.title}</span>
                <Play
                  size={12}
                  strokeWidth={2}
                  className={`ml-auto shrink-0 transition-colors ${isSelected ? "fill-current" : "text-white/25 group-hover:text-white/50"}`}
                  style={isSelected ? { color: accentColor } : undefined}
                />
              </button>
            );
          })}
        </>
      )}
    </div>
  );
}
