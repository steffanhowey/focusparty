"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  pointerWithin,
  closestCenter,
  type CollisionDetection,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Plus, Folder } from "lucide-react";
import type { TaskRecord, TaskStatus } from "@/lib/types";
import { STATUS_COLUMNS, STATUS_CONFIG } from "@/lib/taskConstants";
import { useIsMobile } from "@/lib/useIsMobile";
import { KanbanColumn } from "./KanbanColumn";
import { LabelChip } from "./LabelChip";

/**
 * Custom collision detection for kanban: first check which column the pointer
 * is within (pointerWithin), prefer column droppables, then fall back to
 * closestCenter for item-level sorting within a column.
 */
const kanbanCollision: CollisionDetection = (args) => {
  // Check what the pointer is currently within
  const within = pointerWithin(args);

  // Prefer column droppables (the ones we can always drop on)
  const columnHit = within.find((c) =>
    String(c.id).startsWith("column-")
  );
  if (columnHit) {
    // Also check if pointer is within a specific task card inside that column
    const taskHit = within.find(
      (c) => !String(c.id).startsWith("column-")
    );
    return taskHit ? [taskHit, columnHit] : [columnHit];
  }

  // Fallback to closestCenter for edge cases (fast drags, etc.)
  return closestCenter(args);
};

interface KanbanBoardProps {
  tasks: TaskRecord[];
  onAddTask: (title: string, status?: TaskStatus) => void;
  onUpdateTask: (taskId: string, updates: Partial<Pick<TaskRecord, "status" | "position">>) => void;
  onReorderByStatus: (taskIds: string[], status: TaskStatus) => void;
  onTaskClick?: (task: TaskRecord) => void;
}

/* ─── Mobile: tab-based single-column view ─────────────────────────────── */

