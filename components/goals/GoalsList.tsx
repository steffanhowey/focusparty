"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { Target, ChevronDown } from "lucide-react";
import { useGoals } from "@/lib/useGoals";
import { useTasks } from "@/lib/useTasks";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { GoalCard } from "./GoalCard";
import { CreateGoalModal } from "./CreateGoalModal";
import type { TaskRecord } from "@/lib/types";

export function GoalsList() {
  const { userId } = useCurrentUser();
  const {
    activeGoals,
    completedGoals,
    loading: goalsLoading,
    createGoal,
    completeGoal,
    archiveGoal,
    deleteGoal,
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

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedGoalIds, setExpandedGoalIds] = useState<Set<string>>(new Set());
  const [breakingDownGoalId, setBreakingDownGoalId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  // Listen for "fp:create-goal" event from HubShell header CTA
  useEffect(() => {
    const handler = () => setShowCreateModal(true);
    document.addEventListener("fp:create-goal", handler);
    return () => document.removeEventListener("fp:create-goal", handler);
  }, []);

  // Group tasks by goal_id
  const tasksByGoal = useMemo(() => {
    const map = new Map<string | null, TaskRecord[]>();
    for (const task of tasks) {
      const key = task.goal_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    }
    return map;
  }, [tasks]);

  const looseTasks = useMemo(
    () => (tasksByGoal.get(null) ?? []).filter((t) => t.status !== "done"),
    [tasksByGoal]
  );

  const unassignedTasks = useMemo(
    () => tasks.filter((t) => !t.goal_id && t.status !== "done"),
    [tasks]
  );

  const toggleExpand = useCallback((goalId: string) => {
    setExpandedGoalIds((prev) => {
      const next = new Set(prev);
      if (next.has(goalId)) next.delete(goalId);
      else next.add(goalId);
      return next;
    });
  }, []);

  const handleCreateGoal = useCallback(
    async (input: { title: string; description?: string | null; taskIds?: string[] }) => {
      const created = await createGoal(input);
      if (created) {
        setExpandedGoalIds((prev) => new Set(prev).add(created.id));
        if (input.taskIds?.length) {
          for (const taskId of input.taskIds) {
            updateTask(taskId, { goal_id: created.id });
          }
        }
      }
    },
    [createGoal]
  );

  const handleAddTask = useCallback(
    (goalId: string, title: string) => {
      addTask({ title, goal_id: goalId });
    },
    [addTask]
  );

  const handleAIBreakdown = useCallback(
    async (goalId: string) => {
      if (!userId) return;
      const goal = activeGoals.find((g) => g.id === goalId);
      if (!goal) return;

      setBreakingDownGoalId(goalId);
      try {
        const existing = tasksByGoal.get(goalId) ?? [];
        const res = await fetch("/api/goals/breakdown", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            goalTitle: goal.title,
            goalDescription: goal.description,
            existingTasks: existing.map((t) => t.title),
          }),
        });

        if (!res.ok) throw new Error("AI breakdown failed");
        const { tasks: suggestedTasks } = await res.json();

        // Add each suggested task under this goal
        for (let i = 0; i < suggestedTasks.length; i++) {
          const t = suggestedTasks[i];
          await addTask({
            title: t.title,
            description: t.description ?? null,
            goal_id: goalId,
            ai_generated: true,
          });
        }
      } catch (err) {
        console.error("AI breakdown error:", err);
      } finally {
        setBreakingDownGoalId(null);
      }
    },
    [userId, activeGoals, tasksByGoal, addTask]
  );

  const loading = goalsLoading || tasksLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      </div>
    );
  }

  const isEmpty = activeGoals.length === 0 && looseTasks.length === 0;

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      {/* Empty state */}
      {isEmpty && (
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
      )}

      {/* Active goals */}
      {activeGoals.map((goal) => (
        <GoalCard
          key={goal.id}
          goal={goal}
          tasks={tasksByGoal.get(goal.id) ?? []}
          expanded={expandedGoalIds.has(goal.id)}
          onToggleExpand={() => toggleExpand(goal.id)}
          onCompleteGoal={completeGoal}
          onArchiveGoal={archiveGoal}
          onDeleteGoal={deleteGoal}
          onAddTask={handleAddTask}
          onCompleteTask={completeTask}
          onUncompleteTask={uncompleteTask}
          onDeleteTask={removeTask}
          onEditTask={editTask}
          onAIBreakdown={handleAIBreakdown}
          isBreakingDown={breakingDownGoalId === goal.id}
        />
      ))}

      {/* Loose tasks (no goal) */}
      {looseTasks.length > 0 && (
        <div className="mt-4">
          <h4 className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Ungrouped tasks
          </h4>
          <div className="space-y-0.5 rounded-xl border border-[var(--color-border-default)] px-3 py-2" style={{ background: "rgba(255,255,255,0.02)" }}>
            {looseTasks.map((task) => (
              <div
                key={task.id}
                className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.04]"
              >
                <button
                  type="button"
                  onClick={() => completeTask(task.id)}
                  className="flex h-4.5 w-4.5 shrink-0 cursor-pointer items-center justify-center rounded-[5px] border border-white/20 transition-colors hover:border-white/40 hover:bg-white/10"
                  aria-label="Complete task"
                />
                <span className="min-w-0 flex-1 truncate text-sm text-[var(--color-text-secondary)]">
                  {task.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed goals */}
      {completedGoals.length > 0 && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowCompleted(!showCompleted)}
            className="mb-2 flex cursor-pointer items-center gap-1.5 px-1 text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)] transition-colors hover:text-white/60"
          >
            <ChevronDown
              size={12}
              className={`transition-transform ${showCompleted ? "" : "-rotate-90"}`}
            />
            Completed ({completedGoals.length})
          </button>
          {showCompleted && (
            <div className="space-y-2 opacity-60">
              {completedGoals.map((goal) => (
                <div
                  key={goal.id}
                  className="flex items-center gap-3 rounded-xl border border-[var(--color-border-default)] px-4 py-3"
                  style={{ background: "rgba(255,255,255,0.02)" }}
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#5BC682]/20">
                    <Target size={12} className="text-[#5BC682]" />
                  </div>
                  <span className="truncate text-sm text-[var(--color-text-secondary)] line-through">
                    {goal.title}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <CreateGoalModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        tasks={unassignedTasks}
        onCreateGoal={handleCreateGoal}
      />
    </div>
  );
}
