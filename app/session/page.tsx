"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useTimer } from "@/lib/useTimer";
import { useCamera } from "@/lib/useCamera";
import { useScreenShare } from "@/lib/useScreenShare";
import { useChat } from "@/lib/useChat";
import { useSettings } from "@/lib/useSettings";
import { useTasks } from "@/lib/useTasks";
import { useMusic } from "@/lib/useMusic";
import { useActiveParty } from "@/lib/useActiveParty";
import { updatePartyStatus, leaveParty } from "@/lib/parties";
import { getWorldConfig, getPartyHostPersonality } from "@/lib/worlds";
import { getHostConfig } from "@/lib/hosts";
import { TopBar } from "@/components/session/TopBar";
import { SplitScreen } from "@/components/session/SplitScreen";
import { SetupScreen } from "@/components/session/SetupScreen";
import { SessionReviewModal } from "@/components/session/SessionReviewModal";
import { CameraPanel } from "@/components/session/CameraPanel";
import { SideDrawer } from "@/components/session/SideDrawer";
import { SettingsPanel } from "@/components/session/SettingsPanel";
import { ActionBar } from "@/components/session/ActionBar";
import { VibeBackground } from "@/components/session/VibeBackground";
import { SwitchTaskModal } from "@/components/session/SwitchTaskModal";
import { BreathingOverlay } from "@/components/session/BreathingOverlay";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { useSessionPersistence } from "@/lib/useSessionPersistence";
import { usePartyPresence } from "@/lib/usePartyPresence";
import { usePartyActivityFeed } from "@/lib/usePartyActivityFeed";
import { computeRoomState, ROOM_STATE_CONFIG } from "@/lib/roomState";
import { useHostTriggers } from "@/lib/useHostTriggers";
import { computeRemainingSeconds } from "@/lib/sprintTime";
import type { SessionPhase, SessionReflection } from "@/lib/types";
import type { VibeId } from "@/lib/musicConstants";
import { useGoals } from "@/lib/useGoals";
import { checkGoalCompletion } from "@/lib/goalCascade";
import { logEvent } from "@/lib/sessions";
import { FloatingFocus } from "@/components/session/FloatingFocus";

type SidePanel = "none" | "chat" | "settings";
const PANEL_WIDTH = 380;
const DEFAULT_DURATION_SEC = 25 * 60;