function MobileKanban({
  tasks,
  onAddTask,
  onTaskClick,
}: Pick<KanbanBoardProps, "tasks" | "onAddTask" | "onTaskClick">) {
  const [activeStatus, setActiveStatus] = useState<TaskStatus>("todo");
  const [showAddInput, setShowAddInput] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);

  const tasksByStatus = useMemo(() => {
    const map: Record<TaskStatus, TaskRecord[]> = {
      todo: [],
      in_progress: [],
      done: [],
    };
    tasks.forEach((t) => map[t.status]?.push(t));
    for (const col of STATUS_COLUMNS) {
      map[col].sort((a, b) => a.position - b.position);
    }
    return map;
  }, [tasks]);

  useEffect(() => {
    if (showAddInput) {
      const id = setTimeout(() => addInputRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [showAddInput]);

  const handleAdd = useCallback(() => {
    const trimmed = newTaskText.trim();
    if (!trimmed) return;
    onAddTask(trimmed, activeStatus);
    setNewTaskText("");
    setShowAddInput(false);
  }, [newTaskText, onAddTask, activeStatus]);

  const activeTasks = tasksByStatus[activeStatus];
  const isDone = activeStatus === "done";

  return (
    <div className="flex flex-1 flex-col">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-md bg-[var(--color-bg-secondary)] p-1">
        {STATUS_COLUMNS.map((status) => {
          const cfg = STATUS_CONFIG[status];
          const count = tasksByStatus[status].length;
          const isActive = status === activeStatus;
          return (
            <button
              key={status}
              type="button"
              onClick={() => setActiveStatus(status)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-sm py-2.5 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-[var(--color-bg-elevated)] shadow-sm"
                  : "text-[var(--color-text-tertiary)]"
              }`}
              style={isActive ? { color: cfg.color } : undefined}
            >
              {cfg.label}
              <span
                className={`text-2xs ${
                  isActive
                    ? "text-[var(--color-text-secondary)]"
                    : "text-[var(--color-text-tertiary)]"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Task list */}
      <div className="mt-3 flex flex-1 flex-col gap-2">
        {activeTasks.length === 0 && !showAddInput && (
          <p className="py-8 text-center text-sm text-[var(--color-text-tertiary)]">
            No tasks
          </p>
        )}

        {activeTasks.map((task) => (
          <button
            key={task.id}
            type="button"
            onClick={() => onTaskClick?.(task)}
            className="rounded-sm border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-3 text-left transition-shadow active:shadow-[var(--shadow-sm)]"
          >
            <p
              className={`break-words text-sm leading-snug ${
                isDone
                  ? "text-[var(--color-text-tertiary)] line-through"
                  : "text-[var(--color-text-primary)]"
              }`}
            >
              {task.title}
            </p>
            {(task.project || (task.labels && task.labels.length > 0)) && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {task.project && (
                  <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-tertiary)]">
                    <Folder size={11} strokeWidth={1.5} />
                    {task.project.name}
                  </span>
                )}
                {task.labels?.map((label) => (
                  <LabelChip key={label.id} label={label} />
                ))}
              </div>
            )}
          </button>
        ))}

        {/* Inline add */}
        {!isDone && (
          <>
            {showAddInput ? (
              <div className="flex items-center gap-2 px-2 py-3">
                <Plus
                  size={14}
                  strokeWidth={1.5}
                  className="shrink-0 text-[var(--color-text-tertiary)]"
                />
                <input
                  ref={addInputRef}
                  type="text"
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAdd();
                    }
                    if (e.key === "Escape") {
                      setShowAddInput(false);
                      setNewTaskText("");
                    }
                  }}
                  onBlur={() => {
                    if (!newTaskText.trim()) setShowAddInput(false);
                  }}
                  placeholder="New task..."
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
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-secondary)]"
              >
                <Plus size={14} strokeWidth={1.5} />
                Add task
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Desktop: 3-column drag-and-drop kanban ───────────────────────────── */

export function KanbanBoard({
  tasks,
  onAddTask,
  onUpdateTask,
  onReorderByStatus,
  onTaskClick,
}: KanbanBoardProps) {
  const isMobile = useIsMobile();
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const tasksByStatus = useMemo(() => {
    const map: Record<TaskStatus, TaskRecord[]> = {
      todo: [],
      in_progress: [],
      done: [],
    };
    tasks.forEach((t) => {
      map[t.status]?.push(t);
    });
    // Sort by position within each column
    for (const col of STATUS_COLUMNS) {
      map[col].sort((a, b) => a.position - b.position);
    }
    return map;
  }, [tasks]);

  const findTaskStatus = useCallback(
    (taskId: string): TaskStatus | null => {
      const task = tasks.find((t) => t.id === taskId);
      return task?.status ?? null;
    },
    [tasks]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDragActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setDragActiveId(null);
      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      // Determine target status
      let targetStatus: TaskStatus | null = null;

      if (overId.startsWith("column-")) {
        targetStatus = overId.replace("column-", "") as TaskStatus;
      } else {
        targetStatus = findTaskStatus(overId);
      }

      if (!targetStatus) return;

      const sourceStatus = findTaskStatus(activeId);
      if (!sourceStatus) return;

      // Build new order for the target column
      const targetTasks = [...tasksByStatus[targetStatus]];

      if (sourceStatus === targetStatus) {
        // Same column reorder
        const oldIdx = targetTasks.findIndex((t) => t.id === activeId);
        const overTask = targetTasks.findIndex((t) => t.id === overId);
        if (oldIdx === -1 || (overTask === -1 && !overId.startsWith("column-"))) return;

        const [removed] = targetTasks.splice(oldIdx, 1);
        const newIdx = overTask === -1 ? targetTasks.length : overTask;
        targetTasks.splice(newIdx, 0, removed);

        onReorderByStatus(
          targetTasks.map((t) => t.id),
          targetStatus
        );
      } else {
        // Cross-column move
        const task = tasks.find((t) => t.id === activeId);
        if (!task) return;

        // Insert at drop position
        const overIdx = overId.startsWith("column-")
          ? targetTasks.length
          : targetTasks.findIndex((t) => t.id === overId);
        const insertIdx = overIdx === -1 ? targetTasks.length : overIdx;

        onUpdateTask(activeId, { status: targetStatus, position: insertIdx });

        // Reorder remaining in target column
        const newOrder = [...targetTasks];
        newOrder.splice(insertIdx, 0, task);
        onReorderByStatus(
          newOrder.map((t) => t.id),
          targetStatus
        );
      }
    },
    [tasks, tasksByStatus, findTaskStatus, onUpdateTask, onReorderByStatus]
  );

  const handleDragCancel = useCallback(() => setDragActiveId(null), []);

  const handleAddTaskToColumn = useCallback(
    (title: string, status: TaskStatus) => {
      onAddTask(title, status);
    },
    [onAddTask]
  );

  const draggedTask = dragActiveId
    ? tasks.find((t) => t.id === dragActiveId) ?? null
    : null;

  if (isMobile) {
    return (
      <MobileKanban tasks={tasks} onAddTask={onAddTask} onTaskClick={onTaskClick} />
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={kanbanCollision}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2">
        {STATUS_COLUMNS.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={tasksByStatus[status]}
            onAddTask={handleAddTaskToColumn}
            onTaskClick={onTaskClick}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {draggedTask ? (
          <div className="w-[280px] rounded-sm border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-3 shadow-lg">
            <p className="text-sm text-[var(--color-text-primary)]">
              {draggedTask.title}
            </p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
