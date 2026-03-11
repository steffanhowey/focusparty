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
      className={`cursor-pointer rounded-[var(--radius-md)] border px-3 py-2.5 text-left transition-all duration-150 ${
        selected
          ? "border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10"
          : "border-[var(--color-border-default)] hover:border-[var(--color-border-focus)]"
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
