"use client";

import { HTMLAttributes, ReactNode } from "react";

type CardVariant = "default" | "session" | "character";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  /** @deprecated Character theming retired */
  character?: string;
  children: ReactNode;
  className?: string;
}

const variantStyles: Record<CardVariant, string> = {
  default:
    "rounded-[var(--sg-radius-md)] border border-shell-border bg-white shadow-sm transition-shadow",
  session:
    "rounded-[var(--sg-radius-lg)] border border-shell-border bg-shell-50",
  /** @deprecated Alias for default — character theming retired */
  character:
    "rounded-[var(--sg-radius-md)] border border-shell-border bg-shell-100",
};

export function Card({
  variant = "default",
  children,
  className = "",
  ...rest
}: CardProps) {
  return (
    <div
      className={`${variantStyles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
