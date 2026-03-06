"use client";

import { useState, useEffect, useCallback } from "react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useTimer } from "@/lib/useTimer";
import { TopBar } from "@/components/session/TopBar";
import { SessionNavDrawer } from "@/components/session/SessionNavDrawer";
import { SplitScreen } from "@/components/session/SplitScreen";
import { BottomBar } from "@/components/session/BottomBar";
import { GoalCard } from "@/components/session/GoalCard";
import { ReviewCard } from "@/components/session/ReviewCard";
import type { SessionPhase } from "@/lib/types";

const DEFAULT_DURATION_SEC = 25 * 60;

export default function SessionPage() {
  const { characterAccent } = useTheme();
  const [phase, setPhase] = useState<SessionPhase>("goal");
  const [goal, setGoal] = useState("");
  const [durationSec, setDurationSec] = useState(DEFAULT_DURATION_SEC);
  const [menuOpen, setMenuOpen] = useState(false);

  const timer = useTimer(durationSec);

  useEffect(() => {
    if (phase === "sprint" && timer.seconds <= 0 && timer.running) {
      timer.pause();
      setPhase("review");
    }
  }, [phase, timer.seconds, timer.running, timer.pause]);

  const handleStartSprint = useCallback(
    (goalText: string, durationMinutes: number) => {
      setGoal(goalText);
      const sec = durationMinutes * 60;
      setDurationSec(sec);
      timer.reset(sec);
      timer.start();
      setPhase("sprint");
    },
    [timer.reset, timer.start]
  );

  const handleEndSession = useCallback(() => {
    timer.pause();
    setPhase("review");
  }, [timer.pause]);

  const handleAnotherRound = useCallback(() => {
    setPhase("goal");
    setGoal("");
  }, []);

  const handleTakeBreak = useCallback(() => {
    setPhase("break");
  }, []);

  const timerWarning = phase === "sprint" && timer.seconds > 0 && timer.seconds <= 5 * 60;
  const timerCritical = phase === "sprint" && timer.seconds > 0 && timer.seconds <= 60;

  return (
    <div
      className="flex h-screen w-screen flex-col"
      style={{ background: "var(--color-bg-primary)" }}
    >
      <TopBar
        phase={phase}
        timerFormatted={phase === "sprint" ? timer.formatted : undefined}
        timerWarning={timerWarning}
        timerCritical={timerCritical}
        goal={phase === "sprint" ? goal : undefined}
        onOpenMenu={() => setMenuOpen(true)}
      />

      <SessionNavDrawer isOpen={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="relative flex flex-1 flex-col overflow-hidden">
        <SplitScreen character={characterAccent} />

        {phase === "goal" && (
          <GoalCard
            character={characterAccent}
            onStartSprint={handleStartSprint}
          />
        )}

        {phase === "review" && (
          <ReviewCard
            character={characterAccent}
            goal={goal}
            onAnotherRound={handleAnotherRound}
            onTakeBreak={handleTakeBreak}
          />
        )}
      </div>

      {phase === "sprint" && <BottomBar onEndSession={handleEndSession} />}
    </div>
  );
}
