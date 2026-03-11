"use client";

import { Music } from "lucide-react";

interface JoinCountdownScreenProps {
  countdownNumber: number;
  musicEnabled: boolean;
  onToggleMusic: () => void;
}

export function JoinCountdownScreen({
  countdownNumber,
  musicEnabled,
  onToggleMusic,
}: JoinCountdownScreenProps) {
  return (
    <div
      className="flex h-full flex-col items-center justify-center px-5"
      style={{ animation: "fp-setup-enter 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
    >
      {/* Countdown number */}
      <div
        key={countdownNumber}
        className="animate-countdown-pop select-none text-8xl font-bold text-white"
        style={{ fontFamily: "var(--font-montserrat), sans-serif" }}
      >
        {countdownNumber}
      </div>

      {/* Subtitle */}
      <p className="mt-4 text-sm text-white/50">
        Get ready to focus
      </p>

      {/* Progress dots */}
      <div className="mt-6 flex items-center gap-2">
        {[5, 4, 3, 2, 1].map((n) => {
          const isCompleted = n > countdownNumber;
          const isActive = n === countdownNumber;
          return (
            <div
              key={n}
              className="h-2 w-2 rounded-full transition-all duration-300"
              style={{
                background: isCompleted
                  ? "var(--color-accent-primary)"
                  : isActive
                    ? "var(--color-accent-primary)"
                    : "rgba(255,255,255,0.12)",
                opacity: isActive ? 1 : isCompleted ? 0.6 : 1,
                transform: isActive ? "scale(1.3)" : "scale(1)",
              }}
            />
          );
        })}
      </div>

      {/* Music toggle */}
      <button
        type="button"
        onClick={onToggleMusic}
        className="mt-8 flex cursor-pointer items-center gap-2.5 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200"
        style={{
          background: musicEnabled ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.04)",
          border: musicEnabled
            ? "1px solid rgba(255,255,255,0.15)"
            : "1px solid rgba(255,255,255,0.08)",
          color: musicEnabled ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.40)",
        }}
        aria-label={musicEnabled ? "Disable music" : "Enable music"}
        aria-pressed={musicEnabled}
      >
        <Music size={15} strokeWidth={2} />
        <span>{musicEnabled ? "Music on" : "Music off"}</span>

        {/* Mini toggle indicator */}
        <div
          className="relative ml-1 h-4 w-7 rounded-full transition-colors duration-200"
          style={{
            background: musicEnabled
              ? "var(--color-accent-primary)"
              : "rgba(255,255,255,0.12)",
          }}
        >
          <div
            className="absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform duration-200"
            style={{
              transform: musicEnabled ? "translateX(12px)" : "translateX(2px)",
            }}
          />
        </div>
      </button>
    </div>
  );
}
