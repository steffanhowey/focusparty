"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, ListChecks } from "lucide-react";
import type { TaskRecord } from "@/lib/types";

interface TaskPickerProps {
  value: string[];
  onChange: (taskIds: string[]) => void;
  tasks: TaskRecord[];
}

export function TaskPicker({ value, onChange, tasks }: TaskPickerProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      )
        return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  const toggle = useCallback(
    (taskId: string) => {
      if (value.includes(taskId)) {
        onChange(value.filter((id) => id !== taskId));
      } else {
        onChange([...value, taskId]);
      }
    },
    [value, onChange]
  );

  const label =
    value.length === 0
      ? "No tasks"
      : value.length === 1
        ? "1 task"
        : `${value.length} tasks`;

  const dropdown = open ? (
    <div
      ref={dropdownRef}
      className="max-h-48 overflow-y-auto rounded-2xl border border-[var(--color-border-default)] bg-[rgba(10,10,10,0.95)] p-1.5 shadow-2xl backdrop-blur-[20px]"
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        width: pos.width,
        zIndex: 9999,
      }}
    >
      {tasks.length === 0 ? (
        <p className="px-3 py-2 text-xs text-[var(--color-text-tertiary)]">
          No unassigned tasks
        </p>
      ) : (
        tasks.map((t) => {
          const selected = value.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => toggle(t.id)}
              className="flex w-full items-center gap-2 rounded-full px-3 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-white/[0.06]"
            >
              {selected ? (
                <Check
                  size={14}
                  strokeWidth={2}
                  className="shrink-0 text-[var(--color-accent-primary)]"
                />
              ) : (
                <span className="w-[14px] shrink-0" />
              )}
              <span className="truncate">{t.title}</span>
            </button>
          );
        })
      )}
    </div>
  ) : null;

  return (
    <div ref={triggerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex h-10 w-full cursor-pointer items-center gap-2 rounded-full border border-[var(--color-border-default)] bg-white/[0.06] px-4 pr-9 text-sm transition-colors hover:border-[var(--color-border-focus)] focus:border-[var(--color-border-focus)] focus:outline-none"
      >
        <ListChecks
          size={14}
          strokeWidth={1.5}
          className="shrink-0 text-[var(--color-text-tertiary)]"
        />
        <span
          className={
            value.length > 0
              ? "truncate text-[var(--color-text-secondary)]"
              : "text-[var(--color-text-tertiary)]"
          }
        >
          {label}
        </span>
        <ChevronDown
          size={14}
          strokeWidth={1.5}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]"
        />
      </button>

      {mounted && dropdown && createPortal(dropdown, document.body)}
    </div>
  );
}
