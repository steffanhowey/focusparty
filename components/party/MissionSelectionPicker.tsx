"use client";

import { Check, ChevronRight, PanelsTopLeft, Target } from "lucide-react";
import { getMissionPrimaryArea, getMissionProgressSummary } from "@/lib/missionPresentation";
import type { ActiveMissionEntry } from "@/lib/useActiveMissions";

interface MissionSelectionPickerProps {
  missions: ActiveMissionEntry[];
  selectedMissionId: string | null;
  accentColor: string;
  onSelectMission: (mission: ActiveMissionEntry) => void;
  onSelectNone: () => void;
  noneDescription?: string;
}

/**
 * Small room-entry picker for choosing an active mission or continuing
 * without one. Keeps the existing popover footprint while swapping the
 * selected work object from goals/tasks to missions.
 */
export function MissionSelectionPicker({
  missions,
  selectedMissionId,
  accentColor,
  onSelectMission,
  onSelectNone,
  noneDescription = "Enter the room without attaching active mission context.",
}: MissionSelectionPickerProps) {
  return (
    <div className="max-h-56 overflow-y-auto py-1">
      {missions.length > 0 && (
        <>
          <div className="px-3 pt-1.5 pb-1 text-2xs font-semibold uppercase tracking-wider text-white/25">
            Active Missions
          </div>
          {missions.map((mission) => {
            const isSelected = selectedMissionId === mission.path.id;
            const area = getMissionPrimaryArea(mission.path);

            return (
              <button
                key={mission.path.id}
                type="button"
                onClick={() => onSelectMission(mission)}
                className="group flex w-full cursor-pointer items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-white/[0.06]"
              >
                <Target
                  size={13}
                  strokeWidth={1.8}
                  className="mt-0.5 shrink-0"
                  style={{
                    color: isSelected ? accentColor : "rgba(255,255,255,0.25)",
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-xs font-semibold"
                    style={{
                      color: isSelected ? accentColor : "rgba(255,255,255,0.8)",
                    }}
                  >
                    {mission.path.title}
                  </p>
                  <p className="mt-0.5 truncate text-2xs text-white/40">
                    {area.detail ?? area.label}
                    {" · "}
                    {getMissionProgressSummary(mission.progress)}
                  </p>
                </div>

                {isSelected ? (
                  <Check
                    size={12}
                    strokeWidth={2}
                    className="mt-0.5 shrink-0"
                    style={{ color: accentColor }}
                  />
                ) : (
                  <ChevronRight
                    size={12}
                    strokeWidth={2}
                    className="mt-0.5 shrink-0 text-white/25 transition-colors group-hover:text-white/50"
                  />
                )}
              </button>
            );
          })}

          <div className="mx-2 my-1 h-px bg-white/[0.06]" />
        </>
      )}

      <button
        type="button"
        onClick={onSelectNone}
        className="group flex w-full cursor-pointer items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-white/[0.06]"
      >
        <PanelsTopLeft
          size={13}
          strokeWidth={1.8}
          className="mt-0.5 shrink-0 text-white/25"
        />
        <div className="min-w-0 flex-1">
          <p
            className="text-xs font-semibold"
            style={{
              color: selectedMissionId === null ? accentColor : "rgba(255,255,255,0.8)",
            }}
          >
            Continue without a mission
          </p>
          <p className="mt-0.5 text-2xs text-white/40">
            {noneDescription}
          </p>
        </div>

        {selectedMissionId === null && (
          <Check
            size={12}
            strokeWidth={2}
            className="mt-0.5 shrink-0"
            style={{ color: accentColor }}
          />
        )}
      </button>
    </div>
  );
}
