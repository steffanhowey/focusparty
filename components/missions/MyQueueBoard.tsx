"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BoardColumnFrame } from "@/components/goals/BoardColumnFrame";
import { BoardItemFrame } from "@/components/goals/BoardItemFrame";
import { useGoals } from "@/lib/useGoals";
import {
  formatStepUnit,
  getMissionBuildsLine,
} from "@/lib/missionLanguage";
import type { GoalRecord, LearningPath, LearningProgress } from "@/lib/types";
import type { ProfileAchievement } from "@/lib/useSkillProfile";
import { getMissionRoute, getProgressEvidenceRoute } from "@/lib/appRoutes";
import {
  formatMissionDuration,
  getMissionExpectedOutput,
  getMissionNextAction,
  getMissionProgressSummary,
} from "@/lib/missionPresentation";

type ActiveMission = {
  path: LearningPath;
  progress: LearningProgress;
};

interface MyQueueBoardProps {
  compact?: boolean;
  title?: string;
  description?: string;
  allowViewToggle?: boolean;
  defaultView?: QueueView;
  availablePaths?: LearningPath[];
  activeMissions?: ActiveMission[];
  completedEvidence?: ProfileAchievement[];
}

type QueueLane = "saved" | "active" | "completed";
type QueueView = "list" | "kanban";

// Kanban is intentionally paused until mission queue state is unified enough
// to support it without misleading drag/status behavior.
const KANBAN_ENABLED = false;

interface QueueColumnDef {
  key: QueueLane;
  label: string;
  description: string;
}

const QUEUE_COLUMNS: QueueColumnDef[] = [
  {
    key: "saved",
    label: "Saved",
    description: "Missions waiting for a start.",
  },
  {
    key: "active",
    label: "Active",
    description: "Work already underway.",
  },
  {
    key: "completed",
    label: "Completed",
    description: "Recent outcomes you can revisit.",
  },
];

const QUEUE_COLUMN_COLORS: Record<QueueLane, string> = {
  saved: "var(--sg-shell-700)",
  active: "var(--sg-forest-600)",
  completed: "var(--sg-gold-900)",
};

interface SavedMissionRecord {
  goal: GoalRecord;
  path: LearningPath | null;
}

