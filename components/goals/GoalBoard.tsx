"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
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
import { Target, Plus } from "lucide-react";
import { useGoals } from "@/lib/useGoals";
import { useTasks } from "@/lib/useTasks";
import { useProjects } from "@/lib/useProjects";
import { useGoalProjects } from "@/lib/useGoalProjects";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { useIsMobile } from "@/lib/useIsMobile";
import { GOAL_COLUMNS, GOAL_STATUS_CONFIG } from "@/lib/goalConstants";
import { GoalColumn } from "./GoalColumn";
import { GoalBoardCard } from "./GoalBoardCard";
import { CreateGoalModal } from "./CreateGoalModal";
import { GoalDetailModal } from "./GoalDetailModal";
import type { GoalRecord, GoalSystemStatus, TaskRecord } from "@/lib/types";

/* ─── Collision detection ─────────────────────────────────── */

const goalCollision: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  const columnHit = within.find((c) =>
    String(c.id).startsWith("goal-col-")
  );
  if (columnHit) {
    const goalHit = within.find(
      (c) => !String(c.id).startsWith("goal-col-")
    );
    return goalHit ? [goalHit, columnHit] : [columnHit];
  }
  return closestCenter(args);
};

/* ─── Mobile: tab-based goal list ──────────────────────────── */

