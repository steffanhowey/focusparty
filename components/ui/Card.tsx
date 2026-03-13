"use client";

import { HTMLAttributes, ReactNode } from "react";
import type { CharacterId } from "@/lib/types";
import { CHARACTERS } from "@/lib/constants";

type CardVariant = "default" | "session" | "character";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  character?: CharacterId;
  children: ReactNode;
  className?: string;
}

const variantStyles: Record<CardVariant, string> = {
  default:
    "rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] transition-shadow hover:border-[var(--color-border-default)]",
  session:
    "rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)]",
  character:
    "rounded-lg border-b-4 border-transparent bg-[var(--color-bg-hover)]",
};

export function Card({
  variant = "default",
  character,
  children,
  className = "",
  style: styleProp,
  ...rest
}: CardProps) {
  const style =
    variant === "character" && character
      ? { ...styleProp, borderBottomColor: CHARACTERS[character].primary }
      : styleProp;

  return (
    <div
      className={`${variantStyles[variant]} ${className}`}
      style={style}
      {...rest}
    >
      {children}
    </div>
  );
}
