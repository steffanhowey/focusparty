"use client";

import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

interface StatsCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: ReactNode;
}

export function StatsCard({ label, value, sublabel, icon }: StatsCardProps) {
  return (
    <Card variant="default" className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-[var(--sg-shell-600)]">{label}</p>
          <p className="mt-1 text-2xl font-bold text-[var(--sg-shell-900)]">
            {value}
          </p>
          {sublabel && (
            <p className="mt-0.5 text-xs text-[var(--sg-shell-500)]">
              {sublabel}
            </p>
          )}
        </div>
        {icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--sg-shell-100)] text-[var(--sg-shell-600)]">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
