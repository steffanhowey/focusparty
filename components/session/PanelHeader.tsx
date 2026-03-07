"use client";

import { X } from "lucide-react";

interface PanelHeaderProps {
  title: string;
  onClose: () => void;
}

export function PanelHeader({ title, onClose }: PanelHeaderProps) {
  return (
    <div className="flex h-20 items-center justify-between px-4 md:px-6" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>
      <span className="text-base font-semibold text-white">{title}</span>
      <button
        type="button"
        onClick={onClose}
        className="cursor-pointer rounded-lg p-1.5 text-[var(--color-text-tertiary)] transition-colors hover:bg-white/10 hover:text-white"
        aria-label={`Close ${title.toLowerCase()}`}
      >
        <X size={18} strokeWidth={2} />
      </button>
    </div>
  );
}
