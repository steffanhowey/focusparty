"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Clock3,
  FileText,
  PanelsTopLeft,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getMissionRoute } from "@/lib/appRoutes";
import {
  getMissionExpectedOutput,
  getMissionFraming,
  getMissionNextAction,
  getMissionPrimaryArea,
  getMissionProgressSummary,
  getMissionRepSummary,
  getMissionRoomHint,
  getMissionStateLabel,
  getMissionStructureSummary,
  getMissionUiState,
  type MissionUiState,
} from "@/lib/missionPresentation";
import type { LearningPath, LearningProgress } from "@/lib/types";

interface MissionCardProps {
  path: LearningPath;
  progress?: LearningProgress | null;
  isSaved?: boolean;
  featured?: boolean;
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
  onToggleSave,
  className = "",
}: MissionCardProps) {
  const router = useRouter();
  const area = getMissionPrimaryArea(path);
  const state = getMissionUiState(progress, isSaved);
  const stateLabel = getMissionStateLabel(progress, isSaved);
  const framing = getMissionFraming(path, progress);
  const expectedOutput = getMissionExpectedOutput(path, progress);
  const nextAction = getMissionNextAction(path, progress);
  const progressSummary = getMissionProgressSummary(progress);
  const effortSummary = getMissionRepSummary(path);
  const roomHint = getMissionRoomHint(progress);
  const structureSummary = getMissionStructureSummary(path);
  const primaryLabel =
    state === "active" ? "Resume" : state === "completed" ? "View mission" : "Start";

  const handleOpenMission = () => {
    router.push(getMissionRoute(path.id));
  };

  const handleOpenRooms = () => {
    router.push("/rooms");
  };

  return (
    <Card
      className={`p-5 ${featured ? "overflow-hidden p-6 md:p-7" : ""} ${className}`}
      style={
        featured
          ? {
              background:
                "linear-gradient(135deg, var(--sg-cream-50) 0%, var(--sg-shell-white) 58%, var(--sg-sage-50) 100%)",
              borderColor: "var(--sg-forest-200)",
            }
          : undefined
      }
    >
      <div className={featured ? "grid gap-5 lg:grid-cols-[1.45fr,1fr]" : "space-y-5"}>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <StateBadge label={stateLabel} state={state} />
            {area.detail && <MetaPill>{area.detail}</MetaPill>}
            <MetaPill>{area.label}</MetaPill>
          </div>

          <div className="space-y-2">
            <h3
              className={`${featured ? "text-2xl sm:text-[1.9rem]" : "text-lg"} font-semibold leading-tight text-shell-900`}
            >
              {path.title}
            </h3>
            <p className="text-sm leading-6 text-shell-600">
              {framing}
            </p>
          </div>

          <div className="rounded-[var(--sg-radius-lg)] border border-shell-border bg-white p-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-shell-500">
              What To Do Next
            </p>
            <p className="mt-2 text-sm leading-6 text-shell-900">
              {nextAction}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <MissionFact
            icon={<FileText size={14} className="text-shell-500" />}
            label="Expected output"
            value={expectedOutput}
          />
          <MissionFact
            icon={<Clock3 size={14} className="text-forest-500" />}
            label={state === "active" ? "Current state" : "Effort"}
            value={state === "active" ? progressSummary : effortSummary}
          />
          <MissionFact
            icon={<Target size={14} className="text-forest-500" />}
            label="Mission structure"
            value={structureSummary}
          />
          <MissionFact
            icon={<PanelsTopLeft size={14} className="text-shell-500" />}
            label="Room handoff"
            value={roomHint}
          />
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-shell-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-shell-500">
          {state === "active" ? progressSummary : effortSummary}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="cta"
            size="sm"
            rightIcon={<ArrowRight size={14} />}
            onClick={handleOpenMission}
          >
            {primaryLabel}
          </Button>

          {state === "active" ? (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<PanelsTopLeft size={14} />}
              onClick={handleOpenRooms}
            >
              Enter room
            </Button>
          ) : onToggleSave ? (
            <Button
              variant={isSaved ? "outline" : "ghost"}
              size="sm"
              leftIcon={
                isSaved ? (
                  <BookmarkCheck size={14} />
                ) : (
                  <Bookmark size={14} />
                )
              }
              onClick={() => onToggleSave(path)}
            >
              {isSaved ? "Saved" : "Save"}
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function MissionFact({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[var(--sg-radius-lg)] border border-shell-border bg-white p-3.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-shell-500">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-sm leading-6 text-shell-800">
        {value}
      </p>
    </div>
  );
}

function MetaPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-shell-border bg-white px-2.5 py-1 text-[11px] font-medium text-shell-600">
      {children}
    </span>
  );
}

function StateBadge({
  label,
  state,
}: {
  label: string;
  state: MissionUiState;
}) {
  const stateStyle = STATE_STYLES[state];

  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold"
      style={{
        background: stateStyle.background,
        borderColor: stateStyle.border,
        color: stateStyle.color,
      }}
    >
      {label}
    </span>
  );
}
