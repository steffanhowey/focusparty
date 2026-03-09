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
import { Plus, ChevronRight } from "lucide-react";
import type { TaskRecord } from "@/lib/types";
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
        className="flex flex-1 flex-col overflow-hidden px-4 py-3"
        style={{ textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}
      >
        {/* Sortable task list */}
        <div className="-ml-2 flex-1 overflow-y-auto pl-2">
          <SortableContext
            items={allIds}
            strategy={verticalListSortingStrategy}
          >
            {activeTasks.map((task) => (
              <SortableTaskRow
                key={task.id}
                task={task}
                onComplete={onCompleteTask}
                onEdit={onEditTask}
              />
            ))}

          {!hasTasks && !showAddInput && (
            <p className="px-4 py-6 text-center text-xs text-[var(--color-text-tertiary)]">
              No tasks yet
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
                placeholder="New task..."
                className="min-w-0 flex-1 bg-transparent text-sm text-[var(--color-text-secondary)] placeholder:text-[var(--color-text-tertiary)] outline-none"
              />
              {newTaskText.trim() && (
                <span className="shrink-0 text-[11px] text-[var(--color-text-tertiary)]">
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
              <span className="text-sm">Add task</span>
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
                Completed ({completedTasks.length})
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
            className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-3 py-2 shadow-lg"
            style={{
              boxShadow:
                "0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)",
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
