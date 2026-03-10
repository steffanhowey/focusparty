"use client";

import { type LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  color = "var(--color-accent-primary)",
}: StatCardProps) {
  return (
    <div
      className="rounded-xl border border-[var(--color-border-default)] p-5"
      style={{ background: "var(--color-bg-elevated)" }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
            {label}
          </p>
          <p
            className="mt-2 text-3xl font-bold text-[var(--color-text-primary)]"
            style={{ fontFamily: "var(--font-montserrat), sans-serif" }}
          >
            {value}
          </p>
        </div>
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          style={{ background: `${color}18` }}
        >
          <Icon size={20} strokeWidth={1.8} style={{ color }} />
        </div>
      </div>
    </div>
  );
}
