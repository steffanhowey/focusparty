"use client";

import type { TaskStatus } from "@/lib/types";
import { STATUS_CONFIG } from "@/lib/taskConstants";

interface StatusPillProps {
  status: TaskStatus;
}

export function StatusPill({ status }: StatusPillProps) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        color: cfg.color,
        background: `${cfg.color}18`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: cfg.color }}
      />
      {cfg.label}
    </span>
  );
}
