"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { RotateCw, ListTodo, X } from "lucide-react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { useTasks } from "@/lib/useTasks";
import { usePartyPresence } from "@/lib/usePartyPresence";
import { usePartyActivityFeed } from "@/lib/usePartyActivityFeed";
import { useRoomSprint } from "@/lib/useRoomSprint";
import { computeRoomState, ROOM_STATE_CONFIG } from "@/lib/roomState";
import { getParty, joinParty, getSyntheticParticipants, type Party, type SyntheticPresenceInfo } from "@/lib/parties";
import { getWorldConfig, getPartyHostPersonality } from "@/lib/worlds";
import { getHostConfig } from "@/lib/hosts";
import { DurationPills } from "@/components/session/DurationPills";
import { SPRINT_DURATION_OPTIONS } from "@/lib/constants";
import type { ActiveBackground } from "@/lib/roomBackgrounds";

interface JoinRoomModalProps {
  partyId: string;
  isOpen: boolean;
  onClose: () => void;
  backgrounds?: Map<string, ActiveBackground>;
  onJoin?: (config: JoinConfig) => void;
}

type SprintMode = "current" | "next" | "fresh";
type ModalPhase = "form" | "countdown";

/** Config stored in sessionStorage for the environment page to read. */
export interface JoinConfig {
  taskId: string | null;
  goalText: string;
  durationSec: number;
  autoStart: boolean;
}

function formatMinutes(seconds: number): string {
  const m = Math.ceil(seconds / 60);
  return `${m}m`;
}

