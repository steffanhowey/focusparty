"use client";

import { memo, useRef, useState, useEffect, useCallback, ReactNode } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MessageCircle,
  ListTodo,
  Crosshair,
  Settings,
  Music,
  LogOut,
  ChevronUp,
  RotateCcw,
  Activity,
  Zap,
  Pause,
  Play,
  Coffee,
  StickyNote,
} from "lucide-react";
import { MusicPopover } from "@/components/session/MusicPopover";
import { CheckInMenu } from "@/components/session/CheckInMenu";
import { BreakCategoryPopover } from "@/components/session/BreakCategoryPopover";
// import { FocusPopover } from "@/components/session/FocusPopover";
import { FocusDropdown } from "@/components/session/FocusDropdown";
import { NotesPopover } from "@/components/session/NotesPopover";
import type { BreakCategory } from "@/lib/breakConstants";
import type { GoalRecord, TaskRecord } from "@/lib/types";
import { Button } from "@/components/ui/Button";
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
  /** When true, vibe selection is hidden — the room controls the vibe. */
  roomControlled?: boolean;
}

interface ActionBarProps {
  micActive: boolean;
  onToggleMic: () => void;
  cameraActive: boolean;
  onToggleCamera: () => void;
  onOpenChat: () => void;
  onOpenSettings: () => void;
  chatActive: boolean;
  /** Focus popover config — passed through to FocusDropdown */
  focusPopover?: {
    open: boolean;
    onToggle: () => void;
    onClose: () => void;
    goalText: string;
    onGoalTextChange: (text: string) => void;
    activeTaskId: string | null;
    activeGoalId: string | null;
    goals: GoalRecord[];
    tasks: TaskRecord[];
    accentColor: string;
    onSelectTask: (taskId: string, taskTitle: string, goalId: string | null) => void;
    onSelectGoal: (goalId: string, goalTitle: string) => void;
    onCompleteTask: (taskId: string) => void;
    onDeleteTask: (taskId: string) => void;
    onCompleteGoal: (goalId: string) => void;
    onDeleteGoal: (goalId: string) => void;
    onAddTask: (title: string, goalId: string | null) => void;
    onAddGoal: (title: string) => void;
    onEditTask?: (taskId: string, newTitle: string) => void;
    onEditGoal?: (goalId: string, newTitle: string) => void;
    onComplete?: () => void;
    continueTask?: TaskRecord | null;
    onContinue?: (taskId: string) => void;
    focusButtonRef?: React.RefObject<HTMLButtonElement | null>;
  };
  settingsActive: boolean;
  momentumActive?: boolean;
  onOpenMomentum?: () => void;
  onEndSession: () => void;
  music: MusicProps;
  timer: Timer;
  currentDurationMin?: number;
  onChangeDuration?: (durationMinutes: number) => void;
  onResetTimer?: () => void;
  goalCardOpen?: boolean;
  onToggleGoalCard?: () => void;
  /** Optional ambient room state shown below the timer pill */
  roomStateLabel?: string;
  roomStateIcon?: string;
  roomStateColor?: string;
  /** Check-in menu state */
  checkInOpen?: boolean;
  onToggleCheckIn?: () => void;
  onCloseCheckIn?: () => void;
  onCheckIn?: (action: string, message?: string) => void;
  /** Breaks panel state */
  breaksActive?: boolean;
  /** Break category popover */
  breakPopoverOpen?: boolean;
  onToggleBreakPopover?: () => void;
  onCloseBreakPopover?: () => void;
  onSelectBreakCategory?: (category: BreakCategory) => void;
  /** Current session phase — drives break visual state in timer pill */
  phase?: "sprint" | "break";
  /** Break duration in minutes — used for break countdown in timer pill */
  breakDurationMinutes?: number;
  onChangeBreakDuration?: (minutes: number) => void;
  onResetBreakTimer?: () => void;
  onEndBreak?: () => void;
  /** Increment to force break countdown reset without changing duration */
  breakResetKey?: number;
  /** Notes popover config */
  notesPopover?: {
    open: boolean;
    onToggle: () => void;
    text: string;
    setText: (text: string) => void;
    isSaving: boolean;
    onBlur: () => void;
    onExpand: () => void;
    onClose: () => void;
    notesButtonRef: React.RefObject<HTMLButtonElement | null>;
  };
}

