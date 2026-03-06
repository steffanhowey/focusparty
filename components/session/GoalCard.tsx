"use client";

import { useState } from "react";
import type { CharacterId } from "@/lib/types";
import { CHARACTERS } from "@/lib/constants";

const DURATIONS = [15, 25, 50, 75] as const;

interface GoalCardProps {
  character: CharacterId;
  onStartSprint: (goal: string, durationMinutes: number) => void;
}

export function GoalCard({ character, onStartSprint }: GoalCardProps) {
  const [goal, setGoal] = useState("");
  const [duration, setDuration] = useState(25);
  const c = CHARACTERS[character];

  const handleSubmit = () => {
    if (!goal.trim()) return;
    onStartSprint(goal.trim(), duration);
  };

  return (
    <div
      className="absolute bottom-6 left-1/2 w-[calc(100%-2rem)] max-w-[460px] -translate-x-1/2 rounded-2xl border border-[var(--color-border-default)] p-4 backdrop-blur-xl md:p-6"
      style={{
        background: "rgba(13,14,32,0.92)",
        zIndex: 20,
      }}
    >
      <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
        <span style={{ color: c.primary }}>{c.name}:</span> What are we working
        on?
      </p>
      <input
        type="text"
        placeholder="Describe your goal..."
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        className="mb-4 w-full rounded-full border border-[var(--color-border-default)] bg-white/5 px-5 py-3 text-sm text-white placeholder:text-[var(--color-text-tertiary)] outline-none transition-[border-color] focus:border-[var(--color-accent-primary)]"
      />
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDuration(d)}
              className="rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-150"
              style={{
                background: d === duration ? "var(--color-accent-primary)" : "transparent",
                color: d === duration ? "white" : "var(--color-text-tertiary)",
                border: d === duration ? "none" : "1px solid var(--color-border-default)",
              }}
            >
              {d}m
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!goal.trim()}
          className="rounded-full bg-[var(--color-accent-primary)] px-6 py-2.5 text-sm font-semibold text-white transition-opacity duration-150 disabled:opacity-50"
        >
          Start sprint
        </button>
      </div>
    </div>
  );
}
