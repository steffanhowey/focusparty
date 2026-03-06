"use client";

interface BottomBarProps {
  onEndSession?: () => void;
}

export function BottomBar({ onEndSession }: BottomBarProps) {
  return (
    <footer
      className="flex min-h-[52px] flex-shrink-0 flex-col items-stretch justify-center gap-3 border-t border-[var(--color-border-subtle)] px-4 py-3 md:h-[52px] md:flex-row md:items-center md:justify-between md:py-0 md:px-6"
      style={{
        background: "rgba(13,14,32,0.7)",
        backdropFilter: "blur(12px)",
        zIndex: 20,
      }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <input
          type="text"
          placeholder="Type a message..."
          className="max-w-full flex-1 rounded-full border border-[var(--color-border-subtle)] bg-white/5 px-4 py-2 text-sm text-white placeholder:text-[var(--color-text-tertiary)] outline-none transition-[border-color] focus:border-[var(--color-border-focus)] md:max-w-[400px]"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="rounded-full border border-[var(--color-border-default)] px-3.5 py-1.5 text-xs text-[var(--color-text-tertiary)] transition-colors hover:border-[var(--color-border-default)] hover:bg-white/5"
        >
          Still on track?
        </button>
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
