"use client";

import { PanelRight } from "lucide-react";
import type { SessionPhase } from "@/lib/types";
import { TimerDropdown } from "./TimerDropdown";

interface TopBarProps {
  phase: SessionPhase;
  onOpenMenu?: () => void;
  drawerOpen?: boolean;
  onToggleDrawer?: () => void;
  settingsOpen?: boolean;
  onToggleSettings?: () => void;
  timerFormatted?: string;
  timerWarning?: boolean;
  timerCritical?: boolean;
  currentDurationMin?: number;
  onChangeDuration?: (durationMinutes: number) => void;
  onResetTimer?: () => void;
}

export function TopBar({
  phase,
  onOpenMenu,
  drawerOpen,
  onToggleDrawer,
  settingsOpen,
  onToggleSettings,
  timerFormatted,
  timerWarning,
  timerCritical,
  currentDurationMin,
  onChangeDuration,
  onResetTimer,
}: TopBarProps) {
  const title =
    phase === "goal"
      ? "Set your goal"
      : phase === "review"
        ? "Session review"
        : phase === "break"
          ? "Break"
          : "";

  return (
    <header
      className="relative flex h-14 flex-shrink-0 items-center justify-between px-4 md:px-6"
      style={{
        background: "rgba(13,14,32,0.85)",
        backdropFilter: "blur(12px)",
        zIndex: 30,
      }}
    >
      {/* Left: menu + timer/title */}
      <div className="flex items-center gap-3 md:gap-6">
        {onOpenMenu && (
          <button
            type="button"
            onClick={onOpenMenu}
            className="rounded p-1.5 text-[var(--color-text-tertiary)] hover:bg-white/10 hover:text-white"
            aria-label="Open menu"
          >
            <HamburgerIcon />
          </button>
        )}
        {title && (
          <span className="text-base font-semibold text-white">{title}</span>
        )}
      </div>

      {/* Center: timer + dropdown */}
      {phase === "sprint" && timerFormatted != null && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center">
          <span
            className={`font-extrabold tracking-tight text-xl ${
              timerCritical
                ? "text-[var(--color-coral-700)]"
                : timerWarning
                  ? "text-[var(--color-gold-500)]"
                  : "text-white"
            }`}
            style={{ fontFamily: "var(--font-montserrat), sans-serif" }}
          >
            {timerFormatted}
          </span>
          {onChangeDuration && onResetTimer && currentDurationMin != null && (
            <TimerDropdown
              currentDurationMin={currentDurationMin}
              onChangeDuration={onChangeDuration}
              onReset={onResetTimer}
            />
          )}
        </div>
      )}

      {/* Right: actions */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="rounded p-1 text-[var(--color-text-tertiary)] hover:text-white"
          aria-label="Volume"
        >
          <VolumeIcon />
        </button>
        {onToggleSettings && (
          <button
            type="button"
            onClick={onToggleSettings}
            className={`rounded p-1 transition-colors ${settingsOpen ? "bg-white/10 text-white" : "text-[var(--color-text-tertiary)] hover:text-white"}`}
            aria-label={settingsOpen ? "Close settings" : "Open settings"}
          >
            <GearIcon />
          </button>
        )}
        {onToggleDrawer && (
          <button
            type="button"
            onClick={onToggleDrawer}
            className={`rounded p-1 transition-colors ${drawerOpen ? "bg-white/10 text-white" : "text-[var(--color-text-tertiary)] hover:text-white"}`}
            aria-label={drawerOpen ? "Close panel" : "Open tasks & chat"}
          >
            <PanelRight size={17} strokeWidth={1.8} />
          </button>
        )}
      </div>
    </header>
  );
}

function HamburgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function VolumeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

