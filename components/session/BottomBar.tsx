"use client";

import type { Task } from "@/lib/types";

interface BottomBarProps {
  activeTask: Task | null;
  onEndSession?: () => void;
}

export function BottomBar({ activeTask, onEndSession }: BottomBarProps) {
  return (
    <footer
      className="relative flex h-14 flex-shrink-0 items-center justify-between px-4 md:px-6"
      style={{
        background: "rgba(13,14,32,0.7)",
        backdropFilter: "blur(12px)",
        zIndex: 20,
      }}
    >
      {/* Left: active task display */}
      <div className="flex min-w-0 items-center gap-2.5">
        {activeTask ? (
          <span className="truncate text-sm text-[var(--color-text-secondary)]">
            {activeTask.text}
          </span>
        ) : (
          <span className="text-xs text-[var(--color-text-tertiary)]">
            No task in progress
          </span>
        )}
      </div>

      {/* Right: end session */}
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={onEndSession}
          className="px-3 py-1.5 text-xs text-[var(--color-coral-700)] transition-colors hover:text-[var(--color-coral-500)]"
        >
          End session
        </button>
      </div>
    </footer>
  );
}
