"use client";

import { useState, useRef, useEffect, useCallback, useMemo, memo } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus, ChevronRight, Target, Sparkles, Loader2 } from "lucide-react";
import type { TaskRecord, GoalRecord } from "@/lib/types";
import { computeGoalProgress } from "@/lib/goals";
import { SortableTaskRow } from "./SortableTaskRow";

interface TasksPanelProps {
  activeTasks: TaskRecord[];
  completedTasks: TaskRecord[];
  onCompleteTask: (taskId: string) => void;
  onUncompleteTask: (taskId: string) => void;
  onAddTask: (text: string) => void;
  onDeleteTask: (taskId: string) => void;
  onEditTask: (taskId: string, newText: string) => void;
  onReorderTasks: (activeId: string, overId: string) => void;
  // Goal context (optional)
  activeGoal?: GoalRecord | null;
  goalTasks?: TaskRecord[];
  onSetSprintGoal?: (taskId: string) => void;
  onAISuggest?: () => void;
  isAISuggesting?: boolean;
  // Active goal
  activeTaskId?: string | null;
  onActivateTask?: (taskId: string) => void;
}

export const TasksPanel = memo(function TasksPanel({
  activeTasks,
  completedTasks,
  onCompleteTask,
  onUncompleteTask,
  onAddTask,
  onDeleteTask,
  onEditTask,
  onReorderTasks,
  activeGoal,
  goalTasks,
  onSetSprintGoal,
  onAISuggest,
  isAISuggesting,
  activeTaskId,
  onActivateTask,
}: TasksPanelProps) {
  const [newTaskText, setNewTaskText] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [showAddInput, setShowAddInput] = useState(false);
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  const activeIds = useMemo(() => activeTasks.map((t) => t.id), [activeTasks]);
  const completedIds = useMemo(() => completedTasks.map((t) => t.id), [completedTasks]);
  const allIds = useMemo(() => [...activeIds, ...completedIds], [activeIds, completedIds]);

  // Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor)
  );

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

  // Drag handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDragActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setDragActiveId(null);

      if (!over || active.id === over.id) return;

      const dragId = active.id as string;
      const dropId = over.id as string;
      const dragIsCompleted = completedIds.includes(dragId);
      const dropIsActive = activeIds.includes(dropId);

      // Cross-list: completed → active
      if (dragIsCompleted && dropIsActive) {
        onUncompleteTask(dragId);
        // Reorder will place it at the drop position once it's in the active list
        setTimeout(() => onReorderTasks(dragId, dropId), 0);
        return;
      }

      // Same-list reorder
      onReorderTasks(dragId, dropId);
    },
    [onReorderTasks, onUncompleteTask, activeIds, completedIds]
  );

  const handleDragCancel = useCallback(() => {
    setDragActiveId(null);
  }, []);

  // Find the task being dragged for the overlay
  const draggedTask = dragActiveId
    ? activeTasks.find((t) => t.id === dragActiveId)
      ?? completedTasks.find((t) => t.id === dragActiveId)
      ?? null
    : null;

  const hasTasks = activeTasks.length > 0 || completedTasks.length > 0;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        className="flex flex-1 flex-col overflow-hidden py-1"
      >
        {/* Goal context header */}
        {activeGoal && goalTasks && (
          <div className="mb-2 rounded-lg border border-white/6 px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)" }}>
            <div className="flex items-center gap-2">
              <Target size={14} className="shrink-0 text-[var(--sg-forest-400)]" />
              <span className="min-w-0 flex-1 truncate text-xs font-semibold text-white">
                {activeGoal.title}
              </span>
              <span className="shrink-0 text-2xs text-[var(--color-text-tertiary)]">
                {computeGoalProgress(goalTasks).completed}/{computeGoalProgress(goalTasks).total}
              </span>
            </div>
            {/* Goal tasks with "Set as sprint goal" */}
            {goalTasks.filter((t) => t.status !== "done").length > 0 && (
              <div className="mt-2 space-y-0.5">
                {goalTasks
                  .filter((t) => t.status !== "done")
                  .map((task) => (
                    <div
                      key={task.id}
                      className="group flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-white/[0.04]"
                    >
                      <button
                        type="button"
                        onClick={() => onCompleteTask(task.id)}
                        className="flex h-3.5 w-3.5 shrink-0 cursor-pointer items-center justify-center rounded-xs border border-white/20 transition-colors hover:border-white/40"
                        aria-label="Complete"
                      />
                      <span className="min-w-0 flex-1 truncate text-2xs text-[var(--color-text-secondary)]">
                        {task.title}
                      </span>
                      {onSetSprintGoal && (
                        <button
                          type="button"
                          onClick={() => onSetSprintGoal(task.id)}
                          className="shrink-0 cursor-pointer rounded px-1.5 py-0.5 text-2xs font-medium text-[var(--sg-forest-400)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--sg-forest-400)]/10"
                        >
                          Sprint this
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            )}
            {/* AI suggest button */}
            {onAISuggest && (
              <button
                type="button"
                onClick={onAISuggest}
                disabled={isAISuggesting}
                className="mt-2 flex w-full cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1.5 text-2xs font-medium text-[var(--sg-forest-400)] transition-colors hover:bg-[var(--sg-forest-400)]/10 disabled:cursor-default disabled:opacity-50"
              >
                {isAISuggesting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {isAISuggesting ? "Suggesting..." : "What should I do next?"}
              </button>
            )}
          </div>
        )}

        {/* Sortable task list */}
        <div className="fp-shell-scroll -ml-2 flex-1 overflow-y-auto pl-2">
          <SortableContext
            items={allIds}
            strategy={verticalListSortingStrategy}
          >
            {activeTasks.map((task) => (
              <SortableTaskRow
                key={task.id}
                task={task}
                isActive={task.id === activeTaskId}
                onComplete={onCompleteTask}
                onEdit={onEditTask}
                onActivate={onActivateTask}
              />
            ))}

          {!hasTasks && !showAddInput && (
            <p className="px-4 py-6 text-center text-xs text-[var(--color-text-tertiary)]">
              No items yet
            </p>
          )}

          {/* Add task: toggle button or inline input */}
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
                placeholder="What's next?"
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
              <span className="text-sm">Add item</span>
            </button>
          )}

          {/* Completed section */}
          {completedTasks.length > 0 && (
            <div className="mt-1 border-t border-[var(--color-border-subtle)] pt-1">
              <button
                type="button"
                onClick={() => setShowCompleted((s) => !s)}
                className="flex items-center gap-2 px-2 py-3 text-sm text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-secondary)]"
              >
                Done ({completedTasks.length})
                <ChevronRight
                  size={14}
                  strokeWidth={1.5}
                  className={`transition-transform duration-200 ${
                    showCompleted ? "rotate-90" : ""
                  }`}
                />
              </button>

              {showCompleted &&
                completedTasks.map((task) => (
                  <SortableTaskRow
                    key={task.id}
                    task={task}
                    completed
                    onComplete={onUncompleteTask}
                    onEdit={onEditTask}
                  />
                ))}
            </div>
          )}
          </SortableContext>
        </div>
      </div>

      {/* Drag overlay — floating copy of task that follows cursor */}
      <DragOverlay dropAnimation={null}>
        {draggedTask ? (
          <div
            className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[var(--sg-forest-800)] px-3 py-2 shadow-lg"
            style={{
              boxShadow: "var(--shadow-float)",
            }}
          >
            <span className="text-sm font-medium text-white">
              {draggedTask.title}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
});
