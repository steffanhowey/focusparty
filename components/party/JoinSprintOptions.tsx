"use client";

import { DurationPills } from "@/components/session/DurationPills";

type SprintMode = "current" | "next" | "fresh";

function formatMinutes(seconds: number): string {
  const m = Math.ceil(seconds / 60);
  return `${m}m`;
}

interface JoinSprintOptionsProps {
  hasActiveSprint: boolean;
  remainingSeconds: number;
  focusingCount: number;
  sprintMode: SprintMode;
  onSprintModeChange: (mode: SprintMode) => void;
  freshDuration: number;
  onFreshDurationChange: (value: number) => void;
  accentColor: string;
}

export function JoinSprintOptions({
  hasActiveSprint,
  remainingSeconds,
  focusingCount,
  sprintMode,
  onSprintModeChange,
  freshDuration,
  onFreshDurationChange,
  accentColor,
}: JoinSprintOptionsProps) {
  if (hasActiveSprint) {
    return (
      <div className="px-5 pt-4">
        <label className="mb-2 block text-sm font-semibold text-white">
          Join
        </label>
        <div className="flex flex-col gap-2">
          {/* Current Sprint */}
          <SprintRadioButton
            selected={sprintMode === "current"}
            onClick={() => onSprintModeChange("current")}
            accentColor={accentColor}
            title="Current Sprint"
            description={`${formatMinutes(remainingSeconds)} remaining \u00b7 ${focusingCount} people focusing`}
          />

          {/* Next Sprint */}
          <SprintRadioButton
            selected={sprintMode === "next"}
            onClick={() => onSprintModeChange("next")}
            accentColor={accentColor}
            title="Next Sprint"
            description={`Starts in ${formatMinutes(remainingSeconds)} \u00b7 Join fresh with group`}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pt-4">
      <label className="mb-2 block text-sm font-semibold text-white">
        Sprint duration
      </label>
      <DurationPills
        value={freshDuration}
        onChange={onFreshDurationChange}
      />
    </div>
  );
}

function SprintRadioButton({
  selected,
  onClick,
  accentColor,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  accentColor: string;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center justify-between rounded-xl px-4 py-3 text-left transition-all"
      style={{
        background: selected ? `${accentColor}0C` : "transparent",
        border: selected
          ? `1.5px solid ${accentColor}60`
          : "1.5px solid rgba(255,255,255,0.08)",
      }}
    >
      <div>
        <div className="flex items-center gap-1.5">
          {selected && (
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: accentColor }}
            />
          )}
          <span className="text-sm font-semibold text-white">{title}</span>
        </div>
        <p className="mt-0.5 text-xs text-white/50">{description}</p>
      </div>
      {/* Radio indicator */}
      <div
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
        style={{
          borderColor: selected ? accentColor : "rgba(255,255,255,0.2)",
        }}
      >
        {selected && (
          <div
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: accentColor }}
          />
        )}
      </div>
    </button>
  );
}
