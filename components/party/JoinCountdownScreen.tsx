"use client";

interface JoinCountdownScreenProps {
  countdownNumber: number;
}

export function JoinCountdownScreen({ countdownNumber }: JoinCountdownScreenProps) {
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
    </div>
  );
}
