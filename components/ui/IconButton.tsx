"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonVariant = "ghost" | "outline" | "danger";
type IconButtonSize = "xs" | "sm" | "default";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  /** The icon element */
  icon: ReactNode;
  /** Accessible label (required since there is no visible text) */
  "aria-label": string;
  /** Active/pressed state for toggles */
  active?: boolean;
  className?: string;
}

const variantStyles: Record<IconButtonVariant, string> = {
  ghost:
    "text-shell-600 hover:bg-shell-100 hover:text-shell-900",
  outline:
    "border border-shell-border text-shell-500 hover:bg-shell-100",
  danger:
    "text-sg-coral-500 hover:bg-sg-coral-500/10",
};

const sizeStyles: Record<IconButtonSize, string> = {
  xs: "h-6 w-6 [&_svg]:h-3.5 [&_svg]:w-3.5",
  sm: "h-8 w-8 [&_svg]:h-4 [&_svg]:w-4",
  default: "h-10 w-10 [&_svg]:h-[18px] [&_svg]:w-[18px]",
};

const ACTIVE_STYLES = "bg-shell-200 text-shell-900";

export function IconButton({
  variant = "ghost",
  size = "default",
  icon,
  active,
  className = "",
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-full cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${sizeStyles[size]} ${active ? ACTIVE_STYLES : variantStyles[variant]} ${className}`}
      {...props}
    >
      {icon}
    </button>
  );
}
