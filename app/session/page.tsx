"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useTimer } from "@/lib/useTimer";
import { useCamera } from "@/lib/useCamera";
import { useChat } from "@/lib/useChat";
import { useSettings } from "@/lib/useSettings";
import { useTasks } from "@/lib/useTasks";
import { useMusic } from "@/lib/useMusic";
import { TopBar } from "@/components/session/TopBar";
import { Sidebar } from "@/components/shell/Sidebar";
import { SplitScreen } from "@/components/session/SplitScreen";
import { GoalCard } from "@/components/session/GoalCard";
import { StartSessionModal } from "@/components/session/StartSessionModal";
import { ReviewCard } from "@/components/session/ReviewCard";
import { CameraPanel } from "@/components/session/CameraPanel";
import { SideDrawer } from "@/components/session/SideDrawer";
import { SettingsPanel } from "@/components/session/SettingsPanel";
import { ActionBar } from "@/components/session/ActionBar";
import { SwitchTaskModal } from "@/components/session/SwitchTaskModal";
import type { SessionPhase } from "@/lib/types";

type SidePanel = "none" | "tasks" | "chat" | "settings";
const PANEL_WIDTH = 380;
const DEFAULT_DURATION_SEC = 25 * 60;

export default function SessionPage() {
  const { characterAccent } = useTheme();
  const [phase, setPhase] = useState<SessionPhase>("setup");
  const [goal, setGoal] = useState("");
  const [durationSec, setDurationSec] = useState(DEFAULT_DURATION_SEC);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<SidePanel>("tasks");
  const prevPanelRef = useRef<SidePanel>(activePanel);
  const [sprintGoalCardOpen, setSprintGoalCardOpen] = useState(false);
  const [micActive, setMicActive] = useState(false);

  // Only animate width when opening/closing, not when swapping panels
  const panelOpen = activePanel !== "none";
  const wasOpen = prevPanelRef.current !== "none";
  const shouldAnimatePanel = panelOpen !== wasOpen;
  useEffect(() => {
    prevPanelRef.current = activePanel;
  }, [activePanel]);
  const [pendingSwitchTaskId, setPendingSwitchTaskId] = useState<string | null>(null);

  const handleTimerComplete = useCallback(() => {
    setPhase("review");
  }, []);

  const timer = useTimer(durationSec, handleTimerComplete);
  const camera = useCamera(false);
  const chat = useChat();
  const { settings, updateSetting } = useSettings();
  const music = useMusic();
  const {
    activeTasks,
    completedTasks,
    activeTask,
    addTask,
    completeTask,
    deleteTask,
    editTask,
    selectTask,
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
    timer.pause();
    camera.stop();
    music.pause();
    setPhase("review");
  }, [timer.pause, camera.stop, music.pause]);

  const handleAnotherRound = useCallback(() => {
    timer.reset(durationSec);
    timer.start();
    setPhase("sprint");
  }, [durationSec, timer.reset, timer.start]);

  const handleTakeBreak = useCallback(() => {
    setPhase("break");
  }, []);

  const handleOutcome = useCallback(
    (outcome: string) => {
      if (outcome === "Done" && activeTask) {
        completeTask(activeTask.id);
      }
    },
    [activeTask, completeTask]
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

  const handleToggleMenu = useCallback(() => setMenuOpen((m) => !m), []);
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
      className="flex h-screen w-screen"
      style={{ background: "var(--color-bg-primary)" }}
    >
      {/* Left column: app sidebar (pushes) */}
      <div
        className="flex-shrink-0 overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ width: menuOpen ? 240 : 0 }}
      >
        {menuOpen && <Sidebar />}
      </div>

      {/* Center column: full session experience */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar
          phase={phase}
          onOpenMenu={handleToggleMenu}
          drawerOpen={activePanel === "tasks"}
          onToggleDrawer={phase !== "sprint" ? handleToggleTasks : undefined}
          settingsOpen={activePanel === "settings"}
          onToggleSettings={phase !== "sprint" ? handleToggleSettings : undefined}
          timer={timer}
          durationSec={durationSec}
          currentDurationMin={durationMin}
          onChangeDuration={handleChangeDuration}
          onResetTimer={handleResetTimer}
          goalCardOpen={sprintGoalCardOpen}
          onToggleGoalCard={handleToggleGoalCard}
        />

        <div className="relative flex flex-1 flex-col overflow-hidden">
          <SplitScreen
            character={characterAccent}
            leftPanel={cameraPanelNode}
          />

          {phase === "sprint" && sprintGoalCardOpen && (
            <div
              className="absolute inset-0 z-10"
              onClick={handleCloseGoalCard}
            />
          )}

          {phase === "sprint" && sprintGoalCardOpen && (
            <GoalCard
              activeTask={activeTask}
              activeTasks={activeTasks}
              completedTasks={completedTasks}
              onStartTask={handleStartTask}
              onCompleteTask={completeTask}
              onAddTask={addTask}
              onDeleteTask={deleteTask}
              currentDurationMin={durationMin}
              onChangeDuration={handleChangeDuration}
              onResetTimer={handleResetTimer}
            />
          )}

          {/* Hidden YouTube player — wrapper keeps clip-path styling
              while inner div gets replaced by YouTube iframe on each
              createPlayer call (destroy removes the iframe) */}
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
            />
          )}

          {phase === "review" && (
            <ReviewCard
              goal={goal}
              onAnotherRound={handleAnotherRound}
              onTakeBreak={handleTakeBreak}
              onOutcome={handleOutcome}
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
          className="flex h-full flex-col border-l border-[var(--color-border-default)] bg-[var(--color-bg-primary)]"
          style={{ width: PANEL_WIDTH }}
          role="complementary"
          aria-label={activePanel === "tasks" ? "Tasks" : activePanel === "chat" ? "Chat" : "Settings"}
        >
          {(activePanel === "tasks" || activePanel === "chat") && (
            <SideDrawer
              onClose={closePanel}
              panel={activePanel as "tasks" | "chat"}
              activeTask={activeTask}
              activeTasks={activeTasks}
              completedTasks={completedTasks}
              onStartTask={handleStartTask}
              onCompleteTask={completeTask}
              onAddTask={addTask}
              onDeleteTask={deleteTask}
              onEditTask={editTask}
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

      <StartSessionModal
        isOpen={phase === "setup"}
        activeTask={activeTask}
        activeTasks={activeTasks}
        completedTasks={completedTasks}
        onStartTask={handleStartTask}
        onCompleteTask={completeTask}
        onAddTask={addTask}
        onDeleteTask={deleteTask}
        onStartSprint={handleStartSprint}
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
