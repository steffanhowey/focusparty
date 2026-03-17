"use client";

import { useState, useRef, useEffect, useCallback, memo } from "react";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import type { GoalRecord, TaskRecord } from "@/lib/types";
import { GOAL_STATUS_CONFIG } from "@/lib/goalConstants";
import { GoalBoardCard } from "./GoalBoardCard";

interface GoalColumnProps {
  status: "active" | "in_progress" | "completed";
  goals: GoalRecord[];
  tasksByGoal: Map<string | null, TaskRecord[]>;
  onGoalClick: (goalId: string) => void;
  onCompleteGoal: (goalId: string) => void;
  onArchiveGoal: (goalId: string) => void;
  onDeleteGoal: (goalId: string) => void;
  onCreateGoal?: (title: string) => void;
}

export const GoalColumn = memo(function GoalColumn({
  status,
  goals,
  tasksByGoal,
  onGoalClick,
  onCompleteGoal,
  onArchiveGoal,
  onDeleteGoal,
  onCreateGoal,
}: GoalColumnProps) {
  const cfg = GOAL_STATUS_CONFIG[status];
  const isDone = status === "completed";
  const [showAddInput, setShowAddInput] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);

  const { setNodeRef, isOver } = useDroppable({
    id: `goal-col-${status}`,
    data: { type: "column", status },
  });

  useEffect(() => {
    if (showAddInput) {
      const id = setTimeout(() => addInputRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [showAddInput]);

  const handleAdd = useCallback(() => {
    const trimmed = newGoalTitle.trim();
    if (!trimmed || !onCreateGoal) return;
    onCreateGoal(trimmed);
    setNewGoalTitle("");
    setShowAddInput(false);
  }, [newGoalTitle, onCreateGoal]);

  const goalIds = goals.map((g) => g.id);

  return (
    <div className="flex min-w-0 flex-1 basis-0 flex-col rounded-md bg-[var(--sg-shell-100)] p-3">
      {/* Column header */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-medium" style={{ color: cfg.color }}>
          {cfg.label}
        </span>
        <span className="text-xs text-[var(--sg-shell-500)]">
          {goals.length}
        </span>
      </div>

      {/* Droppable area */}
      <div
        ref={setNodeRef}
        className={`flex min-h-[80px] flex-1 flex-col gap-2.5 rounded-lg transition-colors ${
          isOver ? "bg-[var(--sg-shell-200)]" : ""
        }`}
      >
        <SortableContext
          items={goalIds}
          strategy={verticalListSortingStrategy}
        >
          {goals.map((goal) => (
            <GoalBoardCard
              key={goal.id}
              goal={goal}
              tasks={tasksByGoal.get(goal.id) ?? []}
              onClick={() => onGoalClick(goal.id)}
              onCompleteGoal={onCompleteGoal}
              onArchiveGoal={onArchiveGoal}
              onDeleteGoal={onDeleteGoal}
              isDoneColumn={isDone}
            />
          ))}
        </SortableContext>

        {/* Inline add goal */}
        {!isDone && onCreateGoal && (
          <>
            {showAddInput ? (
              <div className="flex items-center gap-2 px-2 py-2">
                <Plus
                  size={14}
                  strokeWidth={1.5}
                  className="shrink-0 text-[var(--sg-shell-500)]"
                />
                <input
                  ref={addInputRef}
                  type="text"
                  value={newGoalTitle}
                  onChange={(e) => setNewGoalTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAdd();
                    }
                    if (e.key === "Escape") {
                      setShowAddInput(false);
                      setNewGoalTitle("");
                    }
                  }}
                  onBlur={() => {
                    if (!newGoalTitle.trim()) setShowAddInput(false);
                  }}
                  placeholder="New goal..."
                  className="min-w-0 flex-1 bg-transparent text-sm text-[var(--sg-shell-600)] placeholder:text-[var(--sg-shell-400)] outline-none"
                />
                {newGoalTitle.trim() && (
                  <span className="shrink-0 text-2xs text-[var(--sg-shell-500)]">
                    ↵
                  </span>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddInput(true)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-[var(--sg-shell-500)] transition-colors hover:text-[var(--sg-shell-600)]"
              >
                <Plus size={14} strokeWidth={1.5} />
                New goal
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
});
