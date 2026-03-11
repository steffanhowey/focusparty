"use client";

import { Button } from "@/components/ui/Button";
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
        background: "rgba(10,10,10,0.7)",
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
        <Button variant="danger" size="xs" onClick={onEndSession}>
          End session
        </Button>
      </div>
    </footer>
  );
}
