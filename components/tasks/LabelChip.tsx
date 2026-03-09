"use client";

import type { Label } from "@/lib/types";

interface LabelChipProps {
  label: Label;
}

export function LabelChip({ label }: LabelChipProps) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
      style={{
        color: label.color,
        background: `${label.color}18`,
      }}
    >
      {label.name}
    </span>
  );
}
