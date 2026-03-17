"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

interface ToggleCardProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Whether this card is in the selected state */
  selected?: boolean;
  children: ReactNode;
  className?: string;
}

export function ToggleCard({
  selected,
  children,
  className = "",
  ...props
}: ToggleCardProps) {
  return (
    <button
      type="button"
      className={`cursor-pointer rounded-[var(--sg-radius-md)] border px-3 py-2.5 text-left transition-all duration-150 ${
        selected
          ? "border-forest-500 bg-forest-500/10"
          : "border-shell-border hover:border-forest-400"
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
