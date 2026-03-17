"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Check, ChevronRight, ChevronDown, ArrowUpDown, Plus, MoreHorizontal, Trash2, Play } from "lucide-react";
import { MenuItem } from "@/components/ui/MenuItem";
import type { GoalRecord, TaskRecord } from "@/lib/types";

export interface FocusBodyProps {
  activeTaskId: string | null;
  activeGoalId: string | null;
  /** IDs that were active when the popover opened — used to distinguish Start vs Done? */
  previousActiveTaskId?: string | null;
  previousActiveGoalId?: string | null;
  goals: GoalRecord[];
  tasks: TaskRecord[];
  accentColor: string;
  onSelectTask: (taskId: string, taskTitle: string, goalId: string | null) => void;
  onSelectGoal: (goalId: string, goalTitle: string) => void;
  onCompleteTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onCompleteGoal: (goalId: string) => void;
  onDeleteGoal: (goalId: string) => void;
  onAddTask: (title: string, goalId: string | null) => void;
  onAddGoal: (title: string) => void;
  onEditTask?: (taskId: string, newTitle: string) => void;
  onEditGoal?: (goalId: string, newTitle: string) => void;
  /** Called when user clicks Start on a newly selected item */
  onStart?: () => void;
}

// ─── Inline add input ─────────────────────────────────────
function InlineAdd({ onAdd, label = "task" }: { onAdd: (title: string) => void; label?: string }) {
  const [active, setActive] = useState(false);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (active) inputRef.current?.focus();
  }, [active]);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (trimmed) {
      onAdd(trimmed);
      setText("");
    }
  };

  if (!active) {
    return (
      <button
        type="button"
        onClick={() => setActive(true)}
        className="flex w-full cursor-pointer items-center gap-2.5 border-b border-white/[0.06] px-4 py-3.5 text-sm text-white/25 transition-colors hover:text-white/40"
      >
        <span className="flex h-[16px] w-[16px] shrink-0 items-center justify-center">
          <Plus size={10} strokeWidth={2} />
        </span>
        Add {label}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-4 py-3.5">
      <span className="flex h-[16px] w-[16px] shrink-0 items-center justify-center text-white/25">
        <Plus size={10} strokeWidth={2} />
      </span>
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
          }
          if (e.key === "Escape") {
            setActive(false);
            setText("");
          }
        }}
        onBlur={() => {
          if (!text.trim()) {
            setActive(false);
          }
        }}
        placeholder={`New ${label}...`}
        className="min-w-0 flex-1 bg-transparent text-sm text-white/60 placeholder:text-white/20 outline-none"
      />
      {text.trim() && (
        <span className="shrink-0 text-2xs text-white/20">↵</span>
      )}
    </div>
  );
}

