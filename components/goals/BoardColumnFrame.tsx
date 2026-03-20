"use client";

import type { ReactNode } from "react";

interface BoardColumnFrameProps {
  label: string;
  count: number;
  labelColor?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Shared kanban column shell used by goal and mission boards so they keep the
 * same board language.
 */
export function BoardColumnFrame({
  label,
  count,
  labelColor = "var(--sg-shell-900)",
  children,
  className = "",
}: BoardColumnFrameProps) {
  return (
    <div
      className={`flex min-w-0 flex-1 basis-0 flex-col rounded-md bg-[var(--sg-shell-100)] p-3 ${className}`}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-medium" style={{ color: labelColor }}>
          {label}
        </span>
        <span className="text-xs text-[var(--sg-shell-500)]">
          {count}
        </span>
      </div>

      <div className="flex min-h-[80px] flex-1 flex-col gap-2.5 rounded-lg">
        {children}
      </div>
    </div>
  );
}