export default function SessionPage() {
  const router = useRouter();
  const { userId, displayName, username, avatarUrl } = useCurrentUser();
  const { characterAccent } = useTheme();
  const persistence = useSessionPersistence(userId);
  const [phase, setPhase] = useState<SessionPhase>("setup");
  const [goal, setGoal] = useState("");
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState(DEFAULT_DURATION_SEC);
  const [activePanel, setActivePanel] = useState<SidePanel>("none");
  const [focusPopoverOpen, setFocusPopoverOpen] = useState(false);
  const [floatingFocusOpen, setFloatingFocusOpen] = useState(false);
  const focusButtonRef = useRef<HTMLButtonElement>(null);
  const prevPanelRef = useRef<SidePanel>(activePanel);
  const [sprintGoalCardOpen, setSprintGoalCardOpen] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [selectedVibe, setSelectedVibe] = useState<VibeId | null>(null);
  const [sprintEntering, setSprintEntering] = useState(false);
  const reviewElapsedRef = useRef(0);

  // Only animate width when opening/closing, not when swapping panels
  const panelOpen = activePanel !== "none";
  const wasOpen = prevPanelRef.current !== "none";
  const shouldAnimatePanel = panelOpen !== wasOpen;
  useEffect(() => {
    prevPanelRef.current = activePanel;
  }, [activePanel]);
  const [pendingSwitchTaskId, setPendingSwitchTaskId] = useState<string | null>(null);

  // Ref for host trigger to break circular dep: handleTimerComplete → hostTriggers → timer → handleTimerComplete
  const hostTriggersRef = useRef<{ triggerReviewEntered: () => void }>({ triggerReviewEntered: () => {} });

  const handleTimerComplete = useCallback(() => {
    reviewElapsedRef.current = durationSec;
    setPhase("review");

    // fire-and-forget: non-critical persistence
    persistence.completeSprint().catch((err) => console.error("Failed to complete sprint:", err));
    persistence.updatePhase("review").catch((err) => console.error("Failed to update phase to review:", err));
    hostTriggersRef.current.triggerReviewEntered();
  }, [durationSec, persistence]);

  const timer = useTimer(durationSec, handleTimerComplete);
  const camera = useCamera(false);
  const screenShare = useScreenShare();
  const { party, partyId } = useActiveParty();

  // Presence: track this user's status for other party participants
  const presence = usePartyPresence({
    partyId: partyId ?? null,
    userId,
    displayName,
    username,
    avatarUrl,
    character: characterAccent,
    activeSessionId: persistence.sessionRow?.id ?? null,
    phase,
    goalPreview: goal || null,
  });

  // Room signals: activity feed + room state for setup screen
  const feedDisplayNameMap = useMemo(() => {
    const map = new Map<string, string>();
    presence.participants.forEach((p) => map.set(p.userId, p.displayName));
    return map;
  }, [presence.participants]);

  const { events: feedEvents } =
    usePartyActivityFeed(partyId ?? "", feedDisplayNameMap);
  const roomState = useMemo(
    () => computeRoomState(feedEvents, presence.participants.length),
    [feedEvents, presence.participants.length]
  );
  const roomStateDisplay = ROOM_STATE_CONFIG[roomState];

  // AI host: fire trigger prompts at key session moments
  const hostTriggers = useHostTriggers({
    partyId: partyId ?? null,
    sessionId: persistence.sessionRow?.id ?? null,
    sprintId: persistence.currentSprint?.id ?? null,
    userId,
    goalSummary: goal || null,
    participantCount: presence.count,
    sprintNumber: persistence.currentSprint?.sprint_number ?? null,
    sprintDurationSec: durationSec,
    timer,
    phase,
  });
  hostTriggersRef.current = hostTriggers;

  const chat = useChat();
  const { settings, updateSetting } = useSettings();
  const music = useMusic();

  // Auto-play default vibe (calm-focus) when entering sprint phase
  const prevPhaseRef = useRef(phase);
  useEffect(() => {
    const wasNotSprint = prevPhaseRef.current !== "sprint";
    prevPhaseRef.current = phase;
    if (phase !== "sprint" || !wasNotSprint) return;

    const defaultVibe = "calm-focus" as const;
    if (music.activeVibe !== defaultVibe) {
      music.selectVibe(defaultVibe);
    } else if (!music.isPlaying) {
      music.play();
    }
  }, [phase, music]);

  // Sync background vibe with music vibe changes (only during sprint)
  const musicVibeInitRef = useRef(true);
  useEffect(() => {
    if (musicVibeInitRef.current) {
      musicVibeInitRef.current = false;
      return;
    }
    if (phase === "sprint" && music.activeVibe) setSelectedVibe(music.activeVibe);
  }, [music.activeVibe, phase]);

  const {
    activeTasks,
    completedTasks,
    activeTask,
    addTask,
    completeTask,
    uncompleteTask,
    deleteTask,
    editTask,
    selectTask,
    reorderTasks,
  } = useTasks();

  const { activeGoals, createGoal, completeGoal, deleteGoal: deleteGoalApi, updateGoal } = useGoals();

  // ─── Task completion with goal cascade ─────────────────
  const handleCompleteTask = useCallback(
    async (taskId: string) => {
      completeTask(taskId);
      if (!userId) return;
      const task = [...activeTasks, ...completedTasks].find((t) => t.id === taskId);

      // Emit activity event so it appears in the momentum board
      logEvent({
        party_id: partyId ?? null,
        session_id: persistence.sessionRow?.id ?? null,
        user_id: userId,
        event_type: "task_completed",
        body: task?.title ?? null,
      }).catch((err) =>
        console.error("[SessionPage] task_completed event failed:", err?.message ?? err?.code ?? JSON.stringify(err))
      );

      if (task?.goal_id) {
        const goal = activeGoals.find((g) => g.id === task.goal_id);
        if (goal) {
          const allTasks = [...activeTasks, ...completedTasks].filter(
            (t) => t.goal_id === task.goal_id
          );
          const updated = allTasks.map((t) =>
            t.id === taskId ? { ...t, status: "done" as const } : t
          );
          checkGoalCompletion(goal.id, goal.title, updated, {
            userId,
            partyId: partyId ?? "",
            sessionId: persistence.sessionRow?.id ?? null,
          }).catch((err) => console.error("Goal cascade check failed:", err));
        }
      }
    },
    [completeTask, activeTasks, completedTasks, activeGoals, userId, partyId, persistence.sessionRow?.id]
  );

  // ─── Session-scoped commitments (filter for flyout) ─────
  const [committedTaskIds, setCommittedTaskIds] = useState<Set<string>>(new Set());
  const commitTask = useCallback((taskId: string) => {
    setCommittedTaskIds((prev) => {
      if (prev.has(taskId)) return prev;
      const next = new Set(prev);
      next.add(taskId);
      return next;
    });
  }, []);

  const committedActiveTasks = useMemo(
    () => activeTasks.filter((t) => committedTaskIds.has(t.id)),
    [activeTasks, committedTaskIds]
  );

  const committedCompletedTasks = useMemo(
    () => completedTasks.filter((t) => committedTaskIds.has(t.id)),
    [completedTasks, committedTaskIds]
  );

  const addAndCommitTask = useCallback(
    async (text: string) => {
      const newId = await addTask(text);
      if (newId) commitTask(newId);
    },
    [addTask, commitTask]
  );

  // Start fresh — no pre-selected task on setup (skip if restoring active sprint)
  const taskClearRef = useRef(false);
  useEffect(() => {
    if (taskClearRef.current) return;
    taskClearRef.current = true;
    // Defer clear until we know if there's an active session to restore
    if (!persistence.isHydrating && !(persistence.wasRestored && persistence.sessionRow?.phase === "sprint")) {
      selectTask(null);
    }
  }, [persistence.isHydrating, persistence.wasRestored, persistence.sessionRow]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hydrate: restore active session from DB after refresh / room switch
  const hydrationApplied = useRef(false);
  useEffect(() => {
    if (hydrationApplied.current) return;
    if (persistence.isHydrating) return;
    hydrationApplied.current = true;

    if (persistence.wasRestored && persistence.sessionRow) {
      const s = persistence.sessionRow;
      setGoal(s.goal_text ?? "");
      setDurationSec(s.planned_duration_sec);

      // Restore task selection if session has a task
      if (s.task_id) {
        selectTask(s.task_id);
        commitTask(s.task_id);
      }

      // Only an active sprint with remaining time is resumable.
      // Break/review/breathing/setup are ephemeral client states that
      // can't be reconstructed after a page reload.
      const hasActiveSprint =
        persistence.currentSprint && !persistence.currentSprint.completed;
      const isSprintOrBreak = s.phase === "sprint" || s.phase === "break";

      if (isSprintOrBreak && hasActiveSprint) {
        const remaining = computeRemainingSeconds(persistence.currentSprint!);
        if (remaining > 0) {
          setPhase("sprint");
          timer.reset(remaining);
          timer.start();
          if (s.phase !== "sprint") {
            persistence.updatePhase("sprint").catch(() => {});
          }
        } else {
          // Sprint expired while away — silently end stale session, start fresh
          persistence.endSession("completed").catch(() => {});
          if (s.party_id && userId) {
            leaveParty(s.party_id, userId).catch(() => {});
          }
          setPhase("setup");
        }
      } else {
        // No active sprint, or non-resumable phase — end stale session, start fresh
        if (s.status === "active") {
          persistence.endSession("abandoned").catch(() => {});
          if (s.party_id && userId) {
            leaveParty(s.party_id, userId).catch(() => {});
          }
        }
        setPhase("setup");
      }
    }
  }, [persistence.isHydrating, persistence.wasRestored, persistence.sessionRow]); // eslint-disable-line react-hooks/exhaustive-deps

  const closePanel = useCallback(() => setActivePanel("none"), []);
  const handleToggleFocusPopover = useCallback(
    () => setFocusPopoverOpen((prev) => !prev),
    []
  );
  const handleCloseFocusPopover = useCallback(
    () => setFocusPopoverOpen(false),
    []
  );

  const handleStartSprint = useCallback(
    (durationMinutes: number) => {
      if (!activeTask) return;
      setGoal(activeTask.title);
      const sec = durationMinutes * 60;
      setDurationSec(sec);
      timer.reset(sec);
      // TODO: Re-enable breathing overlay once onboarding context is added
      // setPhase("breathing");
      timer.start();
      setPhase("sprint");
      setSprintGoalCardOpen(false);

      // Persist session + first sprint (fire-and-forget)
      if (userId) {
        persistence
          .startSession({
            user_id: userId,
            party_id: partyId ?? undefined,
            task_id: activeTask.id ?? undefined,
            character: characterAccent,
            goal_text: activeTask.title,
            planned_duration_sec: sec,
          })
          .then((session) =>
            persistence.startSprint({
              session_id: session.id,
              sprint_number: 1,
              duration_sec: sec,
            })
          )
          .then(() => {
            persistence.declareGoal({
              user_id: userId,
              task_id: activeTask.id ?? undefined,
              body: activeTask.title,
            });
            // AI host triggers after session + sprint are persisted
            hostTriggers.triggerSessionStarted();
            hostTriggers.triggerSprintStarted();
          })
          .catch((err) =>
            console.error("[SessionPage] persist startSprint failed:", err)
          );
      }
    },
    [activeTask, timer.reset, timer.start, userId, partyId, characterAccent, persistence, hostTriggers]
  );

  const handleBreathingComplete = useCallback(() => {
    timer.start();
    setSprintEntering(true);
    setPhase("sprint");
    // Clear entrance animation flag after it completes
    setTimeout(() => setSprintEntering(false), 600);
  }, [timer.start]);

  const durationMin = Math.round(durationSec / 60);

  const handleChangeDuration = useCallback(
    (durationMinutes: number) => {
      const sec = durationMinutes * 60;
      setDurationSec(sec);
      timer.reset(sec);
      timer.start();
    },
    [timer.reset, timer.start]
  );

  const handleResetTimer = useCallback(() => {
    timer.reset(durationSec);
    timer.start();
  }, [durationSec, timer.reset, timer.start]);

  const handleEndSession = useCallback(() => {
    reviewElapsedRef.current = Math.max(0, durationSec - timer.getSnapshot().seconds);
    timer.pause();
    camera.stop();
    screenShare.stop();
    music.pause();
    setPhase("review");

    // fire-and-forget: non-critical persistence
    persistence.completeSprint().catch((err) => console.error("Failed to complete sprint:", err));
    persistence.updatePhase("review").catch((err) => console.error("Failed to update phase to review:", err));
    hostTriggers.triggerReviewEntered();
  }, [durationSec, timer.getSnapshot, timer.pause, camera.stop, screenShare.stop, music.pause, persistence, hostTriggers]);

  const handleAnotherRound = useCallback(() => {
    timer.reset(durationSec);
    timer.start();
    setPhase("sprint");

    // Persist: new sprint
    if (persistence.sessionRow) {
      const nextNum = (persistence.currentSprint?.sprint_number ?? 0) + 1;
      persistence
        .startSprint({
          session_id: persistence.sessionRow.id,
          sprint_number: nextNum,
          duration_sec: durationSec,
        })
        .then(() => hostTriggers.triggerSprintStarted())
        .catch((err) => console.error("Failed to start another sprint:", err));
      // fire-and-forget: non-critical persistence
      persistence.updatePhase("sprint").catch((err) => console.error("Failed to update phase to sprint:", err));
    }
  }, [durationSec, timer.reset, timer.start, persistence, hostTriggers]);

  const handleDone = useCallback(() => {
    // AI host: notify session completed before navigating away
    hostTriggers.triggerSessionCompleted();
    // fire-and-forget: non-critical persistence
    persistence.endSession("completed").catch((err) => console.error("Failed to end session:", err));
    if (partyId && userId) {
      leaveParty(partyId, userId).catch((err) => console.error("Failed to leave party:", err));
    }
    // Mark non-persistent parties as completed so they stop appearing in discovery
    // Persistent rooms stay active permanently.
    // fire-and-forget: non-critical persistence
    if (partyId && !party?.persistent) {
      updatePartyStatus(partyId, "completed").catch((err) => console.error("Failed to update party status:", err));
    }
    router.push("/rooms");
  }, [router, persistence, hostTriggers, partyId, userId, party?.persistent]);

  const handleReflectionComplete = useCallback(
    (reflection: SessionReflection) => {
      // Persist reflection to Supabase
      persistence
        .submitReflection({
          mood: reflection.mood,
          productivity: reflection.productivity,
          actual_duration_sec: reflection.sessionDurationSec,
        })
        .catch((err) => console.error("Failed to submit reflection:", err));
    },
    [persistence]
  );

  // ─── Clear goal when active task is removed mid-sprint ──
  const prevActiveTaskIdRef = useRef<string | null>(activeTask?.id ?? null);
  useEffect(() => {
    const prevId = prevActiveTaskIdRef.current;
    const currId = activeTask?.id ?? null;
    prevActiveTaskIdRef.current = currId;
    if (prevId && !currId && phase === "sprint") {
      setGoal("");
    }
  }, [activeTask?.id, phase]);

  const handleStartTask = useCallback(
    (taskId: string) => {
      if (!activeTask || activeTask.id === taskId) {
        selectTask(taskId);
        commitTask(taskId);
      } else {
        setPendingSwitchTaskId(taskId);
      }
    },
    [activeTask, selectTask, commitTask]
  );

  const handleSwitchConfirm = useCallback(
    (action: "complete" | "switch") => {
      if (action === "complete" && activeTask) {
        handleCompleteTask(activeTask.id);
      }
      if (pendingSwitchTaskId) {
        selectTask(pendingSwitchTaskId);
        commitTask(pendingSwitchTaskId);
        const newTask = [...activeTasks, ...completedTasks].find(
          (t) => t.id === pendingSwitchTaskId
        );
        if (newTask) setGoal(newTask.title);
      }
      setPendingSwitchTaskId(null);
    },
    [activeTask, handleCompleteTask, selectTask, commitTask, pendingSwitchTaskId, activeTasks, completedTasks]
  );

  const handleActivateFocus = useCallback(
    (taskId: string) => {
      if (activeTask?.id === taskId) return;
      if (activeTask) {
        setPendingSwitchTaskId(taskId);
      } else {
        selectTask(taskId);
        commitTask(taskId);
        const task = [...activeTasks, ...completedTasks].find((t) => t.id === taskId);
        if (task) setGoal(task.title);
      }
    },
    [activeTask, selectTask, commitTask, activeTasks, completedTasks]
  );

  const handleSwitchCancel = useCallback(() => {
    setPendingSwitchTaskId(null);
  }, []);
  const handleSwitchComplete = useCallback(() => handleSwitchConfirm("complete"), [handleSwitchConfirm]);
  const handleSwitchSwitch = useCallback(() => handleSwitchConfirm("switch"), [handleSwitchConfirm]);

  // ─── Focus popover handlers ──────────────────────
  const handlePopoverSelectTask = useCallback(
    (taskId: string, _taskTitle: string, _goalId: string | null) => {
      setActiveGoalId(null);
      handleActivateFocus(taskId);
    },
    [handleActivateFocus],
  );

  const handlePopoverSelectGoal = useCallback(
    (goalId: string, goalTitle: string) => {
      setActiveGoalId(goalId);
      selectTask(null);
      setGoal(goalTitle);
    },
    [selectTask],
  );

  const handleToggleMic = useCallback(() => setMicActive((m) => !m), []);
  const handleToggleChat = useCallback(
    () => setActivePanel((prev) => (prev === "chat" ? "none" : "chat")),
    []
  );
  const handleToggleSettings = useCallback(
    () => setActivePanel((prev) => (prev === "settings" ? "none" : "settings")),
    []
  );

  const handleToggleGoalCard = useCallback(() => setSprintGoalCardOpen((o) => !o), []);
  const handleCloseGoalCard = useCallback(() => setSprintGoalCardOpen(false), []);

  const cameraPanelNode = useMemo(
    () => (
      <CameraPanel
        videoRef={camera.videoRef}
        status={camera.status}
        isActive={camera.isActive}
      />
    ),
    [camera.videoRef, camera.status, camera.isActive]
  );

  return (
    <div
      className="relative flex h-screen w-screen overflow-hidden"
      style={{
        background: selectedVibe ? undefined : "var(--sg-forest-900)",
      } as React.CSSProperties}
    >
      {selectedVibe && <VibeBackground activeVibe={selectedVibe} />}

      {/* Hidden YouTube player — must stay mounted across phases */}
      <div
        data-music-container
        style={{
          position: "fixed",
          bottom: 0,
          right: 0,
          width: 200,
          height: 200,
          clipPath: "inset(100%)",
          overflow: "hidden",
          pointerEvents: "none",
        }}
      >
        <div id={music.playerContainerId} />
      </div>

      {persistence.isHydrating ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-transparent" />
        </div>
      ) : phase === "setup" ? (
        <SetupScreen
          activeTask={activeTask}
          activeTasks={activeTasks}
          completedTasks={completedTasks}
          onStartTask={handleStartTask}
          onCompleteTask={handleCompleteTask}
          onAddTask={addTask}
          onDeleteTask={deleteTask}
          onStartSprint={handleStartSprint}
          roomName={party?.name ?? null}
          roomSubtitle={
            party
              ? `${getHostConfig(getPartyHostPersonality(party)).hostName} hosting`
              : null
          }
          hostAvatarUrl={
            party
              ? getHostConfig(getPartyHostPersonality(party)).avatarUrl
              : null
          }
          defaultDuration={party ? getWorldConfig(party.world_key).defaultSprintLength : undefined}
          presenceParticipants={presence.participants}
          focusingCount={presence.participants.filter(p => p.phase === "sprint").length}
          roomStateIcon={roomStateDisplay.icon}
          roomStateLabel={roomStateDisplay.label}
          roomStateColor={roomStateDisplay.color}
          currentUserId={userId}
        />
      ) : phase === "breathing" ? null : (
        <>
          {/* Main column: full session experience */}
          <div className={`flex min-w-0 flex-1 flex-col overflow-hidden ${sprintEntering ? "animate-fp-sprint-enter" : ""}`}>
            {phase !== "sprint" && phase !== "review" && (
              <TopBar
                phase={phase}
                drawerOpen={false}
                onToggleDrawer={handleToggleFocusPopover}
                settingsOpen={activePanel === "settings"}
                onToggleSettings={handleToggleSettings}
                onEndSession={handleEndSession}
              />
            )}

            <div className="relative flex flex-1 flex-col overflow-hidden">
              <SplitScreen
                character={characterAccent}
                leftPanel={cameraPanelNode}
                screenShareStream={screenShare.stream}
              />

              {/* Click-away to close timer dropdown */}
              {phase === "sprint" && sprintGoalCardOpen && (
                <div
                  className="absolute inset-0 z-10"
                  onClick={handleCloseGoalCard}
                />
              )}

              {phase === "sprint" && (
                <ActionBar
                  micActive={micActive}
                  onToggleMic={handleToggleMic}
                  cameraActive={camera.isActive}
                  onToggleCamera={camera.toggle}
                  onOpenChat={handleToggleChat}
                  onOpenSettings={handleToggleSettings}
                  chatActive={activePanel === "chat"}
                  focusPopover={{
                    open: focusPopoverOpen,
                    onToggle: handleToggleFocusPopover,
                    onClose: handleCloseFocusPopover,
                    goalText: goal,
                    onGoalTextChange: setGoal,
                    activeTaskId: activeTask?.id ?? null,
                    activeGoalId,
                    goals: activeGoals,
                    tasks: activeTasks,
                    accentColor: characterAccent,
                    onSelectTask: handlePopoverSelectTask,
                    onSelectGoal: handlePopoverSelectGoal,
                    onCompleteTask: handleCompleteTask,
                    onDeleteTask: deleteTask,
                    onCompleteGoal: completeGoal,
                    onDeleteGoal: deleteGoalApi,
                    onAddTask: (title: string, goalId: string | null) => addTask({ title, goal_id: goalId }),
                    onAddGoal: (title: string) => createGoal({ title }),
                    onEditTask: editTask,
                    onEditGoal: (goalId: string, newTitle: string) => updateGoal(goalId, { title: newTitle }),
                    onComplete: () => {
                      if (activeTask) {
                        handleCompleteTask(activeTask.id);
                      } else if (activeGoalId) {
                        completeGoal(activeGoalId);
                      } else if (goal.trim()) {
                        // Freeform text — log and clear
                        if (userId) {
                          logEvent({
                            party_id: partyId ?? null,
                            session_id: persistence.sessionRow?.id ?? null,
                            user_id: userId,
                            event_type: "task_completed",
                            body: goal,
                          }).catch(() => {});
                        }
                        setGoal("");
                      }
                      handleCloseFocusPopover();
                    },
                    focusButtonRef,
                  }}
                  settingsActive={activePanel === "settings"}
                  onEndSession={handleEndSession}
                  music={{
                    popoverOpen: music.popoverOpen,
                    togglePopover: music.togglePopover,
                    closePopover: music.closePopover,
                    activeVibe: music.activeVibe,
                    selectVibe: music.selectVibe,
                    isPlaying: music.isPlaying,
                    togglePlayPause: music.togglePlayPause,
                    volume: music.volume,
                    setVolume: music.setVolume,
                    status: music.status,
                    roomControlled: true,
                  }}
                  timer={timer}
                  currentDurationMin={durationMin}
                  onChangeDuration={handleChangeDuration}
                  onResetTimer={handleResetTimer}
                  goalCardOpen={sprintGoalCardOpen}
                  onToggleGoalCard={handleToggleGoalCard}
                />
              )}

            </div>
          </div>

          {/* Right column: shared side panel (pushes entire left column) */}
          <div
            className={`flex-shrink-0 overflow-hidden ${shouldAnimatePanel ? "transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]" : ""}`}
            style={{ width: panelOpen ? PANEL_WIDTH : 0 }}
          >
            <aside
              className="flex flex-col rounded-xl border border-white/[0.08]"
              style={{
                width: PANEL_WIDTH - 16,
                height: "calc(100% - 32px)",
                margin: "16px 16px 16px 0",
                background: "color-mix(in srgb, var(--sg-forest-900) 78%, transparent)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                boxShadow: "var(--shadow-float)",
              }}
              role="complementary"
              aria-label={activePanel === "chat" ? "Chat" : "Settings"}
            >
              {activePanel === "chat" && (
                <SideDrawer
                  onClose={closePanel}
                  panel="chat"
                  messages={chat.messages}
                  onSendMessage={chat.sendMessage}
                />
              )}
              {activePanel === "settings" && (
                <SettingsPanel
                  onClose={closePanel}
                  settings={settings}
                  onUpdateSetting={updateSetting}
                />
              )}
            </aside>
          </div>
        </>
      )}

      <BreathingOverlay
        isOpen={phase === "breathing"}
        goalText={goal}
        onComplete={handleBreathingComplete}
      />

      <SessionReviewModal
        isOpen={phase === "review"}
        sessionDurationSec={durationSec}
        elapsedSec={reviewElapsedRef.current}
        onAnotherRound={handleAnotherRound}
        onDone={handleDone}
        onReflectionComplete={handleReflectionComplete}
      />

      <SwitchTaskModal
        isOpen={pendingSwitchTaskId !== null}
        currentTaskText={activeTask?.title ?? ""}
        onComplete={handleSwitchComplete}
        onSwitch={handleSwitchSwitch}
        onCancel={handleSwitchCancel}
      />

      {/* Floating commitment panel */}
      {floatingFocusOpen && (
        <FloatingFocus
          activeTaskId={activeTask?.id ?? null}
          activeGoalId={activeGoalId}
          goals={activeGoals}
          tasks={activeTasks}
          accentColor={characterAccent}
          onSelectTask={handlePopoverSelectTask}
          onSelectGoal={handlePopoverSelectGoal}
          onCompleteTask={handleCompleteTask}
          onDeleteTask={deleteTask}
          onCompleteGoal={completeGoal}
          onDeleteGoal={deleteGoalApi}
          onAddTask={(title, goalId) => addTask({ title, goal_id: goalId })}
          onAddGoal={(title) => createGoal({ title })}
          onEditTask={editTask}
          onEditGoal={(goalId: string, newTitle: string) => updateGoal(goalId, { title: newTitle })}
          onClose={() => setFloatingFocusOpen(false)}
          focusButtonRef={focusButtonRef}
        />
      )}
    </div>
  );
}
