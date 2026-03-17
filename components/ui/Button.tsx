"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "cta" | "link";
type ButtonSize = "xs" | "sm" | "default";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Render as a full-width block button */
  fullWidth?: boolean;
  /** Icon placed before children */
  leftIcon?: ReactNode;
  /** Icon placed after children */
  rightIcon?: ReactNode;
  /** Show a loading spinner and disable interaction */
  loading?: boolean;
  children: ReactNode;
  className?: string;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "rounded-[var(--sg-radius-btn)] bg-forest-500 text-white transition-all duration-150 hover:opacity-85 active:opacity-75",
  secondary:
    "rounded-[var(--sg-radius-btn)] border border-forest-500 bg-transparent text-forest-500 transition-colors duration-150 hover:bg-forest-500/10",
  outline:
    "rounded-[var(--sg-radius-btn)] border border-shell-border bg-transparent text-shell-600 transition-colors duration-150 hover:border-forest-400 hover:text-shell-900",
  ghost:
    "rounded-[var(--sg-radius-btn)] bg-transparent text-shell-600 transition-colors duration-150 hover:bg-shell-100",
  danger:
    "rounded-[var(--sg-radius-btn)] bg-transparent text-sg-coral-500 transition-colors duration-150 hover:bg-sg-coral-500/10",
  cta:
    "rounded-[var(--sg-radius-btn)] bg-forest-500 font-semibold text-white transition-all duration-150 hover:opacity-85 hover:scale-[1.02] active:scale-[0.98] active:opacity-75",
  link:
    "bg-transparent text-forest-500 transition-colors duration-150 hover:underline",
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: "h-8 px-3 text-xs",
  sm: "h-9 px-4 text-sm",
  default: "h-12 px-6 text-sm",
};

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function Button({
  variant = "primary",
  size = "default",
  fullWidth,
  leftIcon,
  rightIcon,
  loading,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type="button"
      className={`inline-flex items-center gap-2 whitespace-nowrap cursor-pointer font-medium disabled:cursor-not-allowed disabled:opacity-50 ${sizeStyles[size]} ${variantStyles[variant]} ${fullWidth ? "w-full justify-center" : ""} ${className}`}
      disabled={isDisabled}
      {...props}
    >
      {loading ? <Spinner /> : leftIcon}
      {children}
      {rightIcon}
    </button>
  );
}
