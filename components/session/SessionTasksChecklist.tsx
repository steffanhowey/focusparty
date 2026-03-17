"use client";

import { useState, useRef, useEffect, useCallback, memo } from "react";
import { Plus, Check, X } from "lucide-react";
import type { SessionTaskRecord } from "@/lib/types";

interface SessionTasksChecklistProps {
  tasks: SessionTaskRecord[];
  onAdd: (text: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export const SessionTasksChecklist = memo(function SessionTasksChecklist({
  tasks,
  onAdd,
  onToggle,
  onDelete,
}: SessionTasksChecklistProps) {
  const [newText, setNewText] = useState("");
  const [showInput, setShowInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showInput) {
      const id = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [showInput]);

  const handleAdd = useCallback(() => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setNewText("");
    // Keep input open for rapid entry
  }, [newText, onAdd]);

  const active = tasks.filter((t) => !t.completed);
  const completed = tasks.filter((t) => t.completed);

  return (
    <div className="px-4 py-3">
      {/* Section header */}
      <p className="mb-1 text-xs font-semibold text-[var(--sg-shell-500)] uppercase tracking-wider">
        Goal Tasks
      </p>

      {/* Active tasks */}
      {active.map((task) => (
        <div
          key={task.id}
          className="group flex items-center gap-2.5 py-1.5"
        >
          {/* Checkbox */}
          <button
            type="button"
            onClick={() => onToggle(task.id)}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-white/[0.12] transition-colors hover:border-emerald-500 hover:bg-emerald-500/10"
            aria-label={`Complete ${task.text}`}
          >
            <Check
              size={10}
              strokeWidth={2.5}
              className="text-transparent transition-colors [*:hover>&]:text-emerald-400"
            />
          </button>

          {/* Text */}
          <span className="min-w-0 flex-1 text-sm leading-snug text-[var(--sg-shell-600)]">
            {task.text}
          </span>

          {/* Delete */}
          <button
            type="button"
            onClick={() => onDelete(task.id)}
            className="flex h-4 w-4 shrink-0 items-center justify-center text-[var(--sg-shell-500)] opacity-0 transition-opacity group-hover:opacity-100 hover:text-white"
            aria-label={`Remove ${task.text}`}
          >
            <X size={12} strokeWidth={2} />
          </button>
        </div>
      ))}

      {/* Completed tasks */}
      {completed.map((task) => (
        <div
          key={task.id}
          className="group flex items-center gap-2.5 py-1.5"
        >
          <button
            type="button"
            onClick={() => onToggle(task.id)}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-emerald-500 transition-colors hover:bg-emerald-400"
            aria-label={`Restore ${task.text}`}
          >
            <Check size={10} strokeWidth={2.5} className="text-white" />
          </button>

          <span className="min-w-0 flex-1 text-sm leading-snug text-[var(--sg-shell-500)] line-through">
            {task.text}
          </span>

          <button
            type="button"
            onClick={() => onDelete(task.id)}
            className="flex h-4 w-4 shrink-0 items-center justify-center text-[var(--sg-shell-500)] opacity-0 transition-opacity group-hover:opacity-100 hover:text-white"
            aria-label={`Remove ${task.text}`}
          >
            <X size={12} strokeWidth={2} />
          </button>
        </div>
      ))}

      {/* Add step input */}
      {showInput ? (
        <div className="mt-1 flex items-center gap-2.5 py-1.5">
          <Plus
            size={14}
            strokeWidth={1.5}
            className="shrink-0 text-[var(--sg-shell-500)]"
          />
          <input
            ref={inputRef}
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
              if (e.key === "Escape") {
                setShowInput(false);
                setNewText("");
              }
            }}
            onBlur={() => {
              if (!newText.trim()) setShowInput(false);
            }}
            placeholder="Add a step..."
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--sg-shell-600)] placeholder:text-[var(--sg-shell-500)] outline-none"
          />
          {newText.trim() && (
            <span className="shrink-0 text-2xs text-[var(--sg-shell-500)]">
              &crarr;
            </span>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowInput(true)}
          className="mt-1 flex items-center gap-2.5 py-1.5 text-[var(--sg-shell-500)] transition-colors hover:text-[var(--sg-shell-600)]"
        >
          <Plus size={14} strokeWidth={1.5} />
          <span className="text-sm">Add step</span>
        </button>
      )}
    </div>
  );
});
