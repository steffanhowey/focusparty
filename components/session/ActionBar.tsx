"use client";

import { memo } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MessageCircle,
  ListTodo,
  Settings,
  LogOut,
} from "lucide-react";

interface ActionBarProps {
  micActive: boolean;
  onToggleMic: () => void;
  cameraActive: boolean;
  onToggleCamera: () => void;
  onOpenChat: () => void;
  onOpenTasks: () => void;
  onOpenSettings: () => void;
  chatActive: boolean;
  tasksActive: boolean;
  settingsActive: boolean;
  onEndSession: () => void;
}

const ICON = { size: 18, strokeWidth: 1.8 } as const;

export const ActionBar = memo(function ActionBar({
  micActive,
  onToggleMic,
  cameraActive,
  onToggleCamera,
  onOpenChat,
  onOpenTasks,
  onOpenSettings,
  chatActive,
  tasksActive,
  settingsActive,
  onEndSession,
}: ActionBarProps) {
  const btn =
    "flex h-10 w-10 items-center justify-center rounded-full transition-colors";
  const defaultBtn = `${btn} text-[var(--color-text-secondary)] hover:bg-white/10 hover:text-white`;
  const activeBtn = `${btn} bg-white/15 text-white`;

  return (
    <div
      className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/[0.08] px-2 py-1.5"
      style={{
        background: "rgba(13,14,32,0.85)",
        backdropFilter: "blur(20px)",
      }}
    >
      <button
        type="button"
        onClick={onToggleMic}
        className={micActive ? defaultBtn : `${btn} text-[var(--color-coral-700)] hover:bg-white/10`}
        aria-label={micActive ? "Mute" : "Unmute"}
      >
        {micActive ? <Mic {...ICON} /> : <MicOff {...ICON} />}
      </button>

      <button
        type="button"
        onClick={onToggleCamera}
        className={cameraActive ? defaultBtn : `${btn} text-[var(--color-coral-700)] hover:bg-white/10`}
        aria-label={cameraActive ? "Turn off camera" : "Turn on camera"}
      >
        {cameraActive ? <Video {...ICON} /> : <VideoOff {...ICON} />}
      </button>

      <button
        type="button"
        onClick={onOpenChat}
        className={chatActive ? activeBtn : defaultBtn}
        aria-label="Chat"
      >
        <MessageCircle {...ICON} />
      </button>

      <button
        type="button"
        onClick={onOpenTasks}
        className={tasksActive ? activeBtn : defaultBtn}
        aria-label="Tasks"
      >
        <ListTodo {...ICON} />
      </button>

      <button
        type="button"
        onClick={onOpenSettings}
        className={settingsActive ? activeBtn : defaultBtn}
        aria-label="Settings"
      >
        <Settings {...ICON} />
      </button>

      {/* Divider */}
      <div className="mx-0.5 h-6 w-px bg-white/10" />

      <button
        type="button"
        onClick={onEndSession}
        className={`${btn} bg-[var(--color-coral-700)] text-white hover:opacity-90`}
        aria-label="End session"
      >
        <LogOut {...ICON} />
      </button>
    </div>
  );
});