function MobileGoalBoard({
  goalsByStatus,
  tasksByGoal,
  onGoalClick,
  onCompleteGoal,
  onArchiveGoal,
  onDeleteGoal,
  onCreateGoal,
}: {
  goalsByStatus: Record<"active" | "in_progress" | "completed", GoalRecord[]>;
  tasksByGoal: Map<string | null, TaskRecord[]>;
  onGoalClick: (goalId: string) => void;
  onCompleteGoal: (goalId: string) => void;
  onArchiveGoal: (goalId: string) => void;
  onDeleteGoal: (goalId: string) => void;
  onCreateGoal: (title: string) => void;
}) {
  const [activeStatus, setActiveStatus] = useState<
    "active" | "in_progress" | "completed"
  >("active");
  const [showAddInput, setShowAddInput] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showAddInput) {
      const id = setTimeout(() => addInputRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [showAddInput]);

  const handleAdd = useCallback(() => {
    const trimmed = newGoalTitle.trim();
    if (!trimmed) return;
    onCreateGoal(trimmed);
    setNewGoalTitle("");
    setShowAddInput(false);
  }, [newGoalTitle, onCreateGoal]);

  const activeGoals = goalsByStatus[activeStatus];
  const isDone = activeStatus === "completed";

  return (
    <div className="flex flex-1 flex-col">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-1">
        {GOAL_COLUMNS.map((status) => {
          const cfg = GOAL_STATUS_CONFIG[status];
          const count = goalsByStatus[status].length;
          const isActive = status === activeStatus;
          return (
            <button
              key={status}
              type="button"
              onClick={() => setActiveStatus(status)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] py-2.5 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-[var(--color-bg-elevated)] shadow-sm"
                  : "text-[var(--color-text-tertiary)]"
              }`}
              style={isActive ? { color: cfg.color } : undefined}
            >
              {cfg.label}
              <span
                className={`text-[10px] ${
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

      {/* Goal list */}
      <div className="mt-3 flex flex-1 flex-col gap-2.5">
        {activeGoals.length === 0 && !showAddInput && (
          <p className="py-8 text-center text-sm text-[var(--color-text-tertiary)]">
            No goals
          </p>
        )}

        {activeGoals.map((goal) => (
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
                  className="min-w-0 flex-1 bg-transparent text-sm text-[var(--color-text-secondary)] placeholder:text-[var(--color-text-tertiary)] outline-none"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddInput(true)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-secondary)]"
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
}

/* ─── Main board ──────────────────────────────────────────── */

export function GoalBoard() {
  const { userId } = useCurrentUser();
  const {
    goals,
    activeGoals,
    inProgressGoals,
    completedGoals,
    loading: goalsLoading,
    createGoal,
    updateGoal,
    completeGoal,
    archiveGoal,
    deleteGoal,
    moveGoalToStatus,
    reorderGoalsByStatus,
  } = useGoals();

  const {
    tasks,
    loading: tasksLoading,
    addTask,
    completeTask,
    uncompleteTask,
    deleteTask: removeTask,
    editTask,
    updateTask,
  } = useTasks();

  const { projects, createProject } = useProjects();

  const goalIds = useMemo(() => goals.map((g) => g.id), [goals]);
  const { goalProjectsMap, setGoalProjects } = useGoalProjects(goalIds);

  const isMobile = useIsMobile();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [detailGoal, setDetailGoal] = useState<GoalRecord | null>(null);
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);

  // Listen for "fp:create-goal" event from HubShell header CTA
  useEffect(() => {
    const handler = () => setShowCreateModal(true);
    document.addEventListener("fp:create-goal", handler);
    return () => document.removeEventListener("fp:create-goal", handler);
  }, []);

  // ─── Derived data ──────────────────────────────────────────

  const tasksByGoal = useMemo(() => {
    const map = new Map<string | null, TaskRecord[]>();
    for (const task of tasks) {
      const key = task.goal_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    }
    return map;
  }, [tasks]);

  const goalsByStatus = useMemo(
    () => ({
      active: activeGoals.sort((a, b) => a.position - b.position),
      in_progress: inProgressGoals.sort((a, b) => a.position - b.position),
      completed: completedGoals.sort((a, b) => a.position - b.position),
    }),
    [activeGoals, inProgressGoals, completedGoals]
  );

  const allVisibleGoals = useMemo(
    () => [...activeGoals, ...inProgressGoals, ...completedGoals],
    [activeGoals, inProgressGoals, completedGoals]
  );

  const unassignedTasks = useMemo(
    () => tasks.filter((t) => !t.goal_id && t.status !== "done"),
    [tasks]
  );

  // ─── Handlers ──────────────────────────────────────────────

  const handleCreateGoal = useCallback(
    async (input: { title: string; description?: string | null; taskIds?: string[] }) => {
      const created = await createGoal(input);
      if (created && input.taskIds?.length) {
        for (const taskId of input.taskIds) {
          updateTask(taskId, { goal_id: created.id });
        }
      }
    },
    [createGoal, updateTask]
  );

  const handleCreateGoalInline = useCallback(
    (title: string) => {
      handleCreateGoal({ title });
    },
    [handleCreateGoal]
  );

  const handleGoalClick = useCallback(
    (goalId: string) => {
      const goal = goals.find((g) => g.id === goalId);
      if (goal) setDetailGoal(goal);
    },
    [goals]
  );

  const handleAddTask = useCallback(
    (goalId: string, title: string) => {
      addTask({ title, goal_id: goalId });
    },
    [addTask]
  );

  // ─── DnD ──────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const findGoalStatus = useCallback(
    (goalId: string): GoalSystemStatus | null => {
      const goal = allVisibleGoals.find((g) => g.id === goalId);
      return goal?.status ?? null;
    },
    [allVisibleGoals]
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

      let targetStatus: "active" | "in_progress" | "completed" | null = null;

      if (overId.startsWith("goal-col-")) {
        targetStatus = overId.replace("goal-col-", "") as "active" | "in_progress" | "completed";
      } else {
        const overGoalStatus = findGoalStatus(overId);
        if (
          overGoalStatus === "active" ||
          overGoalStatus === "in_progress" ||
          overGoalStatus === "completed"
        ) {
          targetStatus = overGoalStatus;
        }
      }

      if (!targetStatus) return;

      const sourceStatus = findGoalStatus(activeId);
      if (!sourceStatus) return;

      const targetGoals = [...goalsByStatus[targetStatus]];

      if (sourceStatus === targetStatus) {
        const oldIdx = targetGoals.findIndex((g) => g.id === activeId);
        const overGoal = targetGoals.findIndex((g) => g.id === overId);
        if (
          oldIdx === -1 ||
          (overGoal === -1 && !overId.startsWith("goal-col-"))
        )
          return;

        const [removed] = targetGoals.splice(oldIdx, 1);
        const newIdx = overGoal === -1 ? targetGoals.length : overGoal;
        targetGoals.splice(newIdx, 0, removed);

        reorderGoalsByStatus(
          targetGoals.map((g) => g.id),
          targetStatus
        );
      } else {
        const goal = allVisibleGoals.find((g) => g.id === activeId);
        if (!goal) return;

        const overIdx = overId.startsWith("goal-col-")
          ? targetGoals.length
          : targetGoals.findIndex((g) => g.id === overId);
        const insertIdx = overIdx === -1 ? targetGoals.length : overIdx;

        moveGoalToStatus(activeId, targetStatus);

        const newOrder = [...targetGoals];
        newOrder.splice(insertIdx, 0, goal);
        reorderGoalsByStatus(
          newOrder.map((g) => g.id),
          targetStatus
        );
      }
    },
    [
      allVisibleGoals,
      goalsByStatus,
      findGoalStatus,
      moveGoalToStatus,
      reorderGoalsByStatus,
    ]
  );

  const handleDragCancel = useCallback(() => setDragActiveId(null), []);

  const draggedGoal = dragActiveId
    ? allVisibleGoals.find((g) => g.id === dragActiveId) ?? null
    : null;

  // ─── Loading ───────────────────────────────────────────────

  const loading = goalsLoading || tasksLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      </div>
    );
  }

  // ─── Empty state ───────────────────────────────────────────

  const isEmpty =
    activeGoals.length === 0 &&
    inProgressGoals.length === 0 &&
    completedGoals.length === 0;

  if (isEmpty) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.06]">
            <Target size={24} className="text-[var(--color-text-tertiary)]" />
          </div>
          <h3 className="mb-1.5 text-base font-semibold text-white">
            No goals yet
          </h3>
          <p className="mb-6 max-w-xs text-sm text-[var(--color-text-tertiary)]">
            Create a goal to organize your tasks around meaningful outcomes.
          </p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="cursor-pointer rounded-full bg-[var(--color-accent-primary)] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-85 hover:scale-[1.02]"
          >
            Create your first goal
          </button>
        </div>
        <CreateGoalModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          tasks={unassignedTasks}
          onCreateGoal={handleCreateGoal}
        />
      </>
    );
  }

  // ─── Shared props for columns ──────────────────────────────

  const sharedProps = {
    tasksByGoal,
    onGoalClick: handleGoalClick,
    onCompleteGoal: completeGoal,
    onArchiveGoal: archiveGoal,
    onDeleteGoal: deleteGoal,
  };

  // ─── Mobile ────────────────────────────────────────────────

  if (isMobile) {
    return (
      <>
        <MobileGoalBoard
          goalsByStatus={goalsByStatus}
          tasksByGoal={tasksByGoal}
          onGoalClick={handleGoalClick}
          onCompleteGoal={completeGoal}
          onArchiveGoal={archiveGoal}
          onDeleteGoal={deleteGoal}
          onCreateGoal={handleCreateGoalInline}
        />
        <CreateGoalModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          tasks={unassignedTasks}
          onCreateGoal={handleCreateGoal}
        />
        <GoalDetailModal
          isOpen={detailGoal !== null}
          onClose={() => setDetailGoal(null)}
          goal={detailGoal}
          tasks={detailGoal ? (tasksByGoal.get(detailGoal.id) ?? []) : []}
          projects={projects}
          projectIds={detailGoal ? (goalProjectsMap.get(detailGoal.id) ?? []) : []}
          onUpdateGoal={updateGoal}
          onSetGoalProjects={setGoalProjects}
          onDeleteGoal={deleteGoal}
          onArchiveGoal={archiveGoal}
          onCreateProject={createProject}
          onAddTask={handleAddTask}
          onCompleteTask={completeTask}
          onUncompleteTask={uncompleteTask}
          onDeleteTask={removeTask}
          onEditTask={editTask}
        />
      </>
    );
  }

  // ─── Desktop ───────────────────────────────────────────────

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={goalCollision}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2">
          {GOAL_COLUMNS.map((status) => (
            <GoalColumn
              key={status}
              status={status}
              goals={goalsByStatus[status]}
              onCreateGoal={
                status !== "completed" ? handleCreateGoalInline : undefined
              }
              {...sharedProps}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {draggedGoal ? (
            <div className="w-[280px] rounded-[var(--radius-sm)] border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-3 shadow-lg">
              <p className="text-sm text-[var(--color-text-primary)]">
                {draggedGoal.title}
              </p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <CreateGoalModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        tasks={unassignedTasks}
        onCreateGoal={handleCreateGoal}
      />

      <GoalDetailModal
        isOpen={detailGoal !== null}
        onClose={() => setDetailGoal(null)}
        goal={detailGoal}
        tasks={detailGoal ? (tasksByGoal.get(detailGoal.id) ?? []) : []}
        projects={projects}
        projectIds={detailGoal ? (goalProjectsMap.get(detailGoal.id) ?? []) : []}
        onUpdateGoal={updateGoal}
        onSetGoalProjects={setGoalProjects}
        onDeleteGoal={deleteGoal}
        onArchiveGoal={archiveGoal}
        onCreateProject={createProject}
        onAddTask={handleAddTask}
        onCompleteTask={completeTask}
        onUncompleteTask={uncompleteTask}
        onDeleteTask={removeTask}
        onEditTask={editTask}
      />
    </>
  );
}
