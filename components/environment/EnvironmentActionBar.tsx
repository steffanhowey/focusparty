"use client";

import { Pause, Play, LogOut, Activity } from "lucide-react";

interface EnvironmentActionBarProps {
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onLeave: () => void;
  momentumOpen: boolean;
  onToggleMomentum: () => void;
}

export function EnvironmentActionBar({
  isPaused,
  onPause,
  onResume,
  onLeave,
  momentumOpen,
  onToggleMomentum,
}: EnvironmentActionBarProps) {
  return (
    <div className="relative z-10 flex justify-center pb-4">
      <div
        className="flex items-center gap-1 rounded-full px-2 py-1.5"
        style={{
          background: "rgba(10,10,10,0.55)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow:
            "0 4px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        {/* Pause / Resume */}
        <ActionButton
          icon={isPaused ? Play : Pause}
          label={isPaused ? "Resume" : "Pause"}
          onClick={isPaused ? onResume : onPause}
        />

        <Divider />

        {/* Momentum */}
        <ActionButton
          icon={Activity}
          label="Momentum"
          onClick={onToggleMomentum}
          active={momentumOpen}
        />

        <Divider />

        {/* Leave */}
        <ActionButton
          icon={LogOut}
          label="Leave"
          onClick={onLeave}
          danger
        />
      </div>
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────── */

function ActionButton({
  icon: Icon,
  label,
  onClick,
  danger,
  active,
}: {
  icon: typeof Pause;
  label: string;
  onClick: () => void;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-colors hover:bg-white/10 ${
        active ? "bg-white/15 text-white" : ""
      }`}
      style={{
        color: danger
          ? "#F87171"
          : active
            ? undefined
            : "rgba(255,255,255,0.75)",
      }}
    >
      <Icon size={15} strokeWidth={1.8} />
      {label}
    </button>
  );
}

function Divider() {
  return (
    <div
      className="h-5 w-px"
      style={{ background: "rgba(255,255,255,0.08)" }}
    />
  );
}