export function MyQueueBoard({
  compact = false,
  title = "My Queue",
  description = "Saved, active, and completed missions stay in one quiet place.",
  allowViewToggle = false,
  defaultView = "list",
  availablePaths = [],
  activeMissions = [],
  completedEvidence = [],
}: MyQueueBoardProps) {
  const { goals, loading, archiveGoal } = useGoals();
  const [savedPathMap, setSavedPathMap] = useState<Record<string, LearningPath>>(
    {},
  );
  const [view, setView] = useState<QueueView>(
    KANBAN_ENABLED ? defaultView : "list",
  );
  const canToggleView = KANBAN_ENABLED && allowViewToggle && !compact;

  const missionGoals = useMemo(
    () =>
      goals.filter(
        (goal) => goal.linked_path_id && goal.status !== "archived",
      ),
    [goals],
  );

  const knownPathMap = useMemo(() => {
    const map = new Map<string, LearningPath>();

    for (const path of availablePaths) {
      map.set(path.id, path);
    }

    for (const mission of activeMissions) {
      map.set(mission.path.id, mission.path);
    }

    for (const path of Object.values(savedPathMap)) {
      map.set(path.id, path);
    }

    return map;
  }, [activeMissions, availablePaths, savedPathMap]);

  useEffect(() => {
    const missingPathIds = missionGoals
      .map((goal) => goal.linked_path_id)
      .filter((pathId): pathId is string => Boolean(pathId))
      .filter((pathId) => !knownPathMap.has(pathId));

    if (missingPathIds.length === 0) return;

    let cancelled = false;

    void Promise.all(
      Array.from(new Set(missingPathIds)).map(async (pathId) => {
        const response = await fetch(`/api/learn/paths/${pathId}`);
        if (!response.ok) return null;
        const payload = (await response.json()) as { path?: LearningPath | null };
        return payload.path ?? null;
      }),
    ).then((paths) => {
      if (cancelled) return;

      setSavedPathMap((current) => {
        const next = { ...current };
        for (const path of paths) {
          if (path) next[path.id] = path;
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [knownPathMap, missionGoals]);

  const completedPathIds = useMemo(
    () => new Set(completedEvidence.map((achievement) => achievement.path_id)),
    [completedEvidence],
  );

  const activePathIds = useMemo(
    () =>
      new Set(
        activeMissions
          .map((mission) => mission.path.id)
          .filter((pathId) => !completedPathIds.has(pathId)),
      ),
    [activeMissions, completedPathIds],
  );

  const savedMissions = useMemo(() => {
    return missionGoals
      .filter((goal) => {
        const pathId = goal.linked_path_id;
        if (!pathId) return false;
        return !completedPathIds.has(pathId) && !activePathIds.has(pathId);
      })
      .map((goal) => ({
        goal,
        path: goal.linked_path_id ? knownPathMap.get(goal.linked_path_id) ?? null : null,
      }))
      .sort((a, b) => a.goal.position - b.goal.position);
  }, [activePathIds, completedPathIds, knownPathMap, missionGoals]);

  const dedupedActiveMissions = useMemo(
    () =>
      activeMissions.filter(
        (mission) => !completedPathIds.has(mission.path.id),
      ),
    [activeMissions, completedPathIds],
  );

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-shell-900">
            {title}
          </h2>
          <p className="text-sm text-shell-500">
            {description}
          </p>
        </div>

        {canToggleView && (
          <div className="inline-flex items-center rounded-full border border-shell-border bg-shell-50 p-1">
            <button
              type="button"
              onClick={() => setView("list")}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                view === "list"
                  ? "bg-white text-shell-900 shadow-sm"
                  : "text-shell-500"
              }`}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => setView("kanban")}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                view === "kanban"
                  ? "bg-white text-shell-900 shadow-sm"
                  : "text-shell-500"
              }`}
            >
              Kanban
            </button>
          </div>
        )}
      </div>

      {canToggleView && view === "kanban" ? (
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2">
          {QUEUE_COLUMNS.map((column) => {
            const count =
              column.key === "saved"
                ? savedMissions.length
                : column.key === "active"
                  ? dedupedActiveMissions.length
                  : completedEvidence.length;

            return (
              <BoardColumnFrame
                key={column.key}
                label={column.label}
                count={count}
                labelColor={QUEUE_COLUMN_COLORS[column.key]}
              >
                <div className="space-y-2.5">
                  {loading ? (
                    <div className="flex min-h-16 items-center justify-center">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-shell-300 border-t-forest-500" />
                    </div>
                  ) : column.key === "saved" ? (
                    <SavedLane
                      compact={false}
                      items={savedMissions}
                      onRemove={archiveGoal}
                      showAll
                    />
                  ) : column.key === "active" ? (
                    <ActiveLane
                      compact={false}
                      items={dedupedActiveMissions}
                      showAll
                    />
                  ) : (
                    <CompletedLane compact={false} items={completedEvidence} showAll />
                  )}
                </div>
              </BoardColumnFrame>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-hidden p-0">
          {QUEUE_COLUMNS.map((column, index) => {
            const count =
              column.key === "saved"
                ? savedMissions.length
                : column.key === "active"
                  ? dedupedActiveMissions.length
                  : completedEvidence.length;

            return (
              <div
                key={column.key}
                className={index > 0 ? "border-t border-shell-border" : ""}
              >
                <div className="space-y-4 px-4 py-4">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-shell-900">
                        {column.label}
                      </h3>
                      <span className="rounded-full bg-shell-100 px-2.5 py-1 text-xs font-medium text-shell-500">
                        {count}
                      </span>
                    </div>
                    {!compact && (
                      <p className="text-xs text-shell-500">
                        {column.description}
                      </p>
                    )}
                  </div>

                  {loading ? (
                    <div className="flex min-h-16 items-center justify-center">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-shell-300 border-t-forest-500" />
                    </div>
                  ) : column.key === "saved" ? (
                    <SavedLane compact={compact} items={savedMissions} onRemove={archiveGoal} />
                  ) : column.key === "active" ? (
                    <ActiveLane compact={compact} items={dedupedActiveMissions} />
                  ) : (
                    <CompletedLane compact={compact} items={completedEvidence} />
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </section>
  );
}

function SavedLane({
  compact,
  items,
  onRemove,
  showAll = false,
}: {
  compact: boolean;
  items: SavedMissionRecord[];
  onRemove: (goalId: string) => Promise<void>;
  showAll?: boolean;
}) {
  const visibleItems = compact ? items.slice(0, 2) : showAll ? items : items.slice(0, 3);

  if (visibleItems.length === 0) {
    return <EmptyQueueState message="Save a mission to keep it ready for your next rep." />;
  }

  return (
    <div className="space-y-2">
      {visibleItems.map(({ goal, path }) => {
        const title = path?.title ?? goal.title;
        const meta = path
          ? formatMissionDuration(path.estimated_duration_seconds)
          : "Mission details will load when this mission is ready again.";
        const description = path
          ? getMissionBuildsLine(path, { includeDomain: false }) ??
            getMissionExpectedOutput(path)
          : null;
        const href = path ? getMissionRoute(path.id) : null;
        const trailingAction = !compact ? (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              void onRemove(goal.id);
            }}
          >
            Remove
          </Button>
        ) : null;

        return (
          <StaticSavedQueueCard
            key={goal.id}
            title={title}
            meta={meta}
            description={description}
            href={href}
            hrefLabel="Start"
            trailingAction={trailingAction}
          />
        );
      })}
      {items.length > visibleItems.length && (
        <p className="text-xs text-shell-500">
          +{items.length - visibleItems.length} more
        </p>
      )}
    </div>
  );
}

function StaticSavedQueueCard({
  title,
  meta,
  description,
  href,
  hrefLabel,
  trailingAction,
}: {
  title: string;
  meta: string;
  description: string | null;
  href: string | null;
  hrefLabel: string;
  trailingAction?: ReactNode;
}) {
  return (
    <QueueRow
      title={title}
      meta={meta}
      description={description}
      href={href}
      hrefLabel={hrefLabel}
      trailingAction={trailingAction}
    />
  );
}

function ActiveLane({
  compact,
  items,
  showAll = false,
}: {
  compact: boolean;
  items: ActiveMission[];
  showAll?: boolean;
}) {
  const visibleItems = compact ? items.slice(0, 2) : showAll ? items : items.slice(0, 3);

  if (visibleItems.length === 0) {
    return <EmptyQueueState message="Start a mission and it will show up here automatically." />;
  }

  return (
    <div className="space-y-2">
      {visibleItems.map(({ path, progress }) => {
        const percent =
          progress.items_total > 0
            ? Math.round((progress.items_completed / progress.items_total) * 100)
            : 0;

        return (
          <StaticActiveQueueCard
            key={path.id}
            title={path.title}
            meta={getMissionProgressSummary(progress)}
            description={getMissionNextAction(path, progress)}
            href={getMissionRoute(path.id)}
            hrefLabel="Resume"
            percent={percent}
          />
        );
      })}
      {items.length > visibleItems.length && (
        <p className="text-xs text-shell-500">
          +{items.length - visibleItems.length} more
        </p>
      )}
    </div>
  );
}

function CompletedLane({
  compact,
  items,
  showAll = false,
}: {
  compact: boolean;
  items: ProfileAchievement[];
  showAll?: boolean;
}) {
  const visibleItems = compact ? items.slice(0, 2) : showAll ? items : items.slice(0, 3);

  if (visibleItems.length === 0) {
    return <EmptyQueueState message="Finished missions with evidence will appear here." />;
  }

  return (
    <div className="space-y-2">
      {visibleItems.map((achievement) => {
        const levelUpCount =
          achievement.skill_receipt?.skills.filter((entry) => entry.leveled_up).length ?? 0;
        const viewHref = achievement.share_slug
          ? getProgressEvidenceRoute(achievement.share_slug)
          : null;

        return (
          <QueueRow
            key={achievement.id}
            title={achievement.path_title}
            meta={`${formatAchievementDate(achievement.completed_at)} · ${formatAchievementTime(achievement.time_invested_seconds)}`}
            description={
              levelUpCount > 0
                ? `Outcome captured · ${levelUpCount} level-up${levelUpCount > 1 ? "s" : ""}`
                : `Outcome captured · ${formatStepUnit(achievement.items_completed)} completed`
            }
            href={viewHref}
            hrefLabel="View"
          />
        );
      })}
      {items.length > visibleItems.length && (
        <p className="text-xs text-shell-500">
          +{items.length - visibleItems.length} more
        </p>
      )}
    </div>
  );
}

function StaticActiveQueueCard({
  title,
  meta,
  description,
  href,
  hrefLabel,
  percent,
  className,
}: {
  title: string;
  meta: string;
  description: string | null;
  href: string | null;
  hrefLabel: string;
  percent: number;
  className?: string;
}) {
  return (
    <div className={`rounded-[var(--sg-radius-lg)] bg-shell-50 px-3 py-3 ${className ?? ""}`}>
      <div className="space-y-3">
        <QueueRow
          title={title}
          meta={meta}
          description={description}
          href={href}
          hrefLabel={hrefLabel}
        />
        <div className="h-1 overflow-hidden rounded-full bg-shell-100">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${percent}%`,
              background: "var(--sg-forest-500)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function QueueRow({
  title,
  meta,
  description,
  href,
  hrefLabel,
  trailingAction,
  className,
}: {
  title: string;
  meta: string;
  description: string | null;
  href: string | null;
  hrefLabel: string;
  trailingAction?: ReactNode;
  className?: string;
}) {
  return (
    <BoardItemFrame className={className}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-sm font-medium text-shell-900">
            {title}
          </p>
          <p className="text-xs text-shell-500">
            {meta}
          </p>
          {description && (
            <p className="line-clamp-2 text-xs leading-5 text-shell-600">
              {description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-start gap-2">
          {href ? (
            <Link
              href={href}
              className="inline-flex items-center gap-1 text-xs font-medium text-forest-500 transition-colors hover:text-shell-900"
            >
              {hrefLabel}
              <ArrowRight size={12} />
            </Link>
          ) : null}
          {trailingAction}
        </div>
      </div>
    </BoardItemFrame>
  );
}

function EmptyQueueState({ message }: { message: string }) {
  return (
    <div className="rounded-[var(--sg-radius-lg)] border border-dashed border-shell-border bg-shell-50 px-3 py-4 text-sm text-shell-500">
      {message}
    </div>
  );
}

function formatAchievementDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatAchievementTime(seconds: number): string {
  if (seconds < 60) return "<1m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
