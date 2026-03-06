"use client";

interface TimerDisplayProps {
  formatted: string;
  phase: "sprint" | "goal" | "review" | "break";
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
    ? "text-[var(--color-coral-700)]"
    : warning
      ? "text-[var(--color-gold-500)]"
      : "text-white";

  const sizeClass =
    phase === "sprint" ? "text-[28px] md:text-[36px]" : "text-base";

  return (
    <span
      className={`font-extrabold tracking-tight ${sizeClass} ${colorClass}`}
      style={{ fontFamily: "var(--font-montserrat), sans-serif" }}
    >
      {formatted}
    </span>
  );
}
