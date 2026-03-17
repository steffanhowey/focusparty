"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Plus, Check, Folder } from "lucide-react";
import type { Project } from "@/lib/types";

interface ProjectPickerProps {
  value: string | null;
  onChange: (projectId: string | null) => void;
  projects: Project[];
  onCreateProject: (input: {
    name: string;
    color: string;
    emoji: string;
  }) => Promise<Project | undefined>;
}

export function ProjectPicker({
  value,
  onChange,
  projects,
  onCreateProject,
}: ProjectPickerProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = projects.find((p) => p.id === value);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Position dropdown below trigger
  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
  }, [open]);

  // Click outside to close — check both trigger and portal dropdown
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
      setCreating(false);
      setNewName("");
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  // Focus input when entering create mode
  useEffect(() => {
    if (creating) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [creating]);

  const handleSelect = useCallback(
    (projectId: string | null) => {
      onChange(projectId);
      setOpen(false);
    },
    [onChange]
  );

  const handleStartCreate = useCallback(() => {
    setCreating(true);
    setNewName("");
  }, []);

  const handleCreate = useCallback(async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const created = await onCreateProject({
      name: trimmed,
      color: "var(--sg-teal-600)",
      emoji: "",
    });
    if (created) {
      onChange(created.id);
    }
    setCreating(false);
    setNewName("");
    setOpen(false);
  }, [newName, onCreateProject, onChange]);

  const handleCancelCreate = useCallback(() => {
    setCreating(false);
    setNewName("");
  }, []);

  const dropdown = open ? (
    <div
      ref={dropdownRef}
      className="rounded-lg border border-[var(--sg-shell-border)] bg-white p-1.5 shadow-lg"
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        width: pos.width,
        zIndex: 9999,
      }}
    >
      {creating ? (
        /* Create mode */
        <div className="space-y-2.5 p-2">
          <input
            ref={inputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") handleCancelCreate();
            }}
            placeholder="Project name"
            className="h-9 w-full rounded-full border border-[var(--sg-shell-border)] bg-[var(--sg-shell-50)] px-3 text-sm text-[var(--sg-shell-900)] placeholder:text-[var(--sg-shell-400)] focus:border-[var(--sg-forest-400)] focus:outline-none"
          />

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCancelCreate}
              className="rounded-full px-3 py-1.5 text-xs text-[var(--sg-shell-500)] transition-colors hover:text-[var(--sg-shell-600)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-40"
              style={{ background: "var(--sg-forest-500)" }}
            >
              Create
            </button>
          </div>
        </div>
      ) : (
        /* List mode */
        <>
          {/* No project option */}
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className="flex w-full items-center gap-2 rounded-full px-3 py-2 text-sm text-[var(--sg-shell-600)] transition-colors hover:bg-[var(--sg-shell-100)]"
          >
            {value === null && (
              <Check
                size={14}
                strokeWidth={2}
                className="shrink-0 text-[var(--sg-forest-500)]"
              />
            )}
            <span className={value === null ? "" : "pl-[22px]"}>
              No project
            </span>
          </button>

          {/* Existing projects */}
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelect(p.id)}
              className="flex w-full items-center gap-2 rounded-full px-3 py-2 text-sm text-[var(--sg-shell-600)] transition-colors hover:bg-[var(--sg-shell-100)]"
            >
              {value === p.id ? (
                <Check
                  size={14}
                  strokeWidth={2}
                  className="shrink-0 text-[var(--sg-forest-500)]"
                />
              ) : (
                <span className="w-[14px] shrink-0" />
              )}
              <Folder size={14} strokeWidth={1.5} className="shrink-0 text-[var(--sg-shell-500)]" />
              <span className="truncate">{p.name}</span>
            </button>
          ))}

          {/* Divider + Create */}
          <div className="my-1 h-px bg-[var(--sg-shell-border)]" />
          <button
            type="button"
            onClick={handleStartCreate}
            className="flex w-full items-center gap-2 rounded-full px-3 py-2 text-sm text-[var(--sg-shell-500)] transition-colors hover:bg-[var(--sg-shell-100)] hover:text-[var(--sg-shell-600)]"
          >
            <Plus size={14} strokeWidth={2} className="shrink-0" />
            <span>Create project</span>
          </button>
        </>
      )}
    </div>
  ) : null;

  return (
    <div ref={triggerRef}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex h-10 w-full cursor-pointer items-center gap-2 rounded-full border border-[var(--sg-shell-border)] bg-[var(--sg-shell-50)] px-4 pr-9 text-sm transition-colors hover:border-[var(--sg-forest-400)] focus:border-[var(--sg-forest-400)] focus:outline-none"
      >
        {selected ? (
          <>
            <Folder size={14} strokeWidth={1.5} className="shrink-0 text-[var(--sg-shell-500)]" />
            <span className="truncate text-[var(--sg-shell-600)]">
              {selected.name}
            </span>
          </>
        ) : (
          <span className="text-[var(--sg-shell-400)]">No project</span>
        )}
        <ChevronDown
          size={14}
          strokeWidth={1.5}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--sg-shell-400)]"
        />
      </button>

      {/* Portal dropdown — renders outside modal to avoid overflow clipping */}
      {mounted && dropdown && createPortal(dropdown, document.body)}
    </div>
  );
}
