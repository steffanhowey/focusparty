"use client";

import type { TaskPriority } from "@/lib/types";
import { PRIORITY_CONFIG } from "@/lib/taskConstants";

interface PriorityIconProps {
  priority: TaskPriority;
  size?: number;
}

export function PriorityIcon({ priority, size = 14 }: PriorityIconProps) {
  if (priority === "none") return null;
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center font-medium"
      style={{ color: cfg.color, fontSize: size }}
      title={cfg.label}
    >
      {cfg.icon}
    </span>
  );
}
