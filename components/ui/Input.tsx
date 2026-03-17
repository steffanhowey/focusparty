"use client";

import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "session";
  className?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ variant = "default", className = "", ...props }, ref) => {
    const base =
      "text-shell-900 outline-none transition-[border-color] duration-150 placeholder:text-shell-500 focus:border-forest-400";
    const defaultStyles =
      "h-11 rounded-[var(--sg-radius-md)] border border-shell-border bg-shell-50 px-4 focus:shadow-[var(--sg-shadow-focus)]";
    const sessionStyles =
      "h-10 rounded-full border border-shell-border bg-shell-100 px-4";

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
