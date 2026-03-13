"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ListTodo, Play } from "lucide-react";
import { JoinCountdownScreen } from "./JoinCountdownScreen";
import { JoinRoomHeader } from "./JoinRoomHeader";
import { JoinSprintOptions } from "./JoinSprintOptions";
import { CommitmentPicker } from "./CommitmentPicker";
import { CommitmentTaskPicker } from "./CommitmentTaskPicker";
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
  /** Presence from the parent environment page — avoids duplicate channel. */
  presence?: { participants: import("@/lib/types").PresencePayload[]; count: number };
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
  musicAutoPlay: boolean;
}

function formatMinutes(seconds: number): string {
  const m = Math.ceil(seconds / 60);
  return `${m}m`;
}

export function JoinRoomModal({ partyId, isOpen, onClose, backgrounds, onJoin, presence: externalPresence }: JoinRoomModalProps) {
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
  // Use parent's presence when available to avoid a duplicate channel
  // (which can cause the user to disappear from presence on modal close).
  const ownPresence = usePartyPresence({
    partyId: isOpen && !externalPresence ? partyId : null,
    userId,
    displayName,
    username,
  });
  const presence = externalPresence ?? ownPresence;

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
  const [sprintMode, setSprintMode] = useState<SprintMode>("current");
  const [freshDuration, setFreshDuration] = useState(25);
  const [isJoining, setIsJoining] = useState(false);
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [formStep, setFormStep] = useState<1 | 2>(1);

  // ─── Countdown state ──────────────────────────────────────────
  const [modalPhase, setModalPhase] = useState<ModalPhase>("form");
  const [countdownNumber, setCountdownNumber] = useState(5);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const joinConfigRef = useRef<JoinConfig | null>(null);

  // Reset form state when modal opens
  useEffect(() => {
    if (isOpen) {
      setGoalText("");
      setSelectedTaskId(null);
      setSelectedGoalId(null);
      setSprintMode(roomSprint.hasActiveSprint ? "current" : "fresh");
      setFreshDuration(25);
      setIsJoining(false);
      setShowTaskPicker(false);
      setCommitmentType("personal");
      setModalPhase("form");
      setFormStep(1);
      setCountdownNumber(5);
      setMusicEnabled(false);
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

  // ─── Continue task (most recently updated incomplete task) ──
  const continueTask = useMemo(() => {
    if (activeTasks.length === 0) return null;
    const sorted = [...activeTasks].sort((a, b) =>
      new Date(b.updated_at ?? b.created_at).getTime() -
      new Date(a.updated_at ?? a.created_at).getTime()
    );
    // Only suggest if the task was touched recently (status = in_progress preferred)
    const inProgress = sorted.find((t) => t.status === "in_progress");
    return inProgress ?? sorted[0];
  }, [activeTasks]);

  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  const selectedTask = useMemo(
    () => activeTasks.find((t) => t.id === selectedTaskId) ?? null,
    [activeTasks, selectedTaskId]
  );

  const hasGoal = goalText.trim().length > 0 || selectedTaskId !== null || selectedGoalId !== null;

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

  const handleContinueClick = useCallback(() => {
    if (!continueTask) return;
    setSelectedTaskId(continueTask.id);
    setSelectedGoalId(continueTask.goal_id);
    if (continueTask.goal_id) {
      const goal = activeGoals.find((g) => g.id === continueTask.goal_id);
      setGoalText(goal ? `${goal.title}: ${continueTask.title}` : continueTask.title);
    } else {
      setGoalText(continueTask.title);
    }
    setShowTaskPicker(false);
  }, [continueTask, activeGoals]);

  const handleGoalChange = useCallback((text: string) => {
    setGoalText(text);
    setSelectedTaskId(null);
    setSelectedGoalId(null);
  }, []);

  const handleTaskPickerSelect = useCallback(
    (taskId: string, taskTitle: string, goalId: string | null) => {
      setSelectedTaskId(taskId);
      setSelectedGoalId(goalId);
      if (goalId) {
        const goal = activeGoals.find((g) => g.id === goalId);
        setGoalText(goal ? `${goal.title}: ${taskTitle}` : taskTitle);
      } else {
        setGoalText(taskTitle);
      }
      setShowTaskPicker(false);
    },
    [activeGoals]
  );

  const handleGoalSelect = useCallback(
    (goalId: string, goalTitle: string) => {
      setSelectedGoalId(goalId);
      setSelectedTaskId(null);
      setGoalText(goalTitle);
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
      // goalText stores the raw task/goal title (not the composite "Goal: Task" display)
      // musicAutoPlay is set to current state — user can toggle during countdown
      joinConfigRef.current = {
        taskId: selectedTaskId,
        goalId: selectedGoalId,
        goalText: selectedTask?.title || goalText.trim(),
        durationSec,
        autoStart: sprintMode === "current" || sprintMode === "fresh",
        commitmentType,
        musicAutoPlay: false,
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
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[4px]"
        aria-hidden
      />

      {/* Modal panel — dead center */}
      <div
        ref={panelRef}
        className={`relative w-full max-w-[520px] rounded-[var(--radius-xl)] ${modalPhase === "countdown" ? "overflow-hidden" : "overflow-visible"}`}
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
        {partyLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          </div>
        ) : modalPhase === "countdown" ? (
          <JoinCountdownScreen
            countdownNumber={countdownNumber}
            musicEnabled={musicEnabled}
            onToggleMusic={() => {
              setMusicEnabled((prev) => {
                const next = !prev;
                if (joinConfigRef.current) joinConfigRef.current.musicAutoPlay = next;
                return next;
              });
            }}
          />
        ) : (
          <>
            <JoinRoomHeader
              party={party}
              world={world}
              coverSrc={coverSrc}
              focusingCount={roomSprint.focusingCount}
              hasActiveSprint={roomSprint.hasActiveSprint}
              remainingSeconds={roomSprint.remainingSeconds}
              syntheticParticipants={syntheticParticipants}
            />

            {/* Divider */}
            <div className="mx-5 mt-4 border-t border-white/6" />

            {formStep === 1 ? (
            <>
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
                  onKeyDown={(e) => { if (e.key === "Enter" && hasGoal) setFormStep(2); }}
                  placeholder="Write your task or goal..."
                  className="w-full rounded-full py-2.5 pl-4 pr-10 text-sm text-white placeholder-white/30 outline-none ring-0 ring-white/0 transition-all focus:ring-1 focus:ring-white/12"
                  style={{
                    background: "var(--color-bg-elevated)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                />
                <span
                  className="absolute right-9 top-1/2 h-5 w-px -translate-y-1/2"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                  aria-hidden
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

              {/* Commitment & task picker dropdown */}
              {showTaskPicker && (activeTasks.length > 0 || activeGoals.length > 0) && (
                <CommitmentTaskPicker
                  goals={activeGoals}
                  tasks={activeTasks}
                  selectedTaskId={selectedTaskId}
                  selectedGoalId={selectedGoalId}
                  accentColor={world.accentColor}
                  onSelectTask={handleTaskPickerSelect}
                  onSelectGoal={handleGoalSelect}
                  onClose={() => setShowTaskPicker(false)}
                />
              )}

              {/* Continue chip — single resumable task */}
              {continueTask && !selectedTaskId && !goalText.trim() && (
                <button
                  type="button"
                  onClick={handleContinueClick}
                  className="mt-3 flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left transition-all hover:bg-white/[0.06]"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <Play size={12} strokeWidth={2} className="shrink-0 text-white/40" />
                  <span className="min-w-0 truncate text-xs text-white/50">
                    Continue: <span className="text-white/70">{continueTask.title}</span>
                  </span>
                </button>
              )}
            </div>

            {/* ── STEP 1 FOOTER ─────────────────────────── */}
            <div className="flex items-center justify-end gap-3 px-5 pb-5 pt-5">
              <button
                type="button"
                onClick={() => setFormStep(2)}
                disabled={!hasGoal}
                className="cursor-pointer rounded-full bg-[var(--color-accent-primary)] px-6 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:opacity-85 hover:scale-[1.02] active:scale-[0.98] active:opacity-75 disabled:cursor-default disabled:opacity-40 disabled:hover:scale-100"
              >
                Next
              </button>
            </div>
            </>
            ) : (
            <>
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

            {/* ── STEP 2 FOOTER ─────────────────────────── */}
            <div className="flex items-center justify-between px-5 pb-5 pt-5">
              <button
                type="button"
                onClick={() => setFormStep(1)}
                className="cursor-pointer rounded-full px-5 py-2.5 text-sm font-medium text-white/50 transition-colors hover:text-white/80"
              >
                Back
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
          </>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
