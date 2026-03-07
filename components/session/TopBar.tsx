"use client";

import { memo } from "react";
import { PanelRight, ChevronDown, LogOut } from "lucide-react";
import type { SessionPhase } from "@/lib/types";
import { useTimerDisplay, type Timer } from "@/lib/useTimer";
import { TimerDropdown } from "./TimerDropdown";

interface TopBarProps {
  phase: SessionPhase;
  onOpenMenu?: () => void;
  drawerOpen?: boolean;
  onToggleDrawer?: () => void;
  settingsOpen?: boolean;
  onToggleSettings?: () => void;
  timer: Timer;
  durationSec: number;
  currentDurationMin?: number;
  onChangeDuration?: (durationMinutes: number) => void;
  onResetTimer?: () => void;
  goalCardOpen?: boolean;
  onToggleGoalCard?: () => void;
  onEndSession?: () => void;
}

export const TopBar = memo(function TopBar({
  phase,
  onOpenMenu,
  drawerOpen,
  onToggleDrawer,
  settingsOpen,
  onToggleSettings,
  timer,
  durationSec,
  currentDurationMin,
  onChangeDuration,
  onResetTimer,
  goalCardOpen,
  onToggleGoalCard,
  onEndSession,
}: TopBarProps) {
  const { formatted, seconds } = useTimerDisplay(timer);

  const timerWarning = phase === "sprint" && seconds > 0 && seconds <= 5 * 60;
  const timerCritical = phase === "sprint" && seconds > 0 && seconds <= 60;

  const title =
    phase === "setup"
      ? ""
      : phase === "review"
        ? "Session review"
        : phase === "break"
          ? "Break"
          : "";

  return (
    <header
      className="relative flex h-20 flex-shrink-0 items-center justify-between px-4 md:px-6"
      style={{ zIndex: 30, textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}
    >
      {/* Left: menu + timer/title */}
      <div className="flex items-center gap-3 md:gap-6">
        {onOpenMenu && (
          <button
            type="button"
            onClick={onOpenMenu}
            className="-ml-1.5 cursor-pointer rounded p-1.5 text-[var(--color-text-tertiary)] hover:text-white"
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
      {phase === "sprint" && (
        <button
          type="button"
          onClick={onToggleGoalCard}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex cursor-pointer items-center"
          aria-label="Toggle timer options"
        >
          <span
            className={`font-extrabold tracking-tight text-4xl ${
              timerCritical
                ? "text-[var(--color-coral-700)]"
                : timerWarning
                  ? "text-[var(--color-gold-500)]"
                  : "text-white"
            }`}
            style={{ fontFamily: "var(--font-montserrat), sans-serif" }}
          >
            {formatted}
          </span>
          <ChevronDown
            size={20}
            strokeWidth={2.5}
            className={`ml-3 text-[var(--color-text-tertiary)] transition-transform duration-200 ${goalCardOpen ? "rotate-180" : ""}`}
          />
        </button>
      )}

      {/* Right: actions */}
      <div className="flex items-center gap-4">
        {onEndSession && (
          <button
            type="button"
            onClick={onEndSession}
            className="cursor-pointer rounded p-1 text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-coral-700)]"
            aria-label="End session"
          >
            <LogOut size={17} strokeWidth={1.8} />
          </button>
        )}
        {onToggleSettings && (
          <button
            type="button"
            onClick={onToggleSettings}
            className={`cursor-pointer rounded p-1 transition-colors ${settingsOpen ? "bg-white/10 text-white" : "text-[var(--color-text-tertiary)] hover:text-white"}`}
            aria-label={settingsOpen ? "Close settings" : "Open settings"}
          >
            <GearIcon />
          </button>
        )}
        {onToggleDrawer && (
          <button
            type="button"
            onClick={onToggleDrawer}
            className={`cursor-pointer rounded p-1 transition-colors ${drawerOpen ? "bg-white/10 text-white" : "text-[var(--color-text-tertiary)] hover:text-white"}`}
            aria-label={drawerOpen ? "Close panel" : "Open tasks & chat"}
          >
            <PanelRight size={17} strokeWidth={1.8} />
          </button>
        )}
      </div>
    </header>
  );
});

function HamburgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
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
