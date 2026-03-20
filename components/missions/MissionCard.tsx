"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  PanelsTopLeft,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getMissionRoute } from "@/lib/appRoutes";
import {
  getMissionFraming,
  getMissionNextAction,
  getMissionPrimaryArea,
  getMissionProgressSummary,
  getMissionRepSummary,
  getMissionStateLabel,
  getMissionUiState,
  type MissionUiState,
} from "@/lib/missionPresentation";
import type { LearningPath, LearningProgress } from "@/lib/types";
import { PathCardFrame } from "@/components/learn/PathCardFrame";
import { MissionRoomPickerModal } from "@/components/missions/MissionRoomPickerModal";

interface MissionCardProps {
  path: LearningPath;
  progress?: LearningProgress | null;
  isSaved?: boolean;
  featured?: boolean;
  compact?: boolean;
  onToggleSave?: (path: LearningPath) => void;
  className?: string;
}

const STATE_STYLES: Record<
  MissionUiState,
  { background: string; border: string; color: string }
> = {
  ready: {
    background: "var(--sg-shell-100)",
    border: "var(--sg-shell-border)",
    color: "var(--sg-shell-700)",
  },
  saved: {
    background: "var(--sg-shell-100)",
    border: "var(--sg-shell-border)",
    color: "var(--sg-shell-700)",
  },
  active: {
    background: "var(--sg-forest-50)",
    border: "var(--sg-forest-200)",
    color: "var(--sg-forest-600)",
  },
  completed: {
    background: "var(--sg-gold-100)",
    border: "var(--sg-gold-200)",
    color: "var(--sg-gold-900)",
  },
};

/**
 * Mission-first card used on missions surfaces to emphasize work, output, and
 * the next action instead of library/path semantics.
 */
export function MissionCard({
  path,
  progress = null,
  isSaved = false,
  featured = false,
  compact = false,
  onToggleSave,
  className = "",
}: MissionCardProps) {
  const router = useRouter();
  const [showRoomPicker, setShowRoomPicker] = useState(false);
  const area = getMissionPrimaryArea(path);
  const state = getMissionUiState(progress, isSaved);
  const stateLabel = getMissionStateLabel(progress, isSaved);
  const framing = getMissionFraming(path, progress);
  const nextAction = getMissionNextAction(path, progress);
  const progressSummary = getMissionProgressSummary(progress);
  const effortSummary = getMissionRepSummary(path);
  const contextSignal = area.detail ?? area.label;
  const supportLine =
    state === "active"
      ? nextAction
      : state === "completed"
        ? "Outcome captured and ready to review."
        : framing;
  const metaLine = state === "active" ? progressSummary : effortSummary;
  const primaryLabel =
    state === "active" ? "Resume" : state === "completed" ? "Open" : "Start";
  const percentComplete =
    progress && progress.items_total > 0
      ? Math.round((progress.items_completed / progress.items_total) * 100)
      : 0;
  const showProgress = percentComplete > 0 || state === "completed";

  const handleOpenMission = () => {
    router.push(getMissionRoute(path.id));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleOpenMission();
    }
  };

  return (
    <>
      <div
        className={`group/mission block cursor-pointer transition-all duration-150 ${className}`}
        onClick={handleOpenMission}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
      >
        <PathCardFrame
          path={path}
          coverHeight={featured ? "h-[224px]" : "h-[200px]"}
          coverSizes={featured ? "(max-width: 1024px) 100vw, 720px" : "(max-width: 640px) 100vw, 400px"}
          badge={(
            <OverlayPill
              tone={state !== "ready" ? state : "context"}
            >
              {state !== "ready" ? stateLabel : contextSignal}
            </OverlayPill>
          )}
          topRight={
            onToggleSave ? (
              <Button
                variant="ghost"
                size="xs"
                aria-label={isSaved ? "Remove from queue" : "Save to queue"}
                className={`w-8 justify-center rounded-full px-0 backdrop-blur-md ${
                  isSaved ? "opacity-100" : "opacity-0 group-hover/card:opacity-100"
                }`}
                style={{
                  background:
                    "color-mix(in srgb, var(--sg-forest-900) 58%, transparent)",
                  color: "var(--sg-white)",
                }}
                leftIcon={
                  isSaved ? (
                    <BookmarkCheck size={14} strokeWidth={1.9} />
                  ) : (
                    <Bookmark size={14} strokeWidth={1.9} />
                  )
                }
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleSave(path);
                }}
              >
                {null}
              </Button>
            ) : null
          }
          bottomOverlay={
            showProgress ? (
              <>
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
                  style={{
                    background:
                      "linear-gradient(to top, color-mix(in srgb, var(--sg-forest-900) 82%, transparent) 0%, transparent 100%)",
                  }}
                />
                <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-end px-4 py-3">
                  <span className="text-xs font-medium text-white/78">
                    {progressSummary}
                  </span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 z-10 h-1 bg-white/10">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${state === "completed" ? 100 : percentComplete}%`,
                      background:
                        state === "completed"
                          ? "var(--sg-gold-500)"
                          : "var(--sg-forest-500)",
                    }}
                  />
                </div>
              </>
            ) : null
          }
          style={
            featured
              ? {
                  borderColor: "var(--sg-forest-200)",
                }
              : undefined
          }
        />

        <div className="space-y-1.5 px-1 pt-2">
          <h3
            className={`font-semibold leading-snug text-shell-900 ${
              featured ? "text-lg sm:text-xl" : compact ? "text-sm" : "text-base"
            } ${featured ? "line-clamp-2" : "line-clamp-2"}`}
          >
            {path.title}
          </h3>

          {supportLine ? (
            <p
              className={`text-sm leading-6 text-shell-600 ${
                compact ? "line-clamp-1" : "line-clamp-2"
              }`}
            >
              {supportLine}
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-xs text-shell-500">
              {metaLine}
            </p>

            <div className="flex shrink-0 items-center gap-3">
              {state === "active" ? (
                <button
                  type="button"
                  className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-shell-500 transition-colors hover:text-shell-900"
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowRoomPicker(true);
                  }}
                >
                  <PanelsTopLeft size={12} />
                  Enter room
                </button>
              ) : null}

              <span className="inline-flex items-center gap-1 text-xs font-medium text-shell-700 transition-transform duration-150 group-hover/mission:translate-x-0.5">
                {primaryLabel}
                <ArrowRight size={14} strokeWidth={1.9} />
              </span>
            </div>
          </div>
        </div>
      </div>

      {showRoomPicker ? (
        <MissionRoomPickerModal
          isOpen={showRoomPicker}
          onClose={() => setShowRoomPicker(false)}
          path={path}
          progress={progress}
        />
      ) : null}
    </>
  );
}

function OverlayPill({
  children,
  tone,
}: {
  children: string;
  tone: MissionUiState | "context";
}) {
  const color =
    tone === "context"
      ? "var(--sg-white)"
      : STATE_STYLES[tone].color;

  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur-md"
      style={{
        background:
          "color-mix(in srgb, var(--sg-forest-900) 58%, transparent)",
        color,
      }}
    >
      {children}
    </span>
  );
}
