"use client";

import { useState, useEffect, useCallback } from "react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useTimer } from "@/lib/useTimer";
import { useCamera } from "@/lib/useCamera";
import { useChat } from "@/lib/useChat";
import { useSettings } from "@/lib/useSettings";
import { useTasks } from "@/lib/useTasks";
import { TopBar } from "@/components/session/TopBar";
import { SessionNavDrawer } from "@/components/session/SessionNavDrawer";
import { SplitScreen } from "@/components/session/SplitScreen";
import { BottomBar } from "@/components/session/BottomBar";
import { GoalCard } from "@/components/session/GoalCard";
import { ReviewCard } from "@/components/session/ReviewCard";
import { CameraPanel } from "@/components/session/CameraPanel";
import { SideDrawer } from "@/components/session/SideDrawer";
import { SettingsPanel } from "@/components/session/SettingsPanel";
import type { SessionPhase } from "@/lib/types";

type SidePanel = "none" | "drawer" | "settings";
const PANEL_WIDTH = 380;
const DEFAULT_DURATION_SEC = 25 * 60;

export default function SessionPage() {
  const { characterAccent } = useTheme();
  const [phase, setPhase] = useState<SessionPhase>("goal");
  const [goal, setGoal] = useState("");
  const [durationSec, setDurationSec] = useState(DEFAULT_DURATION_SEC);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<SidePanel>("none");

  const timer = useTimer(durationSec);
  const camera = useCamera(false);
  const chat = useChat();
  const { settings, updateSetting } = useSettings();
  const {
    activeTasks,
    completedTasks,
    activeTask,
    addTask,
    completeTask,
    deleteTask,
    selectTask,
  } = useTasks();

  const togglePanel = useCallback(
    (panel: "drawer" | "settings") =>
      setActivePanel((prev) => (prev === panel ? "none" : panel)),
    []
  );
  const closePanel = useCallback(() => setActivePanel("none"), []);

  useEffect(() => {
    if (phase === "sprint" && timer.seconds <= 0 && timer.running) {
      timer.pause();
      setPhase("review");
    }
  }, [phase, timer.seconds, timer.running, timer.pause]);

  const handleStartSprint = useCallback(
    (durationMinutes: number) => {
      if (!activeTask) return;
      setGoal(activeTask.text);
      const sec = durationMinutes * 60;
      setDurationSec(sec);
      timer.reset(sec);
      timer.start();
      setPhase("sprint");
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
    setPhase("review");
  }, [timer.pause, camera.stop]);

  const handleAnotherRound = useCallback(() => {
    setPhase("goal");
    setGoal("");
  }, []);

  const handleTakeBreak = useCallback(() => {
    setPhase("break");
  }, []);

  const handleOutcome = useCallback(
    (outcome: string) => {
      if (outcome === "Done" && activeTask) {
        completeTask(activeTask.id);
        selectTask(null);
      }
    },
    [activeTask, completeTask, selectTask]
  );

  const timerWarning = phase === "sprint" && timer.seconds > 0 && timer.seconds <= 5 * 60;
  const timerCritical = phase === "sprint" && timer.seconds > 0 && timer.seconds <= 60;

  return (
    <div
      className="flex h-screen w-screen"
      style={{ background: "var(--color-bg-primary)" }}
    >
      {/* Left column: full session experience */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar
          phase={phase}
          onOpenMenu={() => setMenuOpen(true)}
          drawerOpen={activePanel === "drawer"}
          onToggleDrawer={() => togglePanel("drawer")}
          settingsOpen={activePanel === "settings"}
          onToggleSettings={() => togglePanel("settings")}
          timerFormatted={timer.formatted}
          timerWarning={timerWarning}
          timerCritical={timerCritical}
          currentDurationMin={durationMin}
          onChangeDuration={handleChangeDuration}
          onResetTimer={handleResetTimer}
        />

        <SessionNavDrawer isOpen={menuOpen} onClose={() => setMenuOpen(false)} />

        <div className="relative flex flex-1 flex-col overflow-hidden">
          <SplitScreen
            character={characterAccent}
            leftPanel={
              <CameraPanel
                videoRef={camera.videoRef}
                status={camera.status}
                isActive={camera.isActive}
                onToggleCamera={camera.toggle}
              />
            }
          />

          {phase === "goal" && (
            <GoalCard
              character={characterAccent}
              activeTask={activeTask}
              activeTasks={activeTasks}
              completedTasks={completedTasks}
              onSelectTask={selectTask}
              onAddTask={addTask}
              onDeleteTask={deleteTask}
              onStartSprint={handleStartSprint}
            />
          )}

          {phase === "review" && (
            <ReviewCard
              character={characterAccent}
              goal={goal}
              onAnotherRound={handleAnotherRound}
              onTakeBreak={handleTakeBreak}
              onOutcome={handleOutcome}
            />
          )}

          {phase === "sprint" && (
            <BottomBar onEndSession={handleEndSession} />
          )}
        </div>
      </div>

      {/* Right column: shared side panel (pushes entire left column) */}
      <div
        className="flex-shrink-0 overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ width: activePanel !== "none" ? PANEL_WIDTH : 0 }}
      >
        <aside
          className="flex h-full flex-col border-l border-[var(--color-border-default)] bg-[var(--color-bg-primary)]"
          style={{ width: PANEL_WIDTH }}
          role="complementary"
          aria-label={activePanel === "drawer" ? "Tasks & Chat" : "Settings"}
        >
          {activePanel === "drawer" && (
            <SideDrawer
              onClose={closePanel}
              activeTask={activeTask}
              activeTasks={activeTasks}
              completedTasks={completedTasks}
              onSelectTask={selectTask}
              onAddTask={addTask}
              onCompleteTask={completeTask}
              onDeleteTask={deleteTask}
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
    </div>
  );
}
