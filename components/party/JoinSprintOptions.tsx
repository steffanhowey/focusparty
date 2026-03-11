"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, Clock, Timer } from "lucide-react";
import { SPRINT_DURATION_OPTIONS } from "@/lib/constants";

type SprintMode = "current" | "next" | "fresh";

function formatMinutes(seconds: number): string {
  const m = Math.ceil(seconds / 60);
  return `${m}m`;
}

interface JoinSprintOptionsProps {
  hasActiveSprint: boolean;
  remainingSeconds: number;
  focusingCount: number;
  sprintMode: SprintMode;
  onSprintModeChange: (mode: SprintMode) => void;
  freshDuration: number;
  onFreshDurationChange: (value: number) => void;
  accentColor: string;
}

export function JoinSprintOptions({
  hasActiveSprint,
  remainingSeconds,
  focusingCount,
  sprintMode,
  onSprintModeChange,
  freshDuration,
  onFreshDurationChange,
  accentColor,
}: JoinSprintOptionsProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const handleSelectSprint = useCallback(
    (mode: SprintMode) => {
      onSprintModeChange(mode);
      setOpen(false);
    },
    [onSprintModeChange]
  );

  const handleSelectDuration = useCallback(
    (duration: number) => {
      onFreshDurationChange(duration);
      setOpen(false);
    },
    [onFreshDurationChange]
  );

  /* ── Trigger display ── */

  let triggerLabel: string;
  let TriggerIcon = Timer;

  if (hasActiveSprint) {
    if (sprintMode === "current") {
      triggerLabel = `Current Sprint · ${formatMinutes(remainingSeconds)} left`;
      TriggerIcon = Timer;
    } else {
      triggerLabel = `Next Sprint · starts in ${formatMinutes(remainingSeconds)}`;
      TriggerIcon = Clock;
    }
  } else {
    triggerLabel = `${freshDuration} minutes`;
    TriggerIcon = Timer;
  }

  /* ── Dropdown content ── */

  const dropdown = open ? (
    <div
      ref={dropdownRef}
      className="rounded-2xl border border-[var(--color-border-default)] bg-[rgba(10,10,10,0.95)] p-1.5 shadow-2xl backdrop-blur-[20px]"
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        width: pos.width,
        zIndex: 9999,
      }}
    >
      {hasActiveSprint ? (
        <>
          {/* Current Sprint */}
          <button
            type="button"
            onClick={() => handleSelectSprint("current")}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06]"
          >
            {sprintMode === "current" ? (
              <Check
                size={14}
                strokeWidth={2}
                className="shrink-0 text-[var(--color-accent-primary)]"
              />
            ) : (
              <span className="w-[14px] shrink-0" />
            )}
            <Timer size={14} strokeWidth={1.5} className="shrink-0 text-[var(--color-text-tertiary)]" />
            <div>
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">Current Sprint</p>
              <p className="text-[11px] text-[var(--color-text-tertiary)]">
                {formatMinutes(remainingSeconds)} remaining · {focusingCount} focusing
              </p>
            </div>
          </button>

          {/* Next Sprint */}
          <button
            type="button"
            onClick={() => handleSelectSprint("next")}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06]"
          >
            {sprintMode === "next" ? (
              <Check
                size={14}
                strokeWidth={2}
                className="shrink-0 text-[var(--color-accent-primary)]"
              />
            ) : (
              <span className="w-[14px] shrink-0" />
            )}
            <Clock size={14} strokeWidth={1.5} className="shrink-0 text-[var(--color-text-tertiary)]" />
            <div>
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">Next Sprint</p>
              <p className="text-[11px] text-[var(--color-text-tertiary)]">
                Starts in {formatMinutes(remainingSeconds)} · Join fresh with group
              </p>
            </div>
          </button>
        </>
      ) : (
        /* Duration options */
        <>
          {SPRINT_DURATION_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => handleSelectDuration(d)}
              className="flex w-full items-center gap-2 rounded-full px-3 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-white/[0.06]"
            >
              {freshDuration === d ? (
                <Check
                  size={14}
                  strokeWidth={2}
                  className="shrink-0 text-[var(--color-accent-primary)]"
                />
              ) : (
                <span className="w-[14px] shrink-0" />
              )}
              <span>{d} minutes{d === 25 ? " (Default)" : ""}</span>
            </button>
          ))}
        </>
      )}
    </div>
  ) : null;

  return (
    <div className="px-5 pt-4">
      <label className="mb-2 block text-sm font-semibold text-white">
        {hasActiveSprint ? "Join" : "Sprint duration"}
      </label>
      <div ref={triggerRef}>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="relative flex h-10 w-full cursor-pointer items-center gap-2 rounded-full border border-[var(--color-border-default)] bg-white/[0.06] px-4 pr-9 text-sm transition-colors hover:border-[var(--color-border-focus)] focus:border-[var(--color-border-focus)] focus:outline-none"
        >
          <TriggerIcon size={14} strokeWidth={1.5} className="shrink-0 text-[var(--color-text-tertiary)]" />
          <span className="truncate text-[var(--color-text-secondary)]">
            {triggerLabel}
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
