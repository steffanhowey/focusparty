"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "cta" | "link";
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
    "rounded-full bg-[var(--color-accent-primary)] text-white transition-all duration-150 hover:opacity-85 active:opacity-75",
  secondary:
    "rounded-full border border-[var(--color-accent-primary)] bg-transparent text-[var(--color-accent-primary)] transition-colors duration-150 hover:bg-[var(--color-accent-primary)]/10",
  ghost:
    "rounded-full bg-transparent text-[var(--color-text-secondary)] transition-colors duration-150 hover:bg-[var(--color-bg-hover)]",
  danger:
    "rounded-full bg-transparent text-[var(--color-coral-700)] transition-colors duration-150 hover:bg-[var(--color-coral-700)]/10",
  cta:
    "rounded-full bg-[var(--color-accent-primary)] font-semibold text-white transition-all duration-150 hover:opacity-85 hover:scale-[1.02] active:scale-[0.98] active:opacity-75",
  link:
    "bg-transparent text-[var(--color-accent-primary)] transition-colors duration-150 hover:underline",
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: "h-8 px-3 text-xs",
  sm: "h-9 px-4 text-sm",
  default: "h-12 px-6",
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
      style={{ fontFamily: "var(--font-montserrat), sans-serif" }}
      disabled={isDisabled}
      {...props}
    >
      {loading ? <Spinner /> : leftIcon}
      {children}
      {rightIcon}
    </button>
  );
}
