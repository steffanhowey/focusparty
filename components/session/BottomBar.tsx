"use client";

interface BottomBarProps {
  onEndSession?: () => void;
}

export function BottomBar({ onEndSession }: BottomBarProps) {
  return (
    <footer
      className="relative flex flex-shrink-0 items-center justify-between px-4 py-3"
      style={{
        background: "rgba(13,14,32,0.7)",
        backdropFilter: "blur(12px)",
        zIndex: 20,
      }}
    >
      {/* Left */}
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          className="rounded-full border border-[var(--color-border-default)] px-3.5 py-1.5 text-xs text-[var(--color-text-tertiary)] transition-colors hover:border-[var(--color-border-default)] hover:bg-white/5"
        >
          Still on track?
        </button>
      </div>

      {/* Right: end session */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onEndSession}
          className="px-3 py-1.5 text-xs text-[var(--color-coral-700)] transition-colors hover:text-[var(--color-coral-500)]"
        >
          End session
        </button>
      </div>
    </footer>
  );
}
