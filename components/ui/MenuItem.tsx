"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

type MenuItemSize = "sm" | "default";

interface MenuItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Icon rendered before the label */
  icon?: ReactNode;
  /** Destructive action styling */
  danger?: boolean;
  /** Active/selected state */
  active?: boolean;
  /** Size variant — "sm" for popovers, "default" for sidebar menus */
  size?: MenuItemSize;
  children: ReactNode;
  className?: string;
}

const sizeStyles: Record<MenuItemSize, string> = {
  sm: "text-xs gap-2.5",
  default: "text-sm gap-3",
};

export function MenuItem({
  icon,
  danger,
  active,
  size = "sm",
  children,
  className = "",
  ...props
}: MenuItemProps) {
  const stateStyles = danger
    ? "text-[var(--color-coral-700)] hover:bg-[var(--color-coral-700)]/10"
    : active
      ? "bg-[var(--color-accent-primary)]/20 text-white ring-1 ring-[var(--color-accent-primary)]/40"
      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-white";

  return (
    <button
      type="button"
      className={`flex w-full cursor-pointer items-center rounded-lg px-3 py-2 text-left font-medium transition-colors ${sizeStyles[size]} ${stateStyles} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
}
