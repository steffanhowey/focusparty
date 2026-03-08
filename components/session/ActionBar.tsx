"use client";

import { memo, useRef, useState, ReactNode } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  ScreenShareOff,
  MessageCircle,
  UserPlus,
  ListTodo,
  Settings,
  Music,
  LogOut,
  ChevronUp,
  RotateCcw,
} from "lucide-react";
import { MusicPopover } from "@/components/session/MusicPopover";
import { InvitePopover } from "@/components/session/InvitePopover";
import { DurationPills } from "./DurationPills";
import { useTimerDisplay, type Timer } from "@/lib/useTimer";
import type { VibeId, MusicStatus } from "@/lib/musicConstants";
import { usePointerDrag } from "@/lib/usePointerDrag";

export interface MusicProps {
  popoverOpen: boolean;
  togglePopover: () => void;
  closePopover: () => void;
  activeVibe: VibeId | null;
  selectVibe: (vibeId: VibeId) => void;
  isPlaying: boolean;
  togglePlayPause: () => void;
  volume: number;
  setVolume: (volume: number) => void;
  status: MusicStatus;
}

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
  screenShareActive: boolean;
  onToggleScreenShare: () => void;
  partyId: string | null;
  inviteCode: string | null;
  onEndSession: () => void;
  music: MusicProps;
  timer: Timer;
  currentDurationMin?: number;
  onChangeDuration?: (durationMinutes: number) => void;
  onResetTimer?: () => void;
  goalCardOpen?: boolean;
  onToggleGoalCard?: () => void;
}

const ICON = { size: 18, strokeWidth: 1.8 } as const;

