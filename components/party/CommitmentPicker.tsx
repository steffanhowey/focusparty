"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, User, Users, Lock } from "lucide-react";
import type { CommitmentType } from "@/lib/types";

interface CommitmentPickerProps {
  value: CommitmentType;
  onChange: (type: CommitmentType) => void;
  accentColor: string;
}

const OPTIONS: { type: CommitmentType; icon: typeof User; label: string; desc: string }[] = [
  { type: "personal", icon: User, label: "Personal (Default)", desc: "Private focus commitment" },
  { type: "social", icon: Users, label: "Social", desc: "Room sees your commitment" },
  { type: "locked", icon: Lock, label: "Locked In", desc: "Must resolve before leaving" },
];

export function CommitmentPicker({ value, onChange, accentColor }: CommitmentPickerProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selected = OPTIONS.find((o) => o.type === value) ?? OPTIONS[0];

  useEffect(() => {
    setMounted(true);
  }, []);

  // Position dropdown below trigger
  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
  }, [open]);

  // Click outside to close
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

  const handleSelect = useCallback(
    (type: CommitmentType) => {
      onChange(type);
      setOpen(false);
    },
    [onChange]
  );

  const SelectedIcon = selected.icon;

  const dropdown = open ? (
    <div
      ref={dropdownRef}
      className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-dropdown)] p-1.5 shadow-lg backdrop-blur-[20px]"
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        width: pos.width,
        zIndex: 9999,
      }}
    >
      {OPTIONS.map(({ type, icon: Icon, label, desc }) => (
        <button
          key={type}
          type="button"
          onClick={() => handleSelect(type)}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06]"
        >
          <Icon size={14} strokeWidth={1.5} className="shrink-0 text-[var(--color-text-tertiary)]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">{label}</p>
            <p className="text-2xs text-[var(--color-text-tertiary)]">{desc}</p>
          </div>
          {value === type && (
            <Check
              size={14}
              strokeWidth={2}
              className="shrink-0 text-[var(--color-accent-primary)]"
            />
          )}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div className="px-5 pt-4">
      <label className="mb-2 block text-sm font-semibold text-white">
        Commitment Level
      </label>
      <div ref={triggerRef}>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="relative flex h-10 w-full cursor-pointer items-center gap-2 rounded-full border border-[var(--color-border-default)] bg-white/[0.06] px-4 pr-9 text-sm transition-colors hover:border-[var(--color-border-focus)] focus:border-[var(--color-border-focus)] focus:outline-none"
        >
          <SelectedIcon size={14} strokeWidth={1.5} className="shrink-0 text-[var(--color-text-tertiary)]" />
          <span className="truncate text-[var(--color-text-secondary)]">
            {selected.label}
          </span>
          <ChevronDown
            size={14}
            strokeWidth={1.5}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]"
          />
        </button>

        {mounted && dropdown && createPortal(dropdown, document.body)}
      </div>
    </div>
  );
}
