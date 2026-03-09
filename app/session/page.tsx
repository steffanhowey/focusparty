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
import { updatePartyStatus } from "@/lib/parties";
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

type SidePanel = "none" | "tasks" | "chat" | "settings";
const PANEL_WIDTH = 380;
const DEFAULT_DURATION_SEC = 25 * 60;

export default function SessionPage() {
  const router = useRouter();
  const { userId, displayName } = useCurrentUser();
  const { characterAccent } = useTheme();
  const persistence = useSessionPersistence(userId);
  const [phase, setPhase] = useState<SessionPhase>("setup");
  const [goal, setGoal] = useState("");
  const [durationSec, setDurationSec] = useState(DEFAULT_DURATION_SEC);
  const [activePanel, setActivePanel] = useState<SidePanel>("tasks");
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

    // Persist: mark sprint completed + update phase
    persistence.completeSprint().catch(() => {});
    persistence.updatePhase("review").catch(() => {});
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
      setPhase(s.phase);
      setGoal(s.goal_text ?? "");
      setDurationSec(s.planned_duration_sec);

      // Restore task selection if session has a task
      if (s.task_id) selectTask(s.task_id);

      // Resume timer if sprint is still active
      if (s.phase === "sprint" && persistence.currentSprint && !persistence.currentSprint.completed) {
        const remaining = computeRemainingSeconds(persistence.currentSprint);
        if (remaining > 0) {
          timer.reset(remaining);
          timer.start();
        } else {
          // Sprint expired while away — go directly to review
          handleTimerComplete();
        }
      }
    }
  }, [persistence.isHydrating, persistence.wasRestored, persistence.sessionRow]); // eslint-disable-line react-hooks/exhaustive-deps

  const closePanel = useCallback(() => setActivePanel("none"), []);
  const handleToggleTasks = useCallback(
    () => setActivePanel((prev) => (prev === "tasks" ? "none" : "tasks")),
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
    reviewElapsedRef.current = durationSec - timer.getSnapshot().seconds;
    timer.pause();
    camera.stop();
    screenShare.stop();
    music.pause();
    setPhase("review");

    // Persist: sprint ended early + update phase
    persistence.completeSprint().catch(() => {});
    persistence.updatePhase("review").catch(() => {});
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
        .catch(() => {});
      persistence.updatePhase("sprint").catch(() => {});
    }
  }, [durationSec, timer.reset, timer.start, persistence, hostTriggers]);

  const handleDone = useCallback(() => {
    // AI host: notify session completed before navigating away
    hostTriggers.triggerSessionCompleted();
    // Persist: end session as completed
    persistence.endSession("completed").catch(() => {});
    // Mark non-persistent parties as completed so they stop appearing in discovery
    // Persistent rooms stay active permanently.
    if (partyId && !party?.persistent) {
      updatePartyStatus(partyId, "completed").catch(() => {});
    }
    router.push("/party");
  }, [router, persistence, hostTriggers, partyId, party?.persistent]);

  const handleReflectionComplete = useCallback(
    (reflection: SessionReflection) => {
      // Persist reflection to Supabase
      persistence
        .submitReflection({
          mood: reflection.mood,
          productivity: reflection.productivity,
          actual_duration_sec: reflection.sessionDurationSec,
        })
        .catch(() => {});
    },
    [persistence]
  );

  const handleStartTask = useCallback(
    (taskId: string) => {
      if (!activeTask || activeTask.id === taskId) {
        selectTask(taskId);
      } else {
        setPendingSwitchTaskId(taskId);
      }
    },
    [activeTask, selectTask]
  );

  const handleSwitchConfirm = useCallback(
    (action: "complete" | "switch") => {
      if (action === "complete" && activeTask) {
        completeTask(activeTask.id);
      }
      if (pendingSwitchTaskId) {
        selectTask(pendingSwitchTaskId);
      }
      setPendingSwitchTaskId(null);
    },
    [activeTask, completeTask, selectTask, pendingSwitchTaskId]
  );

  const handleSwitchCancel = useCallback(() => {
    setPendingSwitchTaskId(null);
  }, []);
  const handleSwitchComplete = useCallback(() => handleSwitchConfirm("complete"), [handleSwitchConfirm]);
  const handleSwitchSwitch = useCallback(() => handleSwitchConfirm("switch"), [handleSwitchConfirm]);

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
        background: selectedVibe ? undefined : "#0d0e20",
        "--color-bg-primary": "#0d0e20",
        "--color-bg-secondary": "#0d0e20",
        "--color-bg-elevated": "#11132b",
        "--color-bg-hover": "rgba(255, 255, 255, 0.08)",
        "--color-bg-active": "rgba(255, 255, 255, 0.12)",
        "--color-text-primary": "#ffffff",
        "--color-text-secondary": "#c3c4ca",
        "--color-text-tertiary": "#888995",
        "--color-text-on-accent": "#ffffff",
        "--color-border-default": "rgba(255, 255, 255, 0.08)",
        "--color-border-focus": "#7c5cfc",
        "--color-border-subtle": "rgba(255, 255, 255, 0.04)",
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
          onStartTask={selectTask}
          onCompleteTask={completeTask}
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
                drawerOpen={activePanel === "tasks"}
                onToggleDrawer={handleToggleTasks}
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
                  onOpenTasks={handleToggleTasks}
                  onOpenSettings={handleToggleSettings}
                  chatActive={activePanel === "chat"}
                  tasksActive={activePanel === "tasks"}
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
              className="flex flex-col rounded-xl border border-[var(--color-border-default)]"
              style={{
                width: PANEL_WIDTH - 16,
                height: "calc(100% - 32px)",
                margin: "16px 16px 16px 0",
                background: "rgba(13,14,32,0.65)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
              role="complementary"
              aria-label={activePanel === "tasks" ? "Tasks" : activePanel === "chat" ? "Chat" : "Settings"}
            >
              {(activePanel === "tasks" || activePanel === "chat") && (
                <SideDrawer
                  onClose={closePanel}
                  panel={activePanel as "tasks" | "chat"}
                  activeTasks={activeTasks}
                  completedTasks={completedTasks}
                  onCompleteTask={completeTask}
                  onUncompleteTask={uncompleteTask}
                  onAddTask={addTask}
                  onDeleteTask={deleteTask}
                  onEditTask={editTask}
                  onReorderTasks={reorderTasks}
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
    </div>
  );
}
