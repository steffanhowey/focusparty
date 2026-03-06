"use client";

import Link from "next/link";
import type { SessionPhase } from "@/lib/types";
import { TimerDisplay } from "./TimerDisplay";

interface TopBarProps {
  phase: SessionPhase;
  timerFormatted?: string;
  timerWarning?: boolean;
  timerCritical?: boolean;
  goal?: string;
  onOpenMenu?: () => void;
}

export function TopBar({
  phase,
  timerFormatted = "25:00",
  timerWarning,
  timerCritical,
  goal,
  onOpenMenu,
}: TopBarProps) {
  const title =
    phase === "goal"
      ? "Set your goal"
      : phase === "sprint"
        ? ""
        : phase === "review"
          ? "Session review"
          : "Break";

  return (
    <header
      className="flex h-14 flex-shrink-0 items-center justify-between border-b border-[var(--color-border-subtle)] px-4 md:px-6"
      style={{
        background: "rgba(13,14,32,0.85)",
        backdropFilter: "blur(12px)",
        zIndex: 30,
      }}
    >
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
        {phase === "sprint" && timerFormatted != null ? (
          <TimerDisplay
            formatted={timerFormatted}
            phase="sprint"
            warning={timerWarning}
            critical={timerCritical}
          />
        ) : (
          <span className="text-base font-semibold text-white">{title}</span>
        )}
        {phase === "sprint" && goal && (
          <span
            className="max-w-[140px] truncate text-sm text-[var(--color-text-tertiary)] md:max-w-[300px]"
            title={goal}
          >
            {goal}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="rounded p-1 text-[var(--color-text-tertiary)] hover:text-white"
          aria-label="Volume"
        >
          <VolumeIcon />
        </button>
        <button
          type="button"
          className="rounded p-1 text-[var(--color-text-tertiary)] hover:text-white"
          aria-label="Settings"
        >
          <GearIcon />
        </button>
        <Link
          href="/dashboard"
          className="rounded p-1 text-[var(--color-text-tertiary)] hover:text-white"
          aria-label="Close session"
        >
          <CloseIcon />
        </Link>
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

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
