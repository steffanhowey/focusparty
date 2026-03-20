"use client";

import type { ReactNode } from "react";

interface BoardItemFrameProps {
  children: ReactNode;
  className?: string;
}

/**
 * Shared board-item shell used by goal and mission boards so queue cards match
 * the canonical kanban card treatment.
 */
export function BoardItemFrame({
  children,
  className = "",
}: BoardItemFrameProps) {
  return (
    <div
      className={`w-full rounded-sm border border-[var(--sg-shell-border)] bg-white p-3 text-left transition-shadow hover:shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}
