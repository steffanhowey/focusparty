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
import { RotateCw, ListTodo, X, Sparkles, Loader2 } from "lucide-react";
import { JoinCountdownScreen } from "./JoinCountdownScreen";
import { JoinRoomHeader } from "./JoinRoomHeader";
import { JoinSprintOptions } from "./JoinSprintOptions";
import { CommitmentPicker } from "./CommitmentPicker";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { useTasks } from "@/lib/useTasks";
import { useGoals } from "@/lib/useGoals";
import type { CommitmentType } from "@/lib/types";
import { usePartyPresence } from "@/lib/usePartyPresence";
import { usePartyActivityFeed } from "@/lib/usePartyActivityFeed";
import { useRoomSprint } from "@/lib/useRoomSprint";
import { computeRoomState, ROOM_STATE_CONFIG } from "@/lib/roomState";
import { getParty, joinParty, getSyntheticParticipants, type Party, type SyntheticPresenceInfo } from "@/lib/parties";
import { getWorldConfig, getPartyHostPersonality } from "@/lib/worlds";
import { getHostConfig } from "@/lib/hosts";
import { useFocusTrap } from "@/lib/useFocusTrap";
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
  goalId: string | null;
  goalText: string;
  durationSec: number;
  autoStart: boolean;
  commitmentType: CommitmentType;
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
  useFocusTrap(overlayRef, isOpen && mounted);

  // ─── Party data ──────────────────────────────────────────
  const [party, setParty] = useState<Party | null>(null);
  const [partyLoading, setPartyLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !partyId) return;
    let cancelled = false;
    setPartyLoading(true);
    getParty(partyId)
      .then((p) => { if (!cancelled) setParty(p); })
      .catch((err) => console.error("Failed to fetch party:", err))
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
      .catch((err) => console.error("Failed to fetch synthetic participants:", err));
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

  // ─── Tasks + Goals ──────────────────────────────────────────
  const { activeTasks, activeTask, selectTask, addTask } = useTasks();
  const { activeGoals } = useGoals();

  // ─── Form state ────────────────────────────────────────────
  const [goalText, setGoalText] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [commitmentType, setCommitmentType] = useState<CommitmentType>("personal");
  const [isAISuggesting, setIsAISuggesting] = useState(false);
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
      setCommitmentType("personal");
      setIsAISuggesting(false);
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

  // ─── Task suggestions (up to 3, goal-linked tasks first) ──
  const taskSuggestions = useMemo(() => {
    const sorted = [...activeTasks].sort((a, b) => {
      // Goal-linked tasks first
      const aHasGoal = a.goal_id ? 1 : 0;
      const bHasGoal = b.goal_id ? 1 : 0;
      if (bHasGoal !== aHasGoal) return bHasGoal - aHasGoal;
      // Then by recency
      return (
        new Date(b.updated_at ?? b.created_at).getTime() -
        new Date(a.updated_at ?? a.created_at).getTime()
      );
    });
    return sorted.slice(0, 3);
  }, [activeTasks]);

  // Derive goal_id from selected task
  const selectedGoalId = useMemo(() => {
    if (!selectedTaskId) return null;
    const task = activeTasks.find((t) => t.id === selectedTaskId);
    return task?.goal_id ?? null;
  }, [selectedTaskId, activeTasks]);

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

  const handleAISuggest = useCallback(async () => {
    if (activeGoals.length === 0) return;
    setIsAISuggesting(true);
    try {
      // Pick the first active goal for AI suggestion
      const goal = activeGoals[0];
      const goalTasks = activeTasks.filter((t) => t.goal_id === goal.id);
      const res = await fetch("/api/goals/suggest-next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goalTitle: goal.title,
          tasks: goalTasks.map((t) => ({ title: t.title, status: t.status })),
        }),
      });
      if (!res.ok) throw new Error("AI suggest failed");
      const data = await res.json();
      if (data.suggestedTaskTitle) {
        const existing = goalTasks.find(
          (t) => t.title === data.suggestedTaskTitle && t.status !== "done"
        );
        if (existing) {
          setSelectedTaskId(existing.id);
          setGoalText(existing.title);
        } else {
          setSelectedTaskId(null);
          setGoalText(data.suggestedTaskTitle);
        }
      }
    } catch (err) {
      console.error("AI suggest failed:", err);
    } finally {
      setIsAISuggesting(false);
    }
  }, [activeGoals, activeTasks]);

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
        goalId: selectedGoalId,
        goalText: goalText.trim() || selectedTask?.title || "",
        durationSec,
        autoStart: sprintMode === "current" || sprintMode === "fresh",
        commitmentType,
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
    selectedTaskId, selectedGoalId, goalText, selectedTask, durationSec,
    sprintMode, commitmentType, selectTask,
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
          <JoinCountdownScreen countdownNumber={countdownNumber} />
        ) : (
          <>
            <JoinRoomHeader
              party={party}
              world={world}
              hostConfig={hostConfig}
              coverSrc={coverSrc}
              focusingCount={roomSprint.focusingCount}
              hasActiveSprint={roomSprint.hasActiveSprint}
              remainingSeconds={roomSprint.remainingSeconds}
              syntheticParticipants={syntheticParticipants}
            />

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

              {/* Task picker dropdown — grouped by goal */}
              {showTaskPicker && activeTasks.length > 0 && (
                <div
                  className="absolute left-0 right-0 z-20 mx-5 mt-1.5 max-h-48 overflow-y-auto rounded-xl py-1 shadow-2xl"
                  style={{
                    background: "rgba(10,10,10,0.95)",
                    backdropFilter: "blur(16px)",
                    WebkitBackdropFilter: "blur(16px)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {/* Tasks grouped by goal */}
                  {activeGoals.map((goal) => {
                    const goalTasks = activeTasks.filter((t) => t.goal_id === goal.id);
                    if (goalTasks.length === 0) return null;
                    return (
                      <div key={goal.id}>
                        <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                          {goal.title}
                        </div>
                        {goalTasks.map((task) => (
                          <button
                            key={task.id}
                            type="button"
                            onClick={() => handleTaskPickerSelect(task.id, task.title)}
                            className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-white/[0.08]"
                            style={{
                              color: selectedTaskId === task.id ? world.accentColor : "rgba(255,255,255,0.7)",
                            }}
                          >
                            <span className="truncate">{task.title}</span>
                          </button>
                        ))}
                      </div>
                    );
                  })}
                  {/* Loose tasks (no goal) */}
                  {activeTasks.filter((t) => !t.goal_id).length > 0 && (
                    <div>
                      {activeGoals.length > 0 && (
                        <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                          Other tasks
                        </div>
                      )}
                      {activeTasks.filter((t) => !t.goal_id).map((task) => (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => handleTaskPickerSelect(task.id, task.title)}
                          className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-white/[0.08]"
                          style={{
                            color: selectedTaskId === task.id ? world.accentColor : "rgba(255,255,255,0.7)",
                          }}
                        >
                          <span className="truncate">{task.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
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
                  {activeGoals.length > 0 && (
                    <button
                      type="button"
                      onClick={handleAISuggest}
                      disabled={isAISuggesting}
                      className="shrink-0 cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors disabled:cursor-default disabled:opacity-50"
                      style={{
                        background: `${world.accentColor}15`,
                        color: world.accentColor,
                        border: `1px solid ${world.accentColor}30`,
                      }}
                    >
                      {isAISuggesting ? (
                        <Loader2 size={10} className="inline-block animate-spin mr-1" />
                      ) : (
                        <Sparkles size={10} className="inline-block mr-1" />
                      )}
                      {isAISuggesting ? "Thinking..." : "Suggest"}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="mx-5 mt-4 border-t border-white/6" />

            <JoinSprintOptions
              hasActiveSprint={roomSprint.hasActiveSprint}
              remainingSeconds={roomSprint.remainingSeconds}
              focusingCount={roomSprint.focusingCount}
              sprintMode={sprintMode}
              onSprintModeChange={setSprintMode}
              freshDuration={freshDuration}
              onFreshDurationChange={setFreshDuration}
              accentColor={world.accentColor}
            />

            {/* Commitment level */}
            <CommitmentPicker
              value={commitmentType}
              onChange={setCommitmentType}
              accentColor={world.accentColor}
            />

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
