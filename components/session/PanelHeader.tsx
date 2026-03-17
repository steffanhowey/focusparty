"use client";

import { X } from "lucide-react";

interface PanelHeaderProps {
  title: string;
  subtitle?: string | null;
  onClose: () => void;
}

export function PanelHeader({ title, subtitle, onClose }: PanelHeaderProps) {
  return (
    <div className={`flex ${subtitle ? "h-20" : "h-20"} items-center justify-between px-4 md:px-6`}>
      <div className="min-w-0">
        <span className="text-base font-semibold text-white">{title}</span>
        {subtitle && (
          <p className="mt-0.5 text-2xs text-[var(--sg-shell-500)]">{subtitle}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="cursor-pointer rounded-lg p-1.5 text-[var(--sg-shell-500)] transition-colors hover:bg-white/10 hover:text-white"
        aria-label={`Close ${title.toLowerCase()}`}
      >
        <X size={18} strokeWidth={2} />
      </button>
    </div>
  );
}
