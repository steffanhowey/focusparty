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
import { ListTodo } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { JoinRoomHeader } from "./JoinRoomHeader";
import { FocusBody } from "@/components/session/FocusBody";
import { DurationPills } from "@/components/session/DurationPills";
import { SPRINT_DURATION_OPTIONS } from "@/lib/constants";
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

export function JoinRoomModal({ partyId, isOpen, onClose, backgrounds, onJoin, presence: externalPresence }: JoinRoomModalProps) {
  const router = useRouter();
  const { userId, displayName, username } = useCurrentUser();
  const [mounted, setMounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousActive = useRef<HTMLElement | null>(null);
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
  const { activeTasks, activeTask, selectTask, addTask, completeTask, deleteTask, editTask } = useTasks();
  const { activeGoals, createGoal, completeGoal, deleteGoal, updateGoal } = useGoals();

  // ─── Form state ────────────────────────────────────────────
  const [goalText, setGoalText] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [commitmentType, setCommitmentType] = useState<CommitmentType>("personal");
  const [freshDuration, setFreshDuration] = useState(25);
  const [isJoining, setIsJoining] = useState(false);
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [formStep, setFormStep] = useState<1 | 2>(1);

  // Reset form state when modal opens
  useEffect(() => {
    if (isOpen) {
      setGoalText("");
      setSelectedTaskId(null);
      setSelectedGoalId(null);
      setFreshDuration(25);
      setIsJoining(false);
      setShowTaskPicker(false);
      setCommitmentType("personal");
      setFormStep(1);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  const selectedTask = useMemo(
    () => activeTasks.find((t) => t.id === selectedTaskId) ?? null,
    [activeTasks, selectedTaskId]
  );

  const hasGoal = goalText.trim().length > 0 || selectedTaskId !== null || selectedGoalId !== null;

  // ─── Computed sprint info ─────────────────────────────────
  const durationSec = freshDuration * 60;

  const buttonLabel = "Join Room";

  // ─── Handlers ──────────────────────────────────────────────

  // ─── FocusBody adapter callbacks ────────────────────────
  const handleFocusAddTask = useCallback(
    (title: string, goalId: string | null) => {
      addTask({ title, goal_id: goalId });
    },
    [addTask]
  );

  const handleFocusAddGoal = useCallback(
    (title: string) => {
      createGoal({ title });
    },
    [createGoal]
  );

  const handleFocusEditGoal = useCallback(
    (goalId: string, newTitle: string) => {
      updateGoal(goalId, { title: newTitle });
    },
    [updateGoal]
  );

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
      await joinParty(partyId, userId, displayName);

      if (selectedTaskId) selectTask(selectedTaskId);

      const config: JoinConfig = {
        taskId: selectedTaskId,
        goalId: selectedGoalId,
        goalText: selectedTask?.title || goalText.trim(),
        durationSec,
        autoStart: true,
        commitmentType,
        musicAutoPlay: false,
      };

      if (onJoin) {
        onJoin(config);
      } else {
        sessionStorage.setItem("fp_join_config", JSON.stringify(config));
        router.push(`/environment/${partyId}`);
      }
      onClose();
    } catch (err) {
      console.error("[JoinRoomModal] join failed:", err);
      setIsJoining(false);
    }
  }, [
    userId, hasGoal, isJoining, partyId, displayName,
    selectedTaskId, selectedGoalId, goalText, selectedTask, durationSec,
    commitmentType, selectTask, onJoin, onClose, router,
  ]);

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
        className="relative w-full max-w-[520px] overflow-visible rounded-xl"
        style={{
          background: "rgba(10,10,10,0.94)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "var(--shadow-xl)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {partyLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          </div>
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

            {/* ── Fixed-height form body — both steps always mounted ── */}
            <div className="relative" style={{ height: 168 }}>

              {/* ── STEP 1: Task input ──────────────────────── */}
              <div
                className="absolute inset-0 flex flex-col transition-opacity duration-200"
                style={{
                  opacity: formStep === 1 ? 1 : 0,
                  pointerEvents: formStep === 1 ? "auto" : "none",
                }}
              >
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
                      onKeyDown={(e) => { if (e.key === "Enter" && hasGoal) { setShowTaskPicker(false); setFormStep(2); } }}
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

                  {/* Task/goal picker dropdown */}
                  {showTaskPicker && (activeTasks.length > 0 || activeGoals.length > 0) && (
                    <div
                      className="absolute left-0 right-0 z-20 mx-5 mt-1.5 overflow-hidden rounded-xl shadow-lg"
                      style={{
                        background: "rgba(10,10,10,0.95)",
                        backdropFilter: "blur(16px)",
                        WebkitBackdropFilter: "blur(16px)",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <FocusBody
                        activeTaskId={selectedTaskId}
                        activeGoalId={selectedGoalId}
                        goals={activeGoals}
                        tasks={activeTasks}
                        accentColor={world.accentColor}
                        onSelectTask={handleTaskPickerSelect}
                        onSelectGoal={handleGoalSelect}
                        onCompleteTask={completeTask}
                        onDeleteTask={deleteTask}
                        onCompleteGoal={completeGoal}
                        onDeleteGoal={deleteGoal}
                        onAddTask={handleFocusAddTask}
                        onAddGoal={handleFocusAddGoal}
                        onEditTask={editTask}
                        onEditGoal={handleFocusEditGoal}
                        maxHeight="max-h-56"
                      />
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="mt-auto flex items-center justify-end gap-3 px-5 pb-5">
                  <Button
                    variant="cta"
                    size="sm"
                    onClick={() => { setShowTaskPicker(false); setFormStep(2); }}
                    disabled={!hasGoal}
                  >
                    Next
                  </Button>
                </div>
              </div>

              {/* ── STEP 2: Duration + join ─────────────────── */}
              <div
                className="absolute inset-0 flex flex-col transition-opacity duration-200"
                style={{
                  opacity: formStep === 2 ? 1 : 0,
                  pointerEvents: formStep === 2 ? "auto" : "none",
                }}
              >
                <div className="px-5 pt-4">
                  <label className="mb-2 block text-sm font-semibold text-white">
                    Sprint duration
                  </label>
                  <DurationPills
                    value={freshDuration}
                    onChange={setFreshDuration}
                    options={SPRINT_DURATION_OPTIONS}
                  />
                </div>

                {/* Footer */}
                <div className="mt-auto flex items-center justify-between px-5 pb-5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFormStep(1)}
                  >
                    Back
                  </Button>
                  <Button
                    variant="cta"
                    size="sm"
                    onClick={handleJoin}
                    disabled={!hasGoal || isJoining}
                    loading={isJoining}
                  >
                    {isJoining ? "Joining..." : buttonLabel}
                  </Button>
                </div>
              </div>
            </div>

          </>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
