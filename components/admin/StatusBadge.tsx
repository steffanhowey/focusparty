"use client";

const STATUS_COLORS: Record<string, string> = {
  active: "#5BC682",
  waiting: "#eab308",
  completed: "#888888",
  candidate: "#eab308",
  approved: "#5BC682",
  archived: "#888888",
  todo: "#888888",
  in_progress: "#7c5cfc",
  done: "#5BC682",
};

interface StatusBadgeProps {
  status: string;
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const color = STATUS_COLORS[status] ?? "#888888";
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
