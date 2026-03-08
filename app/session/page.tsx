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
import { useRouter } from "next/navigation";
import type { SessionPhase, SessionReflection } from "@/lib/types";
import type { VibeId } from "@/lib/musicConstants";

type SidePanel = "none" | "tasks" | "chat" | "settings";
const PANEL_WIDTH = 380;
const DEFAULT_DURATION_SEC = 25 * 60;

export default function SessionPage() {
  const router = useRouter();
  const { characterAccent } = useTheme();
  const [phase, setPhase] = useState<SessionPhase>("setup");
  const [goal, setGoal] = useState("");
  const [durationSec, setDurationSec] = useState(DEFAULT_DURATION_SEC);
  const [activePanel, setActivePanel] = useState<SidePanel>("tasks");
  const prevPanelRef = useRef<SidePanel>(activePanel);
  const [sprintGoalCardOpen, setSprintGoalCardOpen] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [selectedVibe, setSelectedVibe] = useState<VibeId | null>(null);
  const reviewElapsedRef = useRef(0);

  // Only animate width when opening/closing, not when swapping panels
  const panelOpen = activePanel !== "none";
  const wasOpen = prevPanelRef.current !== "none";
  const shouldAnimatePanel = panelOpen !== wasOpen;
  useEffect(() => {
    prevPanelRef.current = activePanel;
  }, [activePanel]);
  const [pendingSwitchTaskId, setPendingSwitchTaskId] = useState<string | null>(null);


  const handleTimerComplete = useCallback(() => {
    reviewElapsedRef.current = durationSec;
    setPhase("review");
  }, [durationSec]);

  const timer = useTimer(durationSec, handleTimerComplete);
  const camera = useCamera(false);
  const screenShare = useScreenShare();
  const { party, partyId } = useActiveParty();
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

  const closePanel = useCallback(() => setActivePanel("none"), []);
  const handleToggleTasks = useCallback(
    () => setActivePanel((prev) => (prev === "tasks" ? "none" : "tasks")),
    []
  );

  const handleStartSprint = useCallback(
    (durationMinutes: number) => {
      if (!activeTask) return;
      setGoal(activeTask.text);
      const sec = durationMinutes * 60;
      setDurationSec(sec);
      timer.reset(sec);
      timer.start();
      setPhase("sprint");
      setSprintGoalCardOpen(false);
    },
    [activeTask, timer.reset, timer.start]
  );

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
  }, [durationSec, timer.getSnapshot, timer.pause, camera.stop, screenShare.stop, music.pause]);

  const handleAnotherRound = useCallback(() => {
    timer.reset(durationSec);
    timer.start();
    setPhase("sprint");
  }, [durationSec, timer.reset, timer.start]);

  const handleDone = useCallback(() => {
    router.push("/party");
  }, [router]);

  const handleReflectionComplete = useCallback(
    (_reflection: SessionReflection) => {
      // Future: persist to Supabase
    },
    []
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

      {phase === "setup" ? (
        <SetupScreen
          activeTask={activeTask}
          activeTasks={activeTasks}
          completedTasks={completedTasks}
          onStartTask={selectTask}
          onCompleteTask={completeTask}
          onAddTask={addTask}
          onDeleteTask={deleteTask}
          onStartSprint={handleStartSprint}
          selectedVibe={selectedVibe}
          onSelectVibe={setSelectedVibe}
        />
      ) : (
        <>
          {/* Main column: full session experience */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
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
                  screenShareActive={screenShare.isActive}
                  onToggleScreenShare={screenShare.toggle}
                  partyId={partyId}
                  inviteCode={party?.invite_code ?? null}
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
        currentTaskText={activeTask?.text ?? ""}
        onComplete={handleSwitchComplete}
        onSwitch={handleSwitchSwitch}
        onCancel={handleSwitchCancel}
      />
    </div>
  );
}
