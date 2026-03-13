"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { Play, ListTodo } from "lucide-react";
import { FocusBody } from "./FocusBody";
import type { GoalRecord, TaskRecord } from "@/lib/types";

interface FocusDropdownProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  goalText: string;
  onGoalTextChange: (text: string) => void;
  activeTaskId: string | null;
  activeGoalId: string | null;
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
  /** Called when user marks the active focus as done */
  onComplete?: () => void;
  /** Optional "continue" task — the last active task the user can resume */
  continueTask?: TaskRecord | null;
  onContinue?: (taskId: string) => void;
  /** Ref to the trigger button — excluded from click-outside detection */
  triggerRef?: React.RefObject<HTMLElement | null>;
}

type PendingSelection = {
  type: "task" | "goal";
  id: string;
  title: string;
  goalId: string | null;
};

export const FocusDropdown = memo(function FocusDropdown({
  open,
  onToggle,
  onClose,
  goalText,
  onGoalTextChange,
  activeTaskId,
  activeGoalId,
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
  onComplete,
  continueTask,
  onContinue,
  triggerRef,
}: FocusDropdownProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [startedText, setStartedText] = useState("");
  // Local input buffer — NOT committed to parent until Start/Enter
  const [inputText, setInputText] = useState("");
  // Pending picker selection — NOT committed to parent until Start is clicked
  const [pending, setPending] = useState<PendingSelection | null>(null);
  // Snapshot of what was active when the popover opened
  const [prevTaskId, setPrevTaskId] = useState<string | null>(null);
  const [prevGoalId, setPrevGoalId] = useState<string | null>(null);

  // Snapshot state when popover opens
  useEffect(() => {
    if (open) {
      setInputText(goalText);
      setStartedText(goalText);
      setPrevTaskId(activeTaskId);
      setPrevGoalId(activeGoalId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on click-outside
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (popoverRef.current?.contains(e.target as Node)) return;
      if (triggerRef?.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open, onClose, triggerRef]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Auto-focus input when popover opens; reset state when it closes
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setShowPicker(false);
      setPending(null);
    }
  }, [open]);

  // Commit pending selection to parent — called by Start in picker
  const handleStart = useCallback(() => {
    if (!pending) return;
    onGoalTextChange(pending.title);
    if (pending.type === "task") onSelectTask(pending.id, pending.title, pending.goalId);
    else onSelectGoal(pending.id, pending.title);
    onClose();
  }, [pending, onGoalTextChange, onSelectTask, onSelectGoal, onClose]);

  if (!open) return null;

  // What FocusBody sees as "active" — pending overrides parent's real active IDs
  const displayTaskId = pending?.type === "task" ? pending.id : pending ? null : activeTaskId;
  const displayGoalId = pending?.type === "goal" ? pending.id : pending ? null : activeGoalId;

  // Input pill logic — only applies when no pending picker selection
  const hasRealSelection = !!activeTaskId || !!activeGoalId;
  const isFreeformStarted = !hasRealSelection && !!inputText.trim() && inputText === startedText;

  return (
    <div
      ref={popoverRef}
      className="absolute bottom-full left-1/2 z-[60] mb-3 w-96 -translate-x-1/2 overflow-visible rounded-xl border border-[var(--color-border-default)] p-3 shadow-2xl"
      style={{
        background: "rgba(10,10,10,0.98)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex flex-col">
        {/* Title — top of popover */}
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">What are you working on?</p>

        {/* Goals + Tasks accordions — toggled by ListTodo button */}
        {showPicker && (
          <FocusBody
            className="-mx-3"
            activeTaskId={displayTaskId}
            activeGoalId={displayGoalId}
            previousActiveTaskId={prevTaskId}
            previousActiveGoalId={prevGoalId}
            goals={goals}
            tasks={tasks}
            accentColor={accentColor}
            onSelectTask={(id, title, goalId) => {
              setPending({ type: "task", id, title, goalId });
            }}
            onSelectGoal={(id, title) => {
              setPending({ type: "goal", id, title, goalId: null });
            }}
            onCompleteTask={onCompleteTask}
            onDeleteTask={onDeleteTask}
            onCompleteGoal={onCompleteGoal}
            onDeleteGoal={onDeleteGoal}
            onAddTask={onAddTask}
            onAddGoal={onAddGoal}
            onEditTask={onEditTask}
            onEditGoal={onEditGoal}
            onStart={handleStart}
            maxHeight="max-h-64"
          />
        )}

        {/* Continue chip — above input, below accordions */}
        {continueTask && !activeTaskId && !inputText.trim() && (
          <div className="mt-2 border-t border-white/[0.06] pt-2">
            <button
              type="button"
              onClick={() => {
                onContinue?.(continueTask.id);
                onClose();
              }}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left transition-all hover:bg-white/[0.06]"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <Play size={12} strokeWidth={2} className="shrink-0 text-white/40" />
              <span className="min-w-0 truncate text-xs text-white/50">
                Continue: <span className="text-white/70">{continueTask.title}</span>
              </span>
            </button>
          </div>
        )}

        {/* Input area — pinned to bottom, closest to the action bar trigger */}
        <div className={showPicker || (continueTask && !activeTaskId && !inputText.trim()) ? "mt-2 border-t border-white/[0.06] pt-2" : "mt-2"}>
          <div
            className="flex items-center gap-1.5 rounded-full py-1 pl-4 pr-1.5 ring-0 ring-white/0 transition-all focus-within:ring-1 focus-within:ring-white/12"
            style={{
              background: "var(--color-bg-elevated)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={pending ? pending.title : inputText}
              onChange={(e) => {
                setPending(null);
                setInputText(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && inputText.trim()) {
                  if (pending) { handleStart(); return; }
                  if (isFreeformStarted && onComplete) { onComplete(); return; }
                  onGoalTextChange(inputText);
                  setStartedText(inputText);
                  onClose();
                }
              }}
              placeholder="Write your task or goal..."
              className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-white placeholder-white/30 outline-none"
            />

            {/* Start pill — freeform text, not yet started, no pending picker selection */}
            {!pending && !hasRealSelection && inputText.trim() && !isFreeformStarted && (
              <button
                type="button"
                onClick={() => { onGoalTextChange(inputText); setStartedText(inputText); onClose(); }}
                className="flex shrink-0 cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors hover:bg-white/[0.1]"
                style={{ color: accentColor, background: `color-mix(in srgb, ${accentColor} 10%, transparent)` }}
              >
                <Play size={10} strokeWidth={2.5} className="fill-current" />
                Start
              </button>
            )}

            {/* Done? pill — real active selection OR freeform already started */}
            {!pending && (hasRealSelection || isFreeformStarted) && !!inputText.trim() && onComplete && (
              <button
                type="button"
                onClick={onComplete}
                className="shrink-0 cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium transition-colors hover:bg-white/[0.1]"
                style={{ color: accentColor, background: `color-mix(in srgb, ${accentColor} 10%, transparent)` }}
              >
                Done?
              </button>
            )}

            {/* Divider + browse button */}
            <span
              className="h-5 w-px shrink-0"
              style={{ background: "rgba(255,255,255,0.08)" }}
              aria-hidden
            />
            <button
              type="button"
              onClick={() => setShowPicker((v) => !v)}
              className="shrink-0 cursor-pointer rounded p-1.5 text-white/30 transition hover:text-white/60"
              aria-label="Browse tasks"
            >
              <ListTodo size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
