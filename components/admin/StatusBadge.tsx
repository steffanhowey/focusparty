"use client";

import {
  STATUS_TODO,
  STATUS_IN_PROGRESS,
  STATUS_DONE,
  SHELL_500,
  SHELL_300,
  FOREST_300,
  CORAL_500,
  PRIORITY_MEDIUM,
} from "@/lib/palette";

const STATUS_COLORS: Record<string, string> = {
  active: FOREST_300,
  waiting: PRIORITY_MEDIUM,
  completed: SHELL_500,
  candidate: PRIORITY_MEDIUM,
  approved: FOREST_300,
  archived: SHELL_500,
  todo: STATUS_TODO,
  in_progress: STATUS_IN_PROGRESS,
  done: STATUS_DONE,
  // Pipeline & review statuses
  pending: PRIORITY_MEDIUM,
  rejected: CORAL_500,
  failed: CORAL_500,
  running: FOREST_300,
  partial: PRIORITY_MEDIUM,
  expired: SHELL_500,
  // Topic heat statuses
  hot: CORAL_500,
  emerging: PRIORITY_MEDIUM,
  cooling: SHELL_300,
  cold: SHELL_500,
  // Blueprint draft
  draft: SHELL_300,
  // Health
  healthy: FOREST_300,
  degraded: PRIORITY_MEDIUM,
  critical: CORAL_500,
};

interface StatusBadgeProps {
  status: string;
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const color = STATUS_COLORS[status] ?? SHELL_500;
  const displayLabel = label ?? status.replace(/_/g, " ");

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize"
      style={{
        background: `${color}18`,
        color,
      }}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: color }}
      />
      {displayLabel}
    </span>
  );
}
