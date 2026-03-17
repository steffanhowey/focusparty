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
  color = "var(--sg-forest-500)",
}: StatCardProps) {
  return (
    <div
      className="rounded-xl border border-white/[0.08] p-5"
      style={{ background: "rgba(20,20,20,0.6)" }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--sg-shell-500)]">
            {label}
          </p>
          <p
            className="mt-2 text-3xl font-bold text-[var(--sg-white)]"
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
