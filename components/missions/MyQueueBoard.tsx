"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Bookmark, Clock3 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useGoals } from "@/lib/useGoals";
import type { GoalRecord } from "@/lib/types";
import type { LearningPath, LearningProgress } from "@/lib/types";
import type { ProfileAchievement } from "@/lib/useSkillProfile";
import { getMissionRoute } from "@/lib/appRoutes";
import { MissionOutcomeCard } from "@/components/progress/MissionOutcomeCard";

type ActiveMission = {
  path: LearningPath;
  progress: LearningProgress;
};

interface MyQueueBoardProps {
  compact?: boolean;
  availablePaths?: LearningPath[];
  activeMissions?: ActiveMission[];
  completedEvidence?: ProfileAchievement[];
}

type QueueLane = "saved" | "active" | "completed";

interface QueueColumnDef {
  key: QueueLane;
  label: string;
  description: string;
}

const QUEUE_COLUMNS: QueueColumnDef[] = [
  {
    key: "saved",
    label: "Saved",
    description: "Missions you want to keep within reach.",
  },
  {
    key: "active",
    label: "Active",
    description: "Work already in motion.",
  },
  {
    key: "completed",
    label: "Completed",
    description: "Mission outcomes with visible evidence.",
  },
];

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `~${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `~${hours}h ${remainder}m` : `~${hours}h`;
}

function formatCompletedLabel(progress: LearningProgress): string {
  const percent =
    progress.items_total > 0
      ? Math.round((progress.items_completed / progress.items_total) * 100)
      : 0;
  return `${progress.items_completed}/${progress.items_total} complete · ${percent}%`;
}

interface SavedMissionRecord {
  goal: GoalRecord;
  path: LearningPath | null;
}

/**
 * Phase 1 queue bridge:
 * keeps the existing goal rows as save-state persistence for missions while
 * deriving Active and Completed from real mission progress and evidence.
 */
export function MyQueueBoard({
  compact = false,
  availablePaths = [],
  activeMissions = [],
  completedEvidence = [],
}: MyQueueBoardProps) {
  const { goals, loading, archiveGoal } = useGoals();
  const [savedPathMap, setSavedPathMap] = useState<Record<string, LearningPath>>(
    {},
  );

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
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-shell-900">
            My Queue
          </h2>
          <p className="text-sm text-shell-500">
            Save the next mission, keep active work moving, and hold onto recent evidence.
          </p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {QUEUE_COLUMNS.map((column) => {
          const count =
            column.key === "saved"
              ? savedMissions.length
              : column.key === "active"
                ? dedupedActiveMissions.length
                : completedEvidence.length;

          return (
            <Card key={column.key} className="p-4">
              <div className="space-y-4">
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
                  <div className="flex min-h-24 items-center justify-center">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-shell-300 border-t-forest-500" />
                  </div>
                ) : column.key === "saved" ? (
                  <SavedLane
                    compact={compact}
                    items={savedMissions}
                    onRemove={archiveGoal}
                  />
                ) : column.key === "active" ? (
                  <ActiveLane compact={compact} items={dedupedActiveMissions} />
                ) : (
                  <CompletedLane compact={compact} items={completedEvidence} />
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function SavedLane({
  compact,
  items,
  onRemove,
}: {
  compact: boolean;
  items: SavedMissionRecord[];
  onRemove: (goalId: string) => Promise<void>;
}) {
  const visibleItems = compact ? items.slice(0, 2) : items;

  if (visibleItems.length === 0) {
    return (
      <EmptyQueueState message="Save a mission to keep it ready for your next rep." />
    );
  }

  return (
    <div className="space-y-2">
      {visibleItems.map(({ goal, path }) => (
        <Card key={goal.id} className="p-3">
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-shell-500">
                <Bookmark size={11} />
                Saved
              </div>
              <p className="text-sm font-medium leading-snug text-shell-900">
                {path?.title ?? goal.title}
              </p>
              {path ? (
                <p className="text-xs text-shell-500">
                  {formatDuration(path.estimated_duration_seconds)}
                </p>
              ) : (
                <p className="text-xs text-shell-500">
                  Mission details will load when this mission is ready again.
                </p>
              )}
            </div>

            {!compact && (
              <div className="flex items-center gap-2">
                {path && (
                  <Link
                    href={getMissionRoute(path.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-forest-500 transition-colors hover:text-shell-900"
                  >
                    Open mission
                    <ArrowRight size={12} />
                  </Link>
                )}
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    void onRemove(goal.id);
                  }}
                >
                  Remove
                </Button>
              </div>
            )}
          </div>
        </Card>
      ))}
      {compact && items.length > visibleItems.length && (
        <p className="text-xs text-shell-500">
          +{items.length - visibleItems.length} more
        </p>
      )}
    </div>
  );
}

function ActiveLane({
  compact,
  items,
}: {
  compact: boolean;
  items: ActiveMission[];
}) {
  const visibleItems = compact ? items.slice(0, 2) : items;

  if (visibleItems.length === 0) {
    return (
      <EmptyQueueState message="Start a mission and it will show up here automatically." />
    );
  }

  return (
    <div className="space-y-2">
      {visibleItems.map(({ path, progress }) => (
        <Card key={path.id} className="p-3">
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-forest-500">
                <Clock3 size={11} />
                Active
              </div>
              <p className="text-sm font-medium leading-snug text-shell-900">
                {path.title}
              </p>
              <p className="text-xs text-shell-500">
                {formatCompletedLabel(progress)}
              </p>
            </div>

            <div className="h-1 overflow-hidden rounded-full bg-shell-100">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${
                    progress.items_total > 0
                      ? Math.round((progress.items_completed / progress.items_total) * 100)
                      : 0
                  }%`,
                  background: "var(--sg-forest-500)",
                }}
              />
            </div>

            {!compact && (
              <Link
                href={getMissionRoute(path.id)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-forest-500 transition-colors hover:text-shell-900"
              >
                Continue mission
                <ArrowRight size={12} />
              </Link>
            )}
          </div>
        </Card>
      ))}
      {compact && items.length > visibleItems.length && (
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
}: {
  compact: boolean;
  items: ProfileAchievement[];
}) {
  const visibleItems = compact ? items.slice(0, 2) : items;

  if (visibleItems.length === 0) {
    return (
      <EmptyQueueState message="Finished missions with evidence will appear here." />
    );
  }

  return (
    <div className="space-y-2">
      {visibleItems.map((achievement) => (
        <MissionOutcomeCard
          key={achievement.id}
          achievement={achievement}
          compact={compact}
        />
      ))}
      {compact && items.length > visibleItems.length && (
        <p className="text-xs text-shell-500">
          +{items.length - visibleItems.length} more
        </p>
      )}
    </div>
  );
}

function EmptyQueueState({ message }: { message: string }) {
  return (
    <div className="rounded-[var(--sg-radius-lg)] border border-dashed border-shell-border bg-shell-50 px-3 py-4 text-sm text-shell-500">
      {message}
    </div>
  );
}
