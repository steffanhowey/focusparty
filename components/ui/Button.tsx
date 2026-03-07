"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "cta";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
  className?: string;
}

const variantStyles: Record<
  ButtonVariant,
  string
> = {
  primary:
    "h-12 rounded-full bg-[var(--color-accent-primary)] px-6 text-white transition-all duration-150 hover:bg-[var(--color-purple-800)] hover:shadow-[var(--shadow-glow-purple)] active:bg-[var(--color-purple-900)]",
  secondary:
    "h-12 rounded-full border border-[var(--color-accent-primary)] bg-transparent text-[var(--color-accent-primary)] transition-colors duration-150 hover:bg-[var(--color-purple-200)]",
  ghost:
    "h-12 rounded-full bg-transparent text-[var(--color-text-secondary)] transition-colors duration-150 hover:bg-[var(--color-bg-hover)]",
  danger:
    "h-12 rounded-full bg-transparent text-[var(--color-coral-700)] transition-colors duration-150 hover:bg-[var(--color-coral-200)]",
  cta:
    "h-14 rounded-full bg-[var(--color-accent-primary)] px-8 font-semibold text-white transition-all duration-150 hover:scale-[1.02] hover:shadow-[var(--shadow-glow-purple)] active:scale-[0.98]",
};

export function Button({
  variant = "primary",
  children,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`cursor-pointer font-medium disabled:cursor-not-allowed ${variantStyles[variant]} ${className}`}
      style={{ fontFamily: "var(--font-montserrat), sans-serif" }}
      {...props}
    >
      {children}
    </button>
  );
}