const ICON = { size: 18, strokeWidth: 1.8 } as const;

function Tip({ label, children, hidden }: { label: string; children: ReactNode; hidden?: boolean }) {
  return (
    <div className="group/tip relative">
      {children}
      {!hidden && (
        <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[rgba(10,10,10,0.9)] px-2.5 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:opacity-100">
          {label}
        </span>
      )}
    </div>
  );
}

export const ActionBar = memo(function ActionBar({
  micActive,
  onToggleMic,
  cameraActive,
  onToggleCamera,
  onOpenChat,
  onOpenSettings,
  chatActive,
  focusPopover,
  settingsActive,
  momentumActive,
  onOpenMomentum,
  onEndSession,
  music,
  timer,
  currentDurationMin,
  onChangeDuration,
  onResetTimer,
  goalCardOpen,
  onToggleGoalCard,
  roomStateLabel,
  roomStateIcon,
  roomStateColor,
  checkInOpen,
  onToggleCheckIn,
  onCloseCheckIn,
  onCheckIn,
  breaksActive,
  breakPopoverOpen,
  onToggleBreakPopover,
  onCloseBreakPopover,
  onSelectBreakCategory,
  phase,
  breakDurationMinutes,
  onChangeBreakDuration,
  onResetBreakTimer,
  onEndBreak,
  breakResetKey,
  notesPopover,
}: ActionBarProps) {
  const musicWrapperRef = useRef<HTMLDivElement>(null);
  const checkInWrapperRef = useRef<HTMLDivElement>(null);
  const breakWrapperRef = useRef<HTMLDivElement>(null);
  const { formatted, seconds, running } = useTimerDisplay(timer);
  const isBreak = phase === "break";

  // Break countdown — independent timer that counts down from breakDurationMinutes
  const [breakRemaining, setBreakRemaining] = useState(0);
  useEffect(() => {
    if (isBreak && breakDurationMinutes) {
      setBreakRemaining(breakDurationMinutes * 60);
      const id = setInterval(() => setBreakRemaining((r) => Math.max(0, r - 1)), 1000);
      return () => clearInterval(id);
    }
  }, [isBreak, breakDurationMinutes, breakResetKey]);
  const formatBreakTime = useCallback((s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }, []);
  // icon shadow removed — glass pill provides enough context
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
        className="absolute top-4 left-1/2 z-20"
        style={dragStyle}
      >
        <div className="relative">
          <div
            className="flex items-center gap-1 rounded-full border"
            style={{
              borderColor: isBreak ? "rgba(140, 85, 239, 0.3)" : "rgba(255,255,255,0.08)",
              background: "rgba(10,10,10,0.55)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              boxShadow: isBreak
                ? "0 4px 24px rgba(0,0,0,0.25), 0 0 12px 2px rgba(140,85,239,0.15), inset 0 1px 0 rgba(255,255,255,0.06)"
                : "0 4px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            {/* Pause / Play — or Coffee icon during break */}
            {isBreak ? (
              <div className="flex h-full items-center pl-4 pr-1 text-[#8C55EF]">
                <Coffee size={20} strokeWidth={2} />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { running ? timer.pause() : timer.start(); }}
                className="flex h-full cursor-pointer items-center pl-4 pr-1 text-white/40 transition-colors hover:text-white/70"
                aria-label={running ? "Pause timer" : "Resume timer"}
              >
                {running ? (
                  <Pause size={16} strokeWidth={2} fill="currentColor" />
                ) : (
                  <Play size={16} strokeWidth={2} fill="currentColor" />
                )}
              </button>
            )}

            {/* Timer + dropdown toggle */}
            <button
              type="button"
              onClick={() => { if (!wasDraggedRef.current) onToggleGoalCard?.(); }}
              className="flex cursor-pointer items-center gap-2 py-2 pl-2 pr-5 transition-colors rounded-r-full hover:bg-white/10"
              aria-label={isBreak ? "Break timer options" : "Toggle timer options"}
              aria-expanded={goalCardOpen}
            >
              <span
                className="text-3xl font-extrabold tracking-tight md:text-4xl"
                style={{
                  fontFamily: "var(--font-montserrat), sans-serif",
                  textShadow: "0 1px 6px rgba(0,0,0,0.5)",
                  fontVariantNumeric: "tabular-nums",
                  color: isBreak ? "#8C55EF" : "white",
                }}
              >
                {isBreak ? formatBreakTime(breakRemaining) : formatted}
              </span>
              <ChevronUp
                size={18}
                strokeWidth={2.5}
                className={`transition-transform duration-200 ${goalCardOpen ? "" : "rotate-180"}`}
                style={{ color: isBreak ? "rgba(140, 85, 239, 0.5)" : "var(--color-text-tertiary)" }}
              />
            </button>
          </div>

          {/* "On Break" label below pill — hidden when dropdown is open */}
          {isBreak && !goalCardOpen && (
            <p className="mt-1.5 text-center text-[10px] font-medium tracking-wider text-[#8C55EF]/70">
              On Break
            </p>
          )}

          {/* Downward dropdown — sprint or break mode */}
          {goalCardOpen && !isBreak && currentDurationMin != null && onChangeDuration && onResetTimer && (
            <div
              className="absolute top-full left-1/2 mt-3 -translate-x-1/2 rounded-xl border border-[var(--color-border-default)] p-3"
              style={{
                background: "rgba(10,10,10,0.80)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)",
                zIndex: 40,
              }}
            >
              <p className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">Sprint duration</p>
              <div className="flex items-center gap-2 [&>div]:flex-nowrap">
                <DurationPills value={currentDurationMin} onChange={onChangeDuration} />
                <Button
                  variant="ghost"
                  size="xs"
                  leftIcon={<RotateCcw size={12} strokeWidth={2} />}
                  onClick={onResetTimer}
                  className="ml-auto"
                  aria-label="Reset timer"
                >
                  Reset
                </Button>
              </div>
            </div>
          )}
          {goalCardOpen && isBreak && breakDurationMinutes != null && onChangeBreakDuration && onResetBreakTimer && (
            <div
              className="absolute top-full left-1/2 mt-3 -translate-x-1/2 rounded-xl border p-3"
              style={{
                borderColor: "rgba(140, 85, 239, 0.2)",
                background: "rgba(10,10,10,0.80)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)",
                zIndex: 40,
              }}
            >
              <p className="mb-2 text-xs font-medium text-[#8C55EF]/70">Break duration</p>
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  {[3, 5, 10].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => onChangeBreakDuration(d)}
                      className="cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-150"
                      style={{
                        background: d === breakDurationMinutes ? "#8C55EF" : "transparent",
                        color: d === breakDurationMinutes ? "white" : "var(--color-text-tertiary)",
                        border: d === breakDurationMinutes ? "1px solid transparent" : "1px solid var(--color-border-default)",
                      }}
                    >
                      {d}m
                    </button>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="xs"
                  leftIcon={<RotateCcw size={12} strokeWidth={2} />}
                  onClick={onResetBreakTimer}
                  className="ml-auto"
                  aria-label="Reset break timer"
                >
                  Reset
                </Button>
              </div>
              {onEndBreak && (
                <button
                  type="button"
                  onClick={onEndBreak}
                  className="mt-2 w-full cursor-pointer rounded-lg py-1.5 text-xs font-medium transition-colors hover:bg-white/10"
                  style={{ color: "#8C55EF" }}
                >
                  End Break
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Action bar ── */}
      <div
        className="absolute bottom-10 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/[0.08] px-2 py-1.5"
        style={{
          background: "rgba(10,10,10,0.55)",
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
            roomControlled={music.roomControlled}
          />
        </div>

        <div ref={checkInWrapperRef} className={`relative ${onToggleCheckIn && onCheckIn ? "" : "invisible"}`}>
          <Tip label="Check In">
            <button
              type="button"
              onClick={onToggleCheckIn}
              className={checkInOpen ? activeBtn : defaultBtn}
              aria-label="Check in"
              aria-expanded={checkInOpen}

            >
              <Zap {...ICON} />
            </button>
          </Tip>

          {onToggleCheckIn && onCheckIn && (
            <CheckInMenu
              isOpen={checkInOpen ?? false}
              onClose={onCloseCheckIn ?? onToggleCheckIn}
              wrapperRef={checkInWrapperRef}
              onCheckIn={onCheckIn}
            />
          )}
        </div>

        <div ref={breakWrapperRef} className={`relative ${onToggleBreakPopover && onSelectBreakCategory ? "" : "invisible"}`}>
          <Tip label="Breaks">
            <button
              type="button"
              onClick={onToggleBreakPopover}
              className={breaksActive || breakPopoverOpen ? activeBtn : defaultBtn}
              aria-label="Breaks"
              aria-expanded={breakPopoverOpen}
            >
              <Coffee {...ICON} />
            </button>
          </Tip>

          {onToggleBreakPopover && onSelectBreakCategory && (
            <BreakCategoryPopover
              isOpen={breakPopoverOpen ?? false}
              onClose={onCloseBreakPopover ?? onToggleBreakPopover}
              wrapperRef={breakWrapperRef}
              onSelectCategory={onSelectBreakCategory}
            />
          )}
        </div>

        {/* ── Center: Focus button + dropdown ── */}
        <div className="mx-0.5 h-6 w-px bg-white/10" />

        <div className="relative">
          <Tip label="Focus" hidden={focusPopover?.open}>
            <button
              ref={focusPopover?.focusButtonRef}
              type="button"
              onClick={focusPopover?.onToggle}
              className={`${btn} ${
                focusPopover?.open
                  ? "bg-white/15 text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
              aria-label="Focus"
              aria-expanded={focusPopover?.open}
            >
              <Crosshair size={20} strokeWidth={1.8} />
            </button>
          </Tip>

          {focusPopover?.open && (
            <FocusDropdown
              open={focusPopover.open}
              onToggle={focusPopover.onToggle}
              onClose={focusPopover.onClose}
              goalText={focusPopover.goalText}
              onGoalTextChange={focusPopover.onGoalTextChange}
              activeTaskId={focusPopover.activeTaskId}
              activeGoalId={focusPopover.activeGoalId}
              goals={focusPopover.goals}
              tasks={focusPopover.tasks}
              accentColor={focusPopover.accentColor}
              onSelectTask={focusPopover.onSelectTask}
              onSelectGoal={focusPopover.onSelectGoal}
              onCompleteTask={focusPopover.onCompleteTask}
              onDeleteTask={focusPopover.onDeleteTask}
              onCompleteGoal={focusPopover.onCompleteGoal}
              onDeleteGoal={focusPopover.onDeleteGoal}
              onAddTask={focusPopover.onAddTask}
              onAddGoal={focusPopover.onAddGoal}
              onEditTask={focusPopover.onEditTask}
              onEditGoal={focusPopover.onEditGoal}
              onComplete={focusPopover.onComplete}
              continueTask={focusPopover.continueTask}
              onContinue={focusPopover.onContinue}
              triggerRef={focusPopover.focusButtonRef}
            />
          )}
        </div>

        <div className="mx-0.5 h-6 w-px bg-white/10" />

        {/* ── Right group ── */}
        <div className={`relative ${notesPopover ? "" : "invisible"}`}>
          <Tip label="Notes" hidden={notesPopover?.open}>
            <button
              ref={notesPopover?.notesButtonRef}
              type="button"
              onClick={notesPopover?.onToggle}
              className={notesPopover?.open ? activeBtn : defaultBtn}
              aria-label="Notes"
              aria-expanded={notesPopover?.open}
            >
              <StickyNote {...ICON} />
            </button>
          </Tip>

          {notesPopover?.open && (
            <NotesPopover
              text={notesPopover.text}
              setText={notesPopover.setText}
              isSaving={notesPopover.isSaving}
              onBlur={notesPopover.onBlur}
              onExpand={notesPopover.onExpand}
              onClose={notesPopover.onClose}
              triggerRef={notesPopover.notesButtonRef}
            />
          )}
        </div>

        <Tip label="Chat">
          <button
            type="button"
            onClick={onOpenChat}
            className={chatActive ? activeBtn : defaultBtn}
            aria-label="Chat"

          >
            <MessageCircle {...ICON} />
          </button>
        </Tip>

        <div className={onOpenMomentum ? "" : "invisible"}>
          <Tip label="Momentum">
            <button
              type="button"
              onClick={onOpenMomentum}
              className={momentumActive ? activeBtn : defaultBtn}
              aria-label="Momentum"

            >
              <Activity {...ICON} />
            </button>
          </Tip>
        </div>

        <Tip label="Settings">
          <button
            type="button"
            onClick={onOpenSettings}
            className={settingsActive ? activeBtn : defaultBtn}
            aria-label="Settings"

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

          >
            <LogOut {...ICON} />
          </button>
        </Tip>
    </div>
    </>
  );
});
