"use client";

import { memo, useState, useRef, useEffect, useCallback } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Check } from "lucide-react";
import type { Task } from "@/lib/types";

interface SortableTaskRowProps {
  task: Task;
  onComplete: (taskId: string) => void;
  onEdit: (taskId: string, newText: string) => void;
}

export const SortableTaskRow = memo(function SortableTaskRow({
  task,
  onComplete,
  onEdit,
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
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      const id = setTimeout(() => {
        editInputRef.current?.focus();
        editInputRef.current?.select();
      }, 50);
      return () => clearTimeout(id);
    }
  }, [isEditing]);

  const startEditing = useCallback(() => {
    setIsEditing(true);
    setEditText(task.text);
  }, [task.text]);

  const commitEdit = useCallback(() => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== task.text) {
      onEdit(task.id, trimmed);
    }
    setIsEditing(false);
    setEditText("");
  }, [editText, task.text, task.id, onEdit]);

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
      className="group flex items-center gap-2 rounded-lg px-2 py-2"
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="flex shrink-0 cursor-grab touch-none items-center justify-center text-[var(--color-text-tertiary)] opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical size={14} strokeWidth={1.5} />
      </button>

      {/* Task text */}
      {isEditing ? (
        <input
          ref={editInputRef}
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitEdit();
            }
            if (e.key === "Escape") cancelEdit();
          }}
          onBlur={commitEdit}
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none"
        />
      ) : (
        <span
          className="min-w-0 flex-1 cursor-text truncate text-sm text-[var(--color-text-secondary)]"
          onClick={startEditing}
        >
          {task.text}
        </span>
      )}

      {/* Completion checkbox */}
      <button
        type="button"
        onClick={() => onComplete(task.id)}
        className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border border-[var(--color-border-default)] transition-colors hover:border-emerald-500 hover:bg-emerald-500/10"
        aria-label={`Complete ${task.text}`}
      >
        <Check
          size={11}
          strokeWidth={2.5}
          className="text-transparent transition-colors group-hover:text-transparent [*:hover>&]:text-emerald-400"
        />
      </button>
    </div>
  );
});