function Tip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="group/tip relative">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[rgba(13,14,32,0.9)] px-2.5 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:opacity-100">
        {label}
      </span>
    </div>
  );
}

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
  screenShareActive,
  onToggleScreenShare,
  partyId,
  inviteCode,
  onEndSession,
  music,
  timer,
  currentDurationMin,
  onChangeDuration,
  onResetTimer,
  goalCardOpen,
  onToggleGoalCard,
}: ActionBarProps) {
  const musicWrapperRef = useRef<HTMLDivElement>(null);
  const inviteWrapperRef = useRef<HTMLDivElement>(null);
  const [invitePopoverOpen, setInvitePopoverOpen] = useState(false);
  const { formatted, seconds } = useTimerDisplay(timer);
  const iconShadow = { filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))" } as const;
  const btn =
    "flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition-colors";
  const defaultBtn = `${btn} text-[var(--color-text-secondary)] hover:bg-white/10 hover:text-white`;
  const activeBtn = `${btn} bg-white/15 text-white`;

  const timerWarning = seconds > 0 && seconds <= 5 * 60;
  const timerCritical = seconds > 0 && seconds <= 60;

  const { dragRef, dragStyle, wasDraggedRef } = usePointerDrag({ threshold: 4 });

  return (
    <>
      {/* ── Floating timer pill ── */}
      <div
        ref={dragRef}
        className="absolute top-10 left-1/2 z-20"
        style={dragStyle}
      >
        <div className="relative">
          <button
            type="button"
            onClick={() => { if (!wasDraggedRef.current) onToggleGoalCard?.(); }}
            className="flex cursor-pointer items-center gap-2 rounded-full border border-white/[0.08] px-5 py-2 transition-colors hover:bg-white/10"
            style={{
              background: "rgba(13,14,32,0.55)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
            aria-label="Toggle timer options"
            aria-expanded={goalCardOpen}
          >
            <span
              className={`text-3xl font-extrabold tracking-tight md:text-4xl ${
                timerCritical
                  ? "text-[var(--color-coral-700)]"
                  : timerWarning
                    ? "text-[var(--color-gold-500)]"
                    : "text-white"
              }`}
              style={{
                fontFamily: "var(--font-montserrat), sans-serif",
                textShadow: "0 2px 8px rgba(0,0,0,0.7), 0 0 20px rgba(0,0,0,0.3)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatted}
            </span>
            <ChevronUp
              size={18}
              strokeWidth={2.5}
              className={`text-[var(--color-text-tertiary)] transition-transform duration-200 ${goalCardOpen ? "" : "rotate-180"}`}
            />
          </button>

          {/* Downward dropdown */}
          {goalCardOpen && currentDurationMin != null && onChangeDuration && onResetTimer && (
            <div
              className="absolute top-full left-1/2 mt-3 -translate-x-1/2 rounded-xl border border-[var(--color-border-default)] p-3"
              style={{
                background: "rgba(13,14,32,0.80)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                textShadow: "0 1px 4px rgba(0,0,0,0.5)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)",
                zIndex: 40,
              }}
            >
              <p className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">Sprint duration</p>
              <div className="flex items-center gap-2 [&>div]:flex-nowrap">
                <DurationPills value={currentDurationMin} onChange={onChangeDuration} />
                <button
                  type="button"
                  onClick={onResetTimer}
                  className="ml-auto flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1.5 text-xs text-[var(--color-text-tertiary)] transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Reset timer"
                >
                  <RotateCcw size={12} strokeWidth={2} />
                  Reset
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Action bar ── */}
      <div
        className="absolute bottom-10 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/[0.08] px-2 py-1.5"
        style={{
          background: "rgba(13,14,32,0.55)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        <Tip label={micActive ? "Mute" : "Unmute"}>
          <button
            type="button"
            onClick={onToggleMic}
            className={micActive ? defaultBtn : `${btn} text-[var(--color-coral-700)] hover:bg-white/10`}
            aria-label={micActive ? "Mute" : "Unmute"}
            style={iconShadow}
          >
            {micActive ? <Mic {...ICON} /> : <MicOff {...ICON} />}
          </button>
        </Tip>

        <Tip label={cameraActive ? "Turn off camera" : "Turn on camera"}>
          <button
            type="button"
            onClick={onToggleCamera}
            className={cameraActive ? defaultBtn : `${btn} text-[var(--color-coral-700)] hover:bg-white/10`}
            aria-label={cameraActive ? "Turn off camera" : "Turn on camera"}
            style={iconShadow}
          >
            {cameraActive ? <Video {...ICON} /> : <VideoOff {...ICON} />}
          </button>
        </Tip>

        <div ref={musicWrapperRef} className="relative">
          <Tip label="Music">
            <button
              type="button"
              onClick={music.togglePopover}
              className={
                music.popoverOpen || music.isPlaying ? activeBtn : defaultBtn
              }
              aria-label="Music"
              aria-expanded={music.popoverOpen}
              style={iconShadow}
            >
              <Music {...ICON} />
            </button>
          </Tip>

          <MusicPopover
            isOpen={music.popoverOpen}
            onClose={music.closePopover}
            wrapperRef={musicWrapperRef}
            activeVibe={music.activeVibe}
            onSelectVibe={music.selectVibe}
            isPlaying={music.isPlaying}
            onTogglePlayPause={music.togglePlayPause}
            volume={music.volume}
            onSetVolume={music.setVolume}
            status={music.status}
          />
        </div>

        <div ref={inviteWrapperRef} className="relative">
          <Tip label="Invite">
            <button
              type="button"
              onClick={() => setInvitePopoverOpen((prev) => !prev)}
              className={invitePopoverOpen ? activeBtn : defaultBtn}
              aria-label="Invite to party"
              aria-expanded={invitePopoverOpen}
              style={iconShadow}
            >
              <UserPlus {...ICON} />
            </button>
          </Tip>

          <InvitePopover
            isOpen={invitePopoverOpen}
            onClose={() => setInvitePopoverOpen(false)}
            wrapperRef={inviteWrapperRef}
            inviteCode={inviteCode}
          />
        </div>

        <div className="mx-0.5 h-6 w-px bg-white/10" />

        <Tip label={screenShareActive ? "Stop sharing" : "Share screen"}>
          <button
            type="button"
            onClick={onToggleScreenShare}
            className={`relative flex h-10 cursor-pointer items-center gap-1.5 rounded-full px-4 text-xs font-medium transition-colors ${
              screenShareActive
                ? "bg-[var(--color-coral-700)] text-white hover:brightness-110"
                : "bg-[var(--color-green-800)] text-white hover:bg-[var(--color-green-700)]"
            }`}
            aria-label={screenShareActive ? "Stop sharing" : "Share screen"}
            style={iconShadow}
          >
            {screenShareActive ? (
              <ScreenShareOff size={16} strokeWidth={1.8} />
            ) : (
              <MonitorUp size={16} strokeWidth={1.8} />
            )}
            <span>{screenShareActive ? "Stop" : "Share"}</span>
            {screenShareActive && (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-[var(--color-coral-700)]" />
            )}
          </button>
        </Tip>

        <div className="mx-0.5 h-6 w-px bg-white/10" />

        <Tip label="Tasks">
          <button
            type="button"
            onClick={onOpenTasks}
            className={tasksActive ? activeBtn : defaultBtn}
            aria-label="Tasks"
            style={iconShadow}
          >
            <ListTodo {...ICON} />
          </button>
        </Tip>

        <Tip label="Chat">
          <button
            type="button"
            onClick={onOpenChat}
            className={chatActive ? activeBtn : defaultBtn}
            aria-label="Chat"
            style={iconShadow}
          >
            <MessageCircle {...ICON} />
          </button>
        </Tip>

        <Tip label="Settings">
          <button
            type="button"
            onClick={onOpenSettings}
            className={settingsActive ? activeBtn : defaultBtn}
            aria-label="Settings"
            style={iconShadow}
          >
            <Settings {...ICON} />
          </button>
        </Tip>

        <div className="mx-0.5 h-6 w-px bg-white/10" />

        <Tip label="Leave">
          <button
            type="button"
            onClick={onEndSession}
            className={`${btn} text-[var(--color-coral-700)] hover:bg-white/10`}
            aria-label="End session"
            style={iconShadow}
          >
            <LogOut {...ICON} />
          </button>
        </Tip>
    </div>
    </>
  );
});