// ─── 3-dot context menu (shared by tasks & goals) ─────────
function ItemMenu({
  onComplete,
  onDelete,
  onClose,
}: {
  onComplete: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="absolute right-2 top-full z-50 mt-1 w-40 rounded-lg py-1"
      style={{
        background: "var(--sg-forest-800)",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      <MenuItem
        icon={<Check size={14} strokeWidth={2} />}
        onClick={() => { onComplete(); onClose(); }}
      >
        Complete
      </MenuItem>
      <MenuItem
        icon={<Trash2 size={14} strokeWidth={2} />}
        danger
        onClick={() => { onDelete(); onClose(); }}
      >
        Delete
      </MenuItem>
    </div>
  );
}

// ─── Radio circle SVG ─────────────────────────────────────
function RadioCircle({ active, accentColor }: { active: boolean; accentColor: string }) {
  if (active) {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="7" fill={accentColor} />
        <circle cx="8" cy="8" r="3" fill="white" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3 2" />
    </svg>
  );
}

export function FocusBody({
  activeTaskId,
  activeGoalId,
  previousActiveTaskId,
  previousActiveGoalId,
  goals,
  tasks,
  accentColor,
  onSelectTask,
  onSelectGoal,
  onCompleteTask,
  onDeleteTask,
  onCompleteGoal,
  onDeleteGoal,
  onAddTask,
  onAddGoal,
  onEditTask,
  onEditGoal,
  onStart,
  maxHeight = "max-h-64",
  className = "",
}: FocusBodyProps & { maxHeight?: string; className?: string }) {
  const [expandedGoalIds, setExpandedGoalIds] = useState<Set<string>>(new Set());
  // Inline editing: "task:id" or "goal:id"
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  // Tracks which item has its 3-dot menu open: "task:id" or "goal:id"
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [goalsSortNewest, setGoalsSortNewest] = useState(true);
  const [tasksSortNewest, setTasksSortNewest] = useState(true);

  // ─── Data ───────────────────────────────────────────────
  const sortedGoals = useMemo(() => {
    return [...goals].sort((a, b) => {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      return goalsSortNewest ? bTime - aTime : aTime - bTime;
    });
  }, [goals, goalsSortNewest]);

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      return tasksSortNewest ? bTime - aTime : aTime - bTime;
    });
  }, [tasks, tasksSortNewest]);

  const goalTaskMap = useMemo(() => {
    const map = new Map<string, TaskRecord[]>();
    for (const goal of goals) {
      const gt = sortedTasks.filter((t) => t.goal_id === goal.id);
      if (gt.length > 0) map.set(goal.id, gt);
    }
    return map;
  }, [goals, sortedTasks]);

  const standaloneTasks = useMemo(
    () => sortedTasks.filter((t) => !t.goal_id),
    [sortedTasks],
  );

  const toggleGoal = useCallback((goalId: string) => {
    setExpandedGoalIds((prev) => {
      const next = new Set(prev);
      if (next.has(goalId)) next.delete(goalId);
      else next.add(goalId);
      return next;
    });
  }, []);

  // Accordion state — both open by default
  const [addingGoal, setAddingGoal] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [addText, setAddText] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);

  // ─── Inline edit helpers ─────────────────────────────────
  const startEdit = useCallback((key: string, currentTitle: string) => {
    setEditingId(key);
    setEditText(currentTitle);
  }, []);

  const commitEdit = useCallback(() => {
    if (!editingId) return;
    const trimmed = editText.trim();
    if (trimmed && editingId.startsWith("task:")) {
      onEditTask?.(editingId.slice(5), trimmed);
    } else if (trimmed && editingId.startsWith("goal:")) {
      onEditGoal?.(editingId.slice(5), trimmed);
    }
    setEditingId(null);
    setEditText("");
  }, [editingId, editText, onEditTask, onEditGoal]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditText("");
  }, []);

  // ─── Shared task row renderer ──────────────────────────
  const renderTaskRow = (task: TaskRecord) => {
    const isActive = task.id === activeTaskId;
    const menuKey = `task:${task.id}`;
    const isMenuOpen = menuOpenId === menuKey;
    const isEditing = editingId === menuKey;

    return (
      <div key={task.id} className="relative">
        <div
          className={`group flex cursor-pointer items-center gap-2.5 border-b border-white/[0.06] px-4 py-3.5 transition-colors ${
            isActive ? "" : "hover:bg-white/[0.04]"
          }`}
          style={
            isActive
              ? { background: `color-mix(in srgb, ${accentColor} 8%, transparent)` }
              : undefined
          }
          onClick={() => onSelectTask(task.id, task.title, task.goal_id ?? null)}
        >
          {/* Radio select */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onSelectTask(task.id, task.title, task.goal_id ?? null); }}
            className="flex h-[16px] w-[16px] shrink-0 cursor-pointer items-center justify-center"
            aria-label={isActive ? `${task.title} selected` : `Select ${task.title}`}
          >
            <RadioCircle active={isActive} accentColor={accentColor} />
          </button>

          {/* Title — click to edit */}
          {isEditing ? (
            <input
              autoFocus
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") cancelEdit();
              }}
              onBlur={commitEdit}
              onClick={(e) => e.stopPropagation()}
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none"
            />
          ) : (
            <span
              className={`min-w-0 flex-1 truncate text-sm transition-colors ${
                isActive
                  ? "font-medium text-white"
                  : "text-white/60 group-hover:text-white/90"
              }`}
              onClick={(e) => {
                if (onEditTask) {
                  e.stopPropagation();
                  startEdit(menuKey, task.title);
                }
              }}
            >
              {task.title}
            </span>
          )}

          {/* Start/Done pill — visible on active task */}
          {isActive && !isEditing && (() => {
            const wasAlreadyActive = task.id === previousActiveTaskId;
            return wasAlreadyActive ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onCompleteTask(task.id); }}
                className="shrink-0 cursor-pointer rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors hover:bg-white/[0.1]"
                style={{ color: accentColor, background: `color-mix(in srgb, ${accentColor} 10%, transparent)` }}
                aria-label={`Mark ${task.title} as done`}
              >
                Done?
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onStart?.(); }}
                className="flex shrink-0 cursor-pointer items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors hover:bg-white/[0.1]"
                style={{ color: accentColor, background: `color-mix(in srgb, ${accentColor} 10%, transparent)` }}
                aria-label={`Start ${task.title}`}
              >
                <Play size={10} strokeWidth={2.5} className="fill-current" />
                Start
              </button>
            );
          })()}

          {/* 3-dot menu trigger — hover only */}
          {!isEditing && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpenId(isMenuOpen ? null : menuKey);
              }}
              className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-white/20 opacity-0 transition-opacity hover:bg-white/[0.08] hover:text-white/50 group-hover:opacity-100"
              aria-label="Task actions"
            >
              <MoreHorizontal size={14} strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Dropdown menu */}
        {isMenuOpen && (
          <ItemMenu
            onComplete={() => onCompleteTask(task.id)}
            onDelete={() => onDeleteTask(task.id)}
            onClose={() => setMenuOpenId(null)}
          />
        )}
      </div>
    );
  };

  return (
    <div
      className={`${maxHeight} ${className} overflow-y-auto [&::-webkit-scrollbar]:w-[5px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-white/20`}
    >
      {/* ── Goals accordion ── */}
      <div className="flex w-full items-center gap-1.5 px-4 py-3.5">
        <button
          type="button"
          onClick={() => setGoalsOpen((o) => !o)}
          className="flex flex-1 cursor-pointer items-center gap-1.5"
        >
          <ChevronRight
            size={10}
            strokeWidth={2}
            className={`shrink-0 text-white/30 transition-transform duration-200 ${goalsOpen ? "rotate-90" : ""}`}
          />
          <span className="text-xs font-semibold uppercase tracking-wider text-white/30">
            Goals
          </span>
        </button>
        <button
          type="button"
          onClick={() => { if (!goalsOpen) setGoalsOpen(true); setAddingGoal(true); setAddingTask(false); setAddText(""); requestAnimationFrame(() => addInputRef.current?.focus()); }}
          className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-white/20 transition-colors hover:bg-white/[0.06] hover:text-white/40"
          aria-label="Add goal"
        >
          <Plus size={11} strokeWidth={2} />
        </button>
        {goalsOpen && (
          <button
            type="button"
            onClick={() => setGoalsSortNewest((s) => !s)}
            className="flex cursor-pointer items-center gap-1 text-2xs text-white/30 transition-colors hover:text-white/50"
          >
            <ArrowUpDown size={10} strokeWidth={2} />
            <span>{goalsSortNewest ? "Newest" : "Oldest"}</span>
          </button>
        )}
      </div>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: goalsOpen ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          {/* Inline add — top of list */}
          {addingGoal && (
            <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-4 py-3.5">
              <span className="flex h-[16px] w-[16px] shrink-0 items-center justify-center text-white/25">
                <Plus size={10} strokeWidth={2} />
              </span>
              <input
                ref={addInputRef}
                type="text"
                value={addText}
                onChange={(e) => setAddText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && addText.trim()) {
                    onAddGoal(addText.trim());
                    setAddText("");
                    setAddingGoal(false);
                  }
                  if (e.key === "Escape") { setAddingGoal(false); setAddText(""); }
                }}
                onBlur={() => {
                  if (addText.trim()) { onAddGoal(addText.trim()); }
                  setAddText("");
                  setAddingGoal(false);
                }}
                placeholder="New goal…"
                className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder-white/25 outline-none"
              />
              {addText.trim() && (
                <span className="shrink-0 text-2xs text-white/20">↵</span>
              )}
            </div>
          )}
          {sortedGoals.map((goal) => {
            const goalTasks = goalTaskMap.get(goal.id) ?? [];
            const isExpanded = expandedGoalIds.has(goal.id);
            const isActive = goal.id === activeGoalId;
            const menuKey = `goal:${goal.id}`;
            const isMenuOpen = menuOpenId === menuKey;
            const isEditing = editingId === menuKey;
            return (
              <div key={goal.id} className="relative">
                <div
                  className={`group flex cursor-pointer items-center gap-2.5 border-b border-white/[0.06] px-4 py-3.5 transition-colors ${
                    isActive ? "" : "hover:bg-white/[0.04]"
                  }`}
                  style={
                    isActive
                      ? { background: `color-mix(in srgb, ${accentColor} 8%, transparent)` }
                      : undefined
                  }
                  onClick={() => toggleGoal(goal.id)}
                >
                  {/* Radio select */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onSelectGoal(goal.id, goal.title); }}
                    className="flex h-[16px] w-[16px] shrink-0 cursor-pointer items-center justify-center"
                    aria-label={isActive ? `${goal.title} selected` : `Select ${goal.title}`}
                  >
                    <RadioCircle active={isActive} accentColor={accentColor} />
                  </button>

                  {/* Title — click to edit */}
                  {isEditing ? (
                    <input
                      autoFocus
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") commitEdit();
                        if (e.key === "Escape") cancelEdit();
                      }}
                      onBlur={commitEdit}
                      onClick={(e) => e.stopPropagation()}
                      className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none"
                    />
                  ) : (
                    <span
                      className={`min-w-0 flex-1 truncate text-sm transition-colors ${
                        isActive
                          ? "font-medium text-white"
                          : "text-white/60 group-hover:text-white/90"
                      }`}
                      onClick={(e) => {
                        if (onEditGoal) {
                          e.stopPropagation();
                          startEdit(menuKey, goal.title);
                        }
                      }}
                    >
                      {goal.title}
                    </span>
                  )}

                  {/* Start/Done pill — visible on active goal */}
                  {isActive && !isEditing && (() => {
                    const wasAlreadyActive = goal.id === previousActiveGoalId;
                    return wasAlreadyActive ? (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onCompleteGoal(goal.id); }}
                        className="shrink-0 cursor-pointer rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors hover:bg-white/[0.1]"
                        style={{ color: accentColor, background: `color-mix(in srgb, ${accentColor} 10%, transparent)` }}
                        aria-label={`Mark ${goal.title} as done`}
                      >
                        Done?
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onStart?.(); }}
                        className="flex shrink-0 cursor-pointer items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors hover:bg-white/[0.1]"
                        style={{ color: accentColor, background: `color-mix(in srgb, ${accentColor} 10%, transparent)` }}
                        aria-label={`Start ${goal.title}`}
                      >
                        <Play size={10} strokeWidth={2.5} className="fill-current" />
                        Start
                      </button>
                    );
                  })()}

                  {/* 3-dot menu trigger */}
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenId(isMenuOpen ? null : menuKey);
                      }}
                      className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-white/20 opacity-0 transition-opacity hover:bg-white/[0.08] hover:text-white/50 group-hover:opacity-100"
                      aria-label="Goal actions"
                    >
                      <MoreHorizontal size={14} strokeWidth={2} />
                    </button>
                  )}

                  {/* Expand chevron — always visible, rightmost */}
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleGoal(goal.id); }}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white/30 transition-colors hover:text-white/50"
                      aria-label={isExpanded ? "Collapse" : "Expand"}
                    >
                      {isExpanded ? (
                        <ChevronDown size={12} strokeWidth={2} />
                      ) : (
                        <ChevronRight size={12} strokeWidth={2} />
                      )}
                    </button>
                  )}
                </div>

                {/* Goal context menu */}
                {isMenuOpen && (
                  <ItemMenu
                    onComplete={() => onCompleteGoal(goal.id)}
                    onDelete={() => onDeleteGoal(goal.id)}
                    onClose={() => setMenuOpenId(null)}
                  />
                )}

                {isExpanded && (
                  <div className="border-b border-white/[0.06]">
                    {goalTasks.map(renderTaskRow)}
                    <InlineAdd onAdd={(title) => onAddTask(title, goal.id)} label="task" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mx-4 border-t border-white/[0.06]" />

      {/* ── Backlog accordion ── */}
      <div className="flex w-full items-center gap-1.5 px-4 py-3.5">
        <button
          type="button"
          onClick={() => setTasksOpen((o) => !o)}
          className="flex flex-1 cursor-pointer items-center gap-1.5"
        >
          <ChevronRight
            size={10}
            strokeWidth={2}
            className={`shrink-0 text-white/30 transition-transform duration-200 ${tasksOpen ? "rotate-90" : ""}`}
          />
          <span className="text-xs font-semibold uppercase tracking-wider text-white/30">
            Tasks
          </span>
        </button>
        <button
          type="button"
          onClick={() => { if (!tasksOpen) setTasksOpen(true); setAddingTask(true); setAddingGoal(false); setAddText(""); requestAnimationFrame(() => addInputRef.current?.focus()); }}
          className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-white/20 transition-colors hover:bg-white/[0.06] hover:text-white/40"
          aria-label="Add task"
        >
          <Plus size={11} strokeWidth={2} />
        </button>
        {tasksOpen && (
          <button
            type="button"
            onClick={() => setTasksSortNewest((s) => !s)}
            className="flex cursor-pointer items-center gap-1 text-2xs text-white/30 transition-colors hover:text-white/50"
          >
            <ArrowUpDown size={10} strokeWidth={2} />
            <span>{tasksSortNewest ? "Newest" : "Oldest"}</span>
          </button>
        )}
      </div>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: tasksOpen ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          {/* Inline add — top of list */}
          {addingTask && (
            <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-4 py-3.5">
              <span className="flex h-[16px] w-[16px] shrink-0 items-center justify-center text-white/25">
                <Plus size={10} strokeWidth={2} />
              </span>
              <input
                ref={addInputRef}
                type="text"
                value={addText}
                onChange={(e) => setAddText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && addText.trim()) {
                    onAddTask(addText.trim(), null);
                    setAddText("");
                    setAddingTask(false);
                  }
                  if (e.key === "Escape") { setAddingTask(false); setAddText(""); }
                }}
                onBlur={() => {
                  if (addText.trim()) { onAddTask(addText.trim(), null); }
                  setAddText("");
                  setAddingTask(false);
                }}
                placeholder="New task…"
                className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder-white/25 outline-none"
              />
              {addText.trim() && (
                <span className="shrink-0 text-2xs text-white/20">↵</span>
              )}
            </div>
          )}
          {standaloneTasks.map(renderTaskRow)}
        </div>
      </div>
    </div>
  );
}
