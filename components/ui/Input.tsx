"use client";

import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "session";
  className?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ variant = "default", className = "", ...props }, ref) => {
    const base =
      "text-white outline-none transition-[border-color] duration-150 placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-focus)]";
    const defaultStyles =
      "h-11 rounded-md border border-[var(--color-border-default)] bg-white/[0.06] px-4 focus:shadow-[0_0_0_1px_var(--color-border-focus)]";
    const sessionStyles =
      "h-10 rounded-full border border-[var(--color-border-default)] bg-white/[0.08] px-4";

    const styleClass =
      variant === "session" ? sessionStyles : defaultStyles;

    return (
      <input
        ref={ref}
        className={`${base} ${styleClass} ${className}`}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
