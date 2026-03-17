"use client";

import { memo } from "react";
import { PanelRight, LogOut } from "lucide-react";
import type { SessionPhase } from "@/lib/types";

interface TopBarProps {
  phase: SessionPhase;
  drawerOpen?: boolean;
  onToggleDrawer?: () => void;
  settingsOpen?: boolean;
  onToggleSettings?: () => void;
  onEndSession?: () => void;
}

export const TopBar = memo(function TopBar({
  phase,
  drawerOpen,
  onToggleDrawer,
  settingsOpen,
  onToggleSettings,
  onEndSession,
}: TopBarProps) {
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
      style={{ zIndex: 30, textShadow: "0 2px 8px rgba(0,0,0,0.7), 0 0 20px rgba(0,0,0,0.3)" }}
    >
      {/* Left: title */}
      <div className="flex items-center">
        {title && (
          <span className="text-base font-semibold text-white">{title}</span>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-4">
        {onEndSession && (
          <button
            type="button"
            onClick={onEndSession}
            className="cursor-pointer rounded p-1 text-[var(--sg-shell-500)] transition-colors hover:text-[var(--sg-coral-500)]"
            aria-label="End session"
            style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.5))" }}
          >
            <LogOut size={17} strokeWidth={1.8} />
          </button>
        )}
        {onToggleSettings && (
          <button
            type="button"
            onClick={onToggleSettings}
            className={`cursor-pointer rounded p-1 transition-colors ${settingsOpen ? "bg-white/10 text-white" : "text-[var(--sg-shell-500)] hover:text-white"}`}
            aria-label={settingsOpen ? "Close settings" : "Open settings"}
            style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.5))" }}
          >
            <GearIcon />
          </button>
        )}
        {onToggleDrawer && (
          <button
            type="button"
            onClick={onToggleDrawer}
            className={`cursor-pointer rounded p-1 transition-colors ${drawerOpen ? "bg-white/10 text-white" : "text-[var(--sg-shell-500)] hover:text-white"}`}
            aria-label={drawerOpen ? "Close panel" : "Open tasks & chat"}
            style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.5))" }}
          >
            <PanelRight size={17} strokeWidth={1.8} />
          </button>
        )}
      </div>
    </header>
  );
});

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}
