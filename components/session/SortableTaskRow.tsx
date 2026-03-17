"use client";

import { memo, useState, useRef, useEffect, useCallback } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Grip, Check, Play } from "lucide-react";
import type { TaskRecord } from "@/lib/types";

interface SortableTaskRowProps {
  task: TaskRecord;
  completed?: boolean;
  isActive?: boolean;
  onComplete: (taskId: string) => void;
  onEdit: (taskId: string, newText: string) => void;
  onActivate?: (taskId: string) => void;
}

export const SortableTaskRow = memo(function SortableTaskRow({
  task,
  completed = false,
  isActive = false,
  onComplete,
  onEdit,
  onActivate,
}: SortableTaskRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback(() => {
    const el = editInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    if (isEditing) {
      const id = setTimeout(() => {
        const el = editInputRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
        autoResize();
      }, 50);
      return () => clearTimeout(id);
    }
  }, [isEditing, autoResize]);

  const startEditing = useCallback(() => {
    setIsEditing(true);
    setEditText(task.title);
  }, [task.title]);

  const commitEdit = useCallback(() => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== task.title) {
      onEdit(task.id, trimmed);
    }
    setIsEditing(false);
    setEditText("");
  }, [editText, task.title, task.id, onEdit]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditText("");
  }, []);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-start gap-2.5 px-2 py-3 last:border-b-0 ${
        isActive
          ? "border-l-2 border-l-[var(--sg-forest-400)] border-b border-b-[var(--sg-shell-200)] bg-white/[0.04]"
          : "border-l-2 border-l-transparent border-b border-b-[var(--sg-shell-200)]"
      }`}
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="flex h-5 shrink-0 cursor-grab touch-none items-center justify-center text-[var(--sg-shell-500)] active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <Grip size={14} strokeWidth={1.5} />
      </button>

      {/* Task text */}
      {isEditing ? (
        <textarea
          ref={editInputRef}
          rows={1}
          value={editText}
          onChange={(e) => {
            setEditText(e.target.value);
            autoResize();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commitEdit();
            }
            if (e.key === "Escape") cancelEdit();
          }}
          onBlur={commitEdit}
          className="min-w-0 flex-1 resize-none bg-transparent text-sm leading-snug text-white outline-none"
        />
      ) : (
        <span
          className={`min-w-0 flex-1 cursor-text break-words text-sm leading-snug ${
            completed
              ? "text-[var(--sg-shell-500)] line-through"
              : isActive
                ? "text-white"
                : "text-[var(--sg-shell-600)]"
          }`}
          onClick={startEditing}
        >
          {task.title}
        </span>
      )}

      {/* Play / active indicator */}
      {onActivate && !completed && (
        <button
          type="button"
          onClick={() => onActivate(task.id)}
          className={`flex h-5 shrink-0 items-center justify-center transition-colors ${
            isActive
              ? "text-[var(--sg-forest-400)]"
              : "text-[var(--sg-shell-500)] opacity-0 group-hover:opacity-100 hover:text-white"
          }`}
          aria-label={isActive ? `Active: ${task.title}` : `Focus on ${task.title}`}
        >
          <Play
            size={12}
            strokeWidth={2}
            className={isActive ? "fill-current" : ""}
          />
        </button>
      )}

      {/* Completion checkbox */}
      <div className="flex h-5 shrink-0 items-center">
        {completed ? (
          <button
            type="button"
            onClick={() => onComplete(task.id)}
            className="flex h-[18px] w-[18px] items-center justify-center rounded-xs bg-emerald-500 transition-colors hover:bg-emerald-400"
            aria-label={`Restore ${task.title}`}
          >
            <Check size={11} strokeWidth={2.5} className="text-white" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onComplete(task.id)}
            className="flex h-[18px] w-[18px] items-center justify-center rounded-xs border border-[var(--sg-shell-border)] transition-colors hover:border-emerald-500 hover:bg-emerald-500/10"
            aria-label={`Complete ${task.title}`}
          >
            <Check
              size={11}
              strokeWidth={2.5}
              className="text-transparent transition-colors group-hover:text-transparent [*:hover>&]:text-emerald-400"
            />
          </button>
        )}
      </div>
    </div>
  );
});
