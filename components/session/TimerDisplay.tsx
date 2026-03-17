"use client";

interface TimerDisplayProps {
  formatted: string;
  phase: "sprint" | "setup" | "review" | "break";
  /** When true, apply warning color (e.g. < 5 min) */
  warning?: boolean;
  /** When true, apply critical color (e.g. < 1 min) */
  critical?: boolean;
}

export function TimerDisplay({
  formatted,
  phase,
  warning = false,
  critical = false,
}: TimerDisplayProps) {
  const colorClass = critical
    ? "text-[var(--sg-coral-500)]"
    : warning
      ? "text-[var(--sg-gold-500)]"
      : "text-white";

  const sizeClass =
    phase === "sprint" ? "text-3xl md:text-4xl" : "text-base";

  return (
    <span
      className={`font-extrabold tracking-tight ${sizeClass} ${colorClass}`}
    >
      {formatted}
    </span>
  );
}
