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
    ? "text-sg-coral-500 hover:bg-sg-coral-500/10"
    : active
      ? "bg-[var(--sg-forest-500)]/20 text-[var(--sg-shell-900)] ring-1 ring-[var(--sg-forest-500)]/40"
      : "text-[var(--sg-shell-600)] hover:bg-[var(--sg-shell-100)] hover:text-[var(--sg-shell-900)]";

  return (
    <button
      type="button"
      className={`flex w-full cursor-pointer items-center rounded-[var(--sg-radius-md)] px-3 py-2 text-left font-medium transition-colors ${sizeStyles[size]} ${stateStyles} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
}
