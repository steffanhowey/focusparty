"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "cta";
type ButtonSize = "default" | "sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
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
    "rounded-full bg-transparent text-[var(--color-coral-700)] transition-colors duration-150 hover:bg-[var(--color-coral-200)]",
  cta:
    "rounded-full bg-[var(--color-accent-primary)] font-semibold text-white transition-all duration-150 hover:opacity-85 hover:scale-[1.02] active:scale-[0.98] active:opacity-75",
};

const sizeStyles: Record<ButtonSize, string> = {
  default: "h-12 px-6",
  sm: "h-9 px-4 text-sm",
};

export function Button({
  variant = "primary",
  size = "default",
  children,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`cursor-pointer font-medium disabled:cursor-not-allowed ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      style={{ fontFamily: "var(--font-montserrat), sans-serif" }}
      {...props}
    >
      {children}
    </button>
  );
}
