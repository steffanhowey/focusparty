"use client";

import {
  STATUS_TODO,
  STATUS_IN_PROGRESS,
  STATUS_DONE,
  NAVY_500,
  NAVY_400,
  GREEN_700,
  CORAL_700,
  PRIORITY_MEDIUM,
} from "@/lib/palette";

const STATUS_COLORS: Record<string, string> = {
  active: GREEN_700,
  waiting: PRIORITY_MEDIUM,
  completed: NAVY_500,
  candidate: PRIORITY_MEDIUM,
  approved: GREEN_700,
  archived: NAVY_500,
  todo: STATUS_TODO,
  in_progress: STATUS_IN_PROGRESS,
  done: STATUS_DONE,
  // Pipeline & review statuses
  pending: PRIORITY_MEDIUM,
  rejected: CORAL_700,
  failed: CORAL_700,
  running: GREEN_700,
  partial: PRIORITY_MEDIUM,
  expired: NAVY_500,
  // Topic heat statuses
  hot: CORAL_700,
  emerging: PRIORITY_MEDIUM,
  cooling: NAVY_400,
  cold: NAVY_500,
  // Blueprint draft
  draft: NAVY_400,
  // Health
  healthy: GREEN_700,
  degraded: PRIORITY_MEDIUM,
  critical: CORAL_700,
};

interface StatusBadgeProps {
  status: string;
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const color = STATUS_COLORS[status] ?? NAVY_500;
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