export function JoinRoomModal({ partyId, isOpen, onClose, backgrounds, onJoin }: JoinRoomModalProps) {
  const router = useRouter();
  const { userId, displayName, username } = useCurrentUser();
  const [mounted, setMounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousActive = useRef<HTMLElement | null>(null);
  const [formHeight, setFormHeight] = useState<number | null>(null);

  // ─── Party data ──────────────────────────────────────────
  const [party, setParty] = useState<Party | null>(null);
  const [partyLoading, setPartyLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !partyId) return;
    let cancelled = false;
    setPartyLoading(true);
    getParty(partyId)
      .then((p) => { if (!cancelled) setParty(p); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setPartyLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, partyId]);

  // ─── Synthetic participants ─────────────────────────────
  const [syntheticParticipants, setSyntheticParticipants] = useState<SyntheticPresenceInfo[]>([]);
  useEffect(() => {
    if (!isOpen || !partyId) return;
    let cancelled = false;
    getSyntheticParticipants(partyId)
      .then((sp) => { if (!cancelled) setSyntheticParticipants(sp); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isOpen, partyId]);

  const world = party ? getWorldConfig(party.world_key) : getWorldConfig("default");
  const aiBg = backgrounds?.get(party?.world_key ?? "default");
  const coverSrc = aiBg?.thumbUrl ?? null;
  const hostConfig = party
    ? getHostConfig(getPartyHostPersonality(party))
    : getHostConfig("default");

  // ─── Presence + activity ─────────────────────────────────
  const presence = usePartyPresence({
    partyId: isOpen ? partyId : null,
    userId,
    displayName,
    username,
  });

  const feedNameMap = useMemo(() => {
    const map = new Map<string, string>();
    presence.participants.forEach((p) => map.set(p.userId, p.displayName));
    return map;
  }, [presence.participants]);

  const { events } = usePartyActivityFeed(
    isOpen ? partyId : "",
    feedNameMap
  );

  const roomSprint = useRoomSprint(events, presence.participants);
  const roomState = useMemo(
    () => computeRoomState(events, presence.participants.length),
    [events, presence.participants.length]
  );
  const roomStateDisplay = ROOM_STATE_CONFIG[roomState];

  // ─── Tasks ────────────────────────────────────────────────
  const { activeTasks, activeTask, selectTask, addTask } = useTasks();

  // ─── Form state ────────────────────────────────────────────
  const [goalText, setGoalText] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [sprintMode, setSprintMode] = useState<SprintMode>("current");
  const [freshDuration, setFreshDuration] = useState(world.defaultSprintLength);
  const [isJoining, setIsJoining] = useState(false);
  const [showTaskPicker, setShowTaskPicker] = useState(false);

  // ─── Countdown state ──────────────────────────────────────────
  const [modalPhase, setModalPhase] = useState<ModalPhase>("form");
  const [countdownNumber, setCountdownNumber] = useState(5);
  const joinConfigRef = useRef<JoinConfig | null>(null);

  // Reset form state when modal opens
  useEffect(() => {
    if (isOpen) {
      setGoalText("");
      setSelectedTaskId(null);
      setSprintMode(roomSprint.hasActiveSprint ? "current" : "fresh");
      setFreshDuration(world.defaultSprintLength);
      setIsJoining(false);
      setShowTaskPicker(false);
      setModalPhase("form");
      setCountdownNumber(5);
      setFormHeight(null);
      joinConfigRef.current = null;
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync sprint mode when room sprint info changes
  useEffect(() => {
    if (!roomSprint.hasActiveSprint && sprintMode === "current") {
      setSprintMode("fresh");
    }
  }, [roomSprint.hasActiveSprint, sprintMode]);

  // ─── Task suggestions (up to 3 active tasks) ──────────────
  const taskSuggestions = useMemo(() => {
    // Sort by updated_at desc to get most recent first
    const sorted = [...activeTasks].sort(
      (a, b) =>
        new Date(b.updated_at ?? b.created_at).getTime() -
        new Date(a.updated_at ?? a.created_at).getTime()
    );
    return sorted.slice(0, 3);
  }, [activeTasks]);

  const selectedTask = useMemo(
    () => activeTasks.find((t) => t.id === selectedTaskId) ?? null,
    [activeTasks, selectedTaskId]
  );

  const hasGoal = goalText.trim().length > 0 || selectedTaskId !== null;

  // ─── Computed sprint info ─────────────────────────────────
  const durationSec = useMemo(() => {
    if (sprintMode === "current") return roomSprint.remainingSeconds;
    return freshDuration * 60;
  }, [sprintMode, roomSprint.remainingSeconds, freshDuration]);

  const buttonLabel = useMemo(() => {
    if (!hasGoal) return "Join Sprint";
    if (sprintMode === "next") return `Join Sprint · ${formatMinutes(durationSec)}`;
    return `Join Sprint · ${formatMinutes(durationSec)}`;
  }, [hasGoal, sprintMode, durationSec]);

  // ─── Handlers ──────────────────────────────────────────────

  const handleSuggestionClick = useCallback(
    (task: (typeof taskSuggestions)[0], isContinue: boolean) => {
      setSelectedTaskId(task.id);
      setGoalText(task.title);
      setShowTaskPicker(false);
    },
    []
  );

  const handleCustomClick = useCallback(() => {
    setSelectedTaskId(null);
    setGoalText("");
    inputRef.current?.focus();
  }, []);

  const handleGoalChange = useCallback((text: string) => {
    setGoalText(text);
    // If user types something, clear task selection (it's freeform now)
    setSelectedTaskId(null);
  }, []);

  const handleTaskPickerSelect = useCallback(
    (taskId: string, taskTitle: string) => {
      setSelectedTaskId(taskId);
      setGoalText(taskTitle);
      setShowTaskPicker(false);
    },
    []
  );

  const handleJoin = useCallback(async () => {
    if (!userId || !hasGoal || isJoining) return;
    setIsJoining(true);

    try {
      // Join the party (user appears in room during countdown)
      await joinParty(partyId, userId, displayName);

      // If a task was selected, select it in the task system
      if (selectedTaskId) selectTask(selectedTaskId);

      // Store config for after countdown completes
      joinConfigRef.current = {
        taskId: selectedTaskId,
        goalText: goalText.trim() || selectedTask?.title || "",
        durationSec,
        autoStart: sprintMode === "current" || sprintMode === "fresh",
      };

      // Capture panel dimensions so countdown screen matches exactly
      if (panelRef.current) {
        setFormHeight(panelRef.current.offsetHeight);
      }

      // Transition to countdown phase
      setModalPhase("countdown");
      setIsJoining(false);
    } catch (err) {
      console.error("[JoinRoomModal] join failed:", err);
      setIsJoining(false);
    }
  }, [
    userId, hasGoal, isJoining, partyId, displayName,
    selectedTaskId, goalText, selectedTask, durationSec,
    sprintMode, selectTask,
  ]);

  // ─── Countdown timer ─────────────────────────────────────────
  useEffect(() => {
    if (modalPhase !== "countdown") return;
    let count = 5;
    setCountdownNumber(5);

    const interval = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdownNumber(count);
      } else {
        clearInterval(interval);
        // Countdown complete — start session and close modal
        if (joinConfigRef.current) {
          if (onJoin) {
            onJoin(joinConfigRef.current);
          } else {
            sessionStorage.setItem("fp_join_config", JSON.stringify(joinConfigRef.current));
            router.push(`/environment/${partyId}`);
          }
        }
        onClose();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [modalPhase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Modal plumbing ────────────────────────────────────────
  useEffect(() => { setMounted(true); }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    previousActive.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      previousActive.current?.focus();
    };
  }, [isOpen]);

  if (!isOpen || !mounted || typeof document === "undefined") return null;

  // ─── Avatar cluster (synthetic participants) ────────────────
  const visibleSynthAvatars = syntheticParticipants.slice(0, 4);
  const synthOverflow = syntheticParticipants.length - visibleSynthAvatars.length;

  const content = (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Join room"
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 40 }}
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[var(--color-navy-700)]/60 backdrop-blur-[8px]"
        aria-hidden
        onClick={onClose}
      />

      {/* Modal panel — dead center */}
      <div
        ref={panelRef}
        className="relative w-full max-w-[520px] overflow-hidden rounded-[var(--radius-xl)]"
        style={{
          background: "rgba(10,10,10,0.94)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow:
            "0 16px 48px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
          ...(modalPhase === "countdown" && formHeight ? { height: formHeight } : {}),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-white/40 transition hover:bg-white/[0.08] hover:text-white/70"
          aria-label="Close"
        >
          <X size={15} strokeWidth={2.5} />
        </button>

        {partyLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          </div>
        ) : modalPhase === "countdown" ? (
          /* ── COUNTDOWN SCREEN ──────────────────────────── */
          <div
            className="flex h-full flex-col items-center justify-center px-5"
            style={{ animation: "fp-setup-enter 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
          >
            {/* Countdown number */}
            <div
              key={countdownNumber}
              className="animate-countdown-pop select-none text-8xl font-bold text-white"
              style={{ fontFamily: "var(--font-montserrat), sans-serif" }}
            >
              {countdownNumber}
            </div>

            {/* Subtitle */}
            <p className="mt-4 text-sm text-white/50">
              Get ready to focus
            </p>

            {/* Progress dots */}
            <div className="mt-6 flex items-center gap-2">
              {[5, 4, 3, 2, 1].map((n) => {
                const isCompleted = n > countdownNumber;
                const isActive = n === countdownNumber;
                return (
                  <div
                    key={n}
                    className="h-2 w-2 rounded-full transition-all duration-300"
                    style={{
                      background: isCompleted
                        ? "var(--color-accent-primary)"
                        : isActive
                          ? "var(--color-accent-primary)"
                          : "rgba(255,255,255,0.12)",
                      opacity: isActive ? 1 : isCompleted ? 0.6 : 1,
                      transform: isActive ? "scale(1.3)" : "scale(1)",
                    }}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <>
            {/* ── HEADER: Cover image + room info ─────────── */}
            <div className="flex gap-4 p-5 pb-0">
              {/* Cover image */}
              <div className="relative h-[100px] w-[140px] shrink-0 overflow-hidden rounded-[var(--radius-md)]">
                {coverSrc ? (
                  <Image
                    src={coverSrc}
                    alt={world.label}
                    fill
                    sizes="140px"
                    className="object-cover"
                  />
                ) : (
                  <div
                    className="absolute inset-0"
                    style={{ background: world.placeholderGradient }}
                  />
                )}
              </div>

              {/* Room info */}
              <div className="min-w-0 flex-1 pt-0.5">
                <h2
                  className="truncate text-xl font-bold text-white"
                  style={{ fontFamily: "var(--font-montserrat), sans-serif" }}
                >
                  {party?.name ?? world.label}
                </h2>

                {/* Meta line */}
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-white/50">
                  <Image
                    src={hostConfig.avatarUrl}
                    alt={hostConfig.hostName}
                    width={16}
                    height={16}
                    className="rounded-full"
                  />
                  <span>{hostConfig.hostName} hosting</span>
                  {roomSprint.focusingCount > 0 && (
                    <>
                      <span className="text-white/25">&middot;</span>
                      <span>{roomSprint.focusingCount} focusing now</span>
                    </>
                  )}
                  {roomSprint.hasActiveSprint && (
                    <>
                      <span className="text-white/25">&middot;</span>
                      <span>{formatMinutes(roomSprint.remainingSeconds)} remaining</span>
                    </>
                  )}
                </div>

                {/* Avatars */}
                {visibleSynthAvatars.length > 0 && (
                  <div className="mt-2 flex items-center">
                    <span className="flex">
                      {visibleSynthAvatars.map((p, i) => (
                        <img
                          key={p.id}
                          src={p.avatarUrl}
                          alt={p.displayName}
                          width={22}
                          height={22}
                          className="rounded-full object-cover"
                          style={{
                            width: 22,
                            height: 22,
                            marginLeft: i === 0 ? 0 : -5,
                            border: "1.5px solid rgba(10,10,10,0.9)",
                            zIndex: visibleSynthAvatars.length - i,
                            position: "relative",
                          }}
                        />
                      ))}
                    </span>
                    {synthOverflow > 0 && (
                      <span className="ml-1.5 text-[11px] text-white/40">
                        +{synthOverflow}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="mx-5 mt-4 border-t border-white/6" />

            {/* ── TASK INPUT ──────────────────────────────── */}
            <div className="px-5 pt-4">
              <label className="mb-2 block text-sm font-semibold text-white">
                What are you working on?
              </label>

              {/* Text input */}
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={goalText}
                  onChange={(e) => handleGoalChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && hasGoal) handleJoin(); }}
                  placeholder="Write your task or goal..."
                  className="w-full rounded-full py-2.5 pl-4 pr-10 text-sm text-white placeholder-white/30 outline-none ring-0 ring-white/0 transition-all focus:ring-1 focus:ring-white/12"
                  style={{
                    background: "var(--color-bg-elevated)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowTaskPicker(!showTaskPicker)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-1 text-white/30 transition hover:text-white/60"
                  aria-label="Browse tasks"
                >
                  <ListTodo size={16} />
                </button>
              </div>

              {/* Task picker dropdown — absolute so it doesn't push modal content */}
              {showTaskPicker && activeTasks.length > 0 && (
                <div
                  className="absolute left-0 right-0 z-20 mx-5 mt-1.5 max-h-40 overflow-y-auto rounded-xl py-1 shadow-2xl"
                  style={{
                    background: "rgba(10,10,10,0.95)",
                    backdropFilter: "blur(16px)",
                    WebkitBackdropFilter: "blur(16px)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {activeTasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => handleTaskPickerSelect(task.id, task.title)}
                      className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-white/[0.08]"
                      style={{
                        color:
                          selectedTaskId === task.id
                            ? world.accentColor
                            : "rgba(255,255,255,0.7)",
                      }}
                    >
                      <span className="truncate">{task.title}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Suggestion pills — single row, truncating */}
              {taskSuggestions.length > 0 && (
                <div className="mt-3 flex items-center gap-1.5 overflow-hidden">
                  <span className="shrink-0 text-[11px] text-white/35">Suggestions:</span>
                  {taskSuggestions.map((task, i) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => handleSuggestionClick(task, i === 0)}
                      className="min-w-0 cursor-pointer truncate rounded-full px-2.5 py-1 text-[11px] font-medium transition-all"
                      style={{
                        background:
                          selectedTaskId === task.id
                            ? `${world.accentColor}25`
                            : "rgba(255,255,255,0.06)",
                        color:
                          selectedTaskId === task.id
                            ? world.accentColor
                            : "rgba(255,255,255,0.5)",
                        border:
                          selectedTaskId === task.id
                            ? `1px solid ${world.accentColor}40`
                            : "1px solid transparent",
                      }}
                    >
                      {i === 0 && (
                        <RotateCw
                          size={10}
                          className="mr-1 inline-block"
                          strokeWidth={2.5}
                        />
                      )}
                      {i === 0 ? `Continue: ${task.title}` : task.title}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleCustomClick}
                    className="shrink-0 cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-medium text-white/35 transition-colors hover:text-white/55"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid transparent",
                    }}
                  >
                    Custom...
                  </button>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="mx-5 mt-4 border-t border-white/6" />

            {/* ── SPRINT OPTIONS ──────────────────────────── */}
            <div className="px-5 pt-4">
              {roomSprint.hasActiveSprint ? (
                <>
                  <label className="mb-2 block text-sm font-semibold text-white">
                    Join
                  </label>
                  <div className="flex flex-col gap-2">
                    {/* Current Sprint */}
                    <button
                      type="button"
                      onClick={() => setSprintMode("current")}
                      className="flex w-full cursor-pointer items-center justify-between rounded-xl px-4 py-3 text-left transition-all"
                      style={{
                        background:
                          sprintMode === "current"
                            ? `${world.accentColor}0C`
                            : "transparent",
                        border:
                          sprintMode === "current"
                            ? `1.5px solid ${world.accentColor}60`
                            : "1.5px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          {sprintMode === "current" && (
                            <span
                              className="inline-block h-1.5 w-1.5 rounded-full"
                              style={{ background: world.accentColor }}
                            />
                          )}
                          <span className="text-sm font-semibold text-white">
                            Current Sprint
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-white/50">
                          {formatMinutes(roomSprint.remainingSeconds)} remaining &middot; {roomSprint.focusingCount} people focusing
                        </p>
                      </div>
                      {/* Radio indicator */}
                      <div
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
                        style={{
                          borderColor:
                            sprintMode === "current"
                              ? world.accentColor
                              : "rgba(255,255,255,0.2)",
                        }}
                      >
                        {sprintMode === "current" && (
                          <div
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: world.accentColor }}
                          />
                        )}
                      </div>
                    </button>

                    {/* Next Sprint */}
                    <button
                      type="button"
                      onClick={() => setSprintMode("next")}
                      className="flex w-full cursor-pointer items-center justify-between rounded-xl px-4 py-3 text-left transition-all"
                      style={{
                        background:
                          sprintMode === "next"
                            ? `${world.accentColor}0C`
                            : "transparent",
                        border:
                          sprintMode === "next"
                            ? `1.5px solid ${world.accentColor}60`
                            : "1.5px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          {sprintMode === "next" && (
                            <span
                              className="inline-block h-1.5 w-1.5 rounded-full"
                              style={{ background: world.accentColor }}
                            />
                          )}
                          <span className="text-sm font-semibold text-white">
                            Next Sprint
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-white/50">
                          Starts in {formatMinutes(roomSprint.remainingSeconds)} &middot; Join fresh with group
                        </p>
                      </div>
                      <div
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
                        style={{
                          borderColor:
                            sprintMode === "next"
                              ? world.accentColor
                              : "rgba(255,255,255,0.2)",
                        }}
                      >
                        {sprintMode === "next" && (
                          <div
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: world.accentColor }}
                          />
                        )}
                      </div>
                    </button>
                  </div>
                </>
              ) : (
                /* Quiet room — show duration pills */
                <>
                  <label className="mb-2 block text-sm font-semibold text-white">
                    Sprint duration
                  </label>
                  <DurationPills
                    value={freshDuration}
                    onChange={setFreshDuration}
                  />
                </>
              )}
            </div>

            {/* ── FOOTER ──────────────────────────────────── */}
            <div className="flex items-center justify-end gap-3 px-5 pb-5 pt-5">
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded-full px-5 py-2.5 text-sm font-medium text-white/50 transition-colors hover:text-white/80"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleJoin}
                disabled={!hasGoal || isJoining}
                className="cursor-pointer rounded-full bg-[var(--color-accent-primary)] px-6 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:opacity-85 hover:scale-[1.02] active:scale-[0.98] active:opacity-75 disabled:cursor-default disabled:opacity-40 disabled:hover:scale-100"
              >
                {isJoining ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Joining...
                  </span>
                ) : (
                  buttonLabel
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
