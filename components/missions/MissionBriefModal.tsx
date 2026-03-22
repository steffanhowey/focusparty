"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { MissionRoomPickerModal } from "@/components/missions/MissionRoomPickerModal";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  ROOMS_ROUTE,
  getProgressEvidenceRoute,
} from "@/lib/appRoutes";
import { getMissionLaunchDomain } from "@/lib/launchTaxonomy";
import {
  prepareMissionRoomEntry,
  prepareMissionRoomHandoff,
} from "@/lib/missionRoomEntry";
import {
  formatMissionDuration,
  getMissionArtifactLabel,
  getMissionCompletionStandard,
  getMissionFraming,
  getMissionExpectedOutput,
  getMissionScopeGuardrails,
  getMissionSuccessPreview,
  getMissionWhyNow,
} from "@/lib/missionPresentation";
import { useMissionLandingPageData } from "@/lib/useMissionLandingPageData";
import type {
  LearningPath,
  LearningProgress,
  PathItem,
} from "@/lib/types";

type MissionBriefState = "ready" | "active" | "completed";

interface MissionBriefModalProps {
  isOpen: boolean;
  onClose: () => void;
  path: LearningPath;
  progress?: LearningProgress | null;
}

interface MissionStepPreviewRow {
  key: string;
  title: string;
  meta: string | null;
  containsCurrent: boolean;
  isCompleted: boolean;
  targetItemIndex: number | null;
}

interface MissionStepPreviewWindow {
  rows: MissionStepPreviewRow[];
  actionableRowKey: string | null;
  hiddenBeforeCount: number;
  hiddenAfterCount: number;
}

interface MissionStepTarget {
  missionStepIndex: number;
  missionStepTitle: string;
}

function getMissionBriefState(
  progress: LearningProgress | null,
): MissionBriefState {
  if (progress?.status === "completed") return "completed";
  if (progress?.status === "in_progress" || (progress?.items_completed ?? 0) > 0) {
    return "active";
  }

  return "ready";
}

function getPathItemKey(item: PathItem, index: number): string {
  return item.item_id ?? item.content_id ?? `idx-${index}`;
}

function isMissionItemCompleted(
  progress: LearningProgress | null,
  item: PathItem,
  index: number,
): boolean {
  return progress?.item_states?.[getPathItemKey(item, index)]?.completed ?? false;
}

function getItemTaskLabel(item: PathItem): string {
  if (item.task_type === "do") return "Build";
  if (item.task_type === "check") return "Check";
  if (item.task_type === "reflect") return "Reflect";
  return item.content_type === "video" ? "Watch" : "Read";
}

function buildMissionStepPreview(
  path: LearningPath,
  progress: LearningProgress | null,
): MissionStepPreviewWindow {
  const state = getMissionBriefState(progress);
  const currentItemIndex = progress?.current_item_index ?? 0;
  const currentItem = path.items[currentItemIndex] ?? path.items[0] ?? null;
  const allRows: MissionStepPreviewRow[] = [];

  if (path.modules?.length) {
    const itemsByModule = new Map<number, Array<PathItem & { globalIndex: number }>>();

    path.items.forEach((item, index) => {
      const moduleIndex = item.module_index ?? 0;
      const existing = itemsByModule.get(moduleIndex) ?? [];
      existing.push({ ...item, globalIndex: index });
      itemsByModule.set(moduleIndex, existing);
    });

    allRows.push(
      ...[...path.modules]
      .sort((left, right) => left.index - right.index)
      .map((module) => {
        const items = itemsByModule.get(module.index) ?? [];
        const stepCount = items.length || module.task_count || 0;
        const stepLabel =
          stepCount > 0 ? `${stepCount} ${stepCount === 1 ? "step" : "steps"}` : null;
        const durationLabel =
          module.duration_seconds > 0 ? formatMissionDuration(module.duration_seconds) : null;
        const meta = [stepLabel, durationLabel].filter(Boolean).join(" · ") || null;
        const firstIncompleteItem =
          items.find((item) => !isMissionItemCompleted(progress, item, item.globalIndex)) ?? null;
        const isCompleted =
          items.length > 0 &&
          items.every((item) => isMissionItemCompleted(progress, item, item.globalIndex));

        return {
          key: `module-${module.index}`,
          title: module.title,
          meta,
          containsCurrent:
            state !== "completed" &&
            module.index === (currentItem?.module_index ?? path.modules?.[0]?.index ?? 0),
          isCompleted,
          targetItemIndex: isCompleted ? null : firstIncompleteItem?.globalIndex ?? null,
        };
      })
      .filter((row) => row.title),
    );
  } else {
    allRows.push(
      ...path.items.map((item, index) => {
        const durationLabel =
          item.duration_seconds > 0 ? formatMissionDuration(item.duration_seconds) : null;
        const taskLabel = getItemTaskLabel(item);
        const meta = [taskLabel, durationLabel].filter(Boolean).join(" · ") || null;
        const itemKey = getPathItemKey(item, index);
        const isCompleted = isMissionItemCompleted(progress, item, index);

        return {
          key: itemKey,
          title: item.title,
          meta,
          containsCurrent: state !== "completed" && currentItemIndex === index,
          isCompleted,
          targetItemIndex: isCompleted ? null : index,
        };
      }),
    );
  }

  const actionableRowIndex =
    allRows.findIndex((row) => row.targetItemIndex !== null) ?? -1;
  const safeActionableRowIndex = actionableRowIndex >= 0 ? actionableRowIndex : -1;

  if (allRows.length <= 3) {
    return {
      rows: allRows,
      actionableRowKey:
        safeActionableRowIndex >= 0 ? allRows[safeActionableRowIndex]?.key ?? null : null,
      hiddenBeforeCount: 0,
      hiddenAfterCount: 0,
    };
  }

  let startIndex = 0;
  if (state === "active" && safeActionableRowIndex >= 0) {
    startIndex = Math.max(0, safeActionableRowIndex - 1);
    const maxStartIndex = Math.max(allRows.length - 3, 0);
    startIndex = Math.min(startIndex, maxStartIndex);
  }

  const endIndex = Math.min(startIndex + 3, allRows.length);
  return {
    rows: allRows.slice(startIndex, endIndex),
    actionableRowKey:
      safeActionableRowIndex >= 0 ? allRows[safeActionableRowIndex]?.key ?? null : null,
    hiddenBeforeCount: startIndex,
    hiddenAfterCount: Math.max(allRows.length - endIndex, 0),
  };
}

function BriefSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2 border-t border-[var(--sg-shell-border)] px-6 py-4 first:border-t-0">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--sg-shell-500)]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function MissionStepPreview({
  rows,
  state,
  actionableRowKey,
  hiddenBeforeCount,
  hiddenAfterCount,
  launchingRowKey,
  canLaunchStep,
  onLaunchStep,
}: {
  rows: MissionStepPreviewRow[];
  state: MissionBriefState;
  actionableRowKey: string | null;
  hiddenBeforeCount: number;
  hiddenAfterCount: number;
  launchingRowKey: string | null;
  canLaunchStep: boolean;
  onLaunchStep: (row: MissionStepPreviewRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm leading-6 text-[var(--sg-shell-500)]">
        Steps are still being prepared for this mission.
      </p>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-[var(--sg-radius-lg)] border border-[var(--sg-shell-border)]"
      style={{
        background: "color-mix(in srgb, var(--sg-white) 76%, var(--sg-shell-50) 24%)",
      }}
    >
      {rows.map((row, index) => (
        <div
          key={row.key}
          className={`px-4 py-3 ${index > 0 ? "border-t border-[var(--sg-shell-border)]" : ""}`}
          style={{
            background: row.containsCurrent
              ? "color-mix(in srgb, var(--sg-sage-100) 44%, var(--sg-white) 56%)"
              : "transparent",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-medium text-[var(--sg-shell-900)]">{row.title}</p>
              {row.meta ? (
                <p className="text-xs leading-5 text-[var(--sg-shell-500)]">{row.meta}</p>
              ) : null}
            </div>
            {row.isCompleted ? (
              <span className="inline-flex shrink-0 items-center gap-1 self-center text-2xs font-medium uppercase tracking-[0.12em] text-[var(--sg-forest-500)]">
                <CheckCircle2 size={12} />
                Done
              </span>
            ) : actionableRowKey === row.key && row.targetItemIndex !== null ? (
              <Button
                variant="outline"
                size="xs"
                onClick={() => onLaunchStep(row)}
                loading={launchingRowKey === row.key}
                disabled={!canLaunchStep}
              >
                {state === "active" && row.containsCurrent ? "Continue" : "Start"}
              </Button>
            ) : null}
          </div>
        </div>
      ))}

      {hiddenBeforeCount > 0 || hiddenAfterCount > 0 ? (
        <div className="border-t border-[var(--sg-shell-border)] px-4 py-3">
          <p className="text-xs leading-5 text-[var(--sg-shell-500)]">
            {hiddenBeforeCount > 0 ? `+${hiddenBeforeCount} earlier` : null}
            {hiddenBeforeCount > 0 && hiddenAfterCount > 0 ? " · " : null}
            {hiddenAfterCount > 0
              ? `+${hiddenAfterCount} more ${hiddenAfterCount === 1 ? "step" : "steps"}`
              : null}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function MissionBriefSkeleton() {
  return (
    <div className="space-y-4 px-6 py-6">
      <div className="space-y-2">
        <div className="h-3 w-28 animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
        <div className="h-8 w-3/4 animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
        <div className="h-4 w-full animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
      </div>
      <div className="h-20 animate-pulse rounded-[var(--sg-radius-lg)] bg-[var(--sg-shell-50)]" />
      <div className="h-20 animate-pulse rounded-[var(--sg-radius-lg)] bg-[var(--sg-shell-50)]" />
    </div>
  );
}

export function MissionBriefModal({
  isOpen,
  onClose,
  path: initialPath,
  progress: initialProgress = null,
}: MissionBriefModalProps) {
  const router = useRouter();
  const [showRoomPicker, setShowRoomPicker] = useState(false);
  const [isLaunchingRoom, setIsLaunchingRoom] = useState(false);
  const [launchingRowKey, setLaunchingRowKey] = useState<string | null>(null);
  const [selectedStepTarget, setSelectedStepTarget] = useState<MissionStepTarget | null>(null);
  const {
    path,
    progress,
    achievement,
    isLoading,
    error,
    availableRooms,
    roomsLoading,
    roomsError,
    recommendedRoom,
    missionDomainLabel,
  } = useMissionLandingPageData(initialPath.id);

  const effectivePath = path ?? initialPath;
  const effectiveProgress = progress ?? initialProgress;
  const state = useMemo(
    () => getMissionBriefState(effectiveProgress),
    [effectiveProgress],
  );
  const launchDomain = useMemo(
    () => getMissionLaunchDomain(effectivePath),
    [effectivePath],
  );
  const framing = useMemo(
    () => getMissionFraming(effectivePath, effectiveProgress),
    [effectivePath, effectiveProgress],
  );
  const whyNow = useMemo(
    () => getMissionWhyNow(effectivePath, effectiveProgress),
    [effectivePath, effectiveProgress],
  );
  const scopeGuardrails = useMemo(
    () => getMissionScopeGuardrails(effectivePath),
    [effectivePath],
  );
  const artifactLabel = useMemo(
    () => getMissionArtifactLabel(effectivePath),
    [effectivePath],
  );
  const expectedOutput = useMemo(
    () => getMissionExpectedOutput(effectivePath, effectiveProgress),
    [effectivePath, effectiveProgress],
  );
  const completionStandard = useMemo(
    () => getMissionCompletionStandard(effectivePath),
    [effectivePath],
  );
  const successPreview = useMemo(
    () => getMissionSuccessPreview(effectivePath, effectiveProgress).slice(0, 3),
    [effectivePath, effectiveProgress],
  );
  const stepPreview = useMemo(
    () => buildMissionStepPreview(effectivePath, effectiveProgress),
    [effectivePath, effectiveProgress],
  );
  const workHref =
    achievement?.share_slug ? getProgressEvidenceRoute(achievement.share_slug) : null;
  const primaryLabel = state === "active" ? "Continue in Room" : "Start in Room";
  const showChooseAnotherRoom = Boolean(
    recommendedRoom && !roomsLoading && !roomsError && availableRooms.length > 0,
  );
  const primaryActionLoading = roomsLoading || (isLaunchingRoom && launchingRowKey === null);
  const showStatus = state !== "ready";
  const canLaunchStep = !roomsLoading && !isLaunchingRoom;
  const handleCloseBrief = () => {
    setShowRoomPicker(false);
    setIsLaunchingRoom(false);
    setLaunchingRowKey(null);
    setSelectedStepTarget(null);
    onClose();
  };

  const handleOpenRoomEntry = (stepTarget: MissionStepTarget | null) => {
    if (recommendedRoom) {
      setIsLaunchingRoom(true);
      const href = prepareMissionRoomEntry({
        party: recommendedRoom,
        path: effectivePath,
        missionDomainLabel,
        missionStepIndex: stepTarget?.missionStepIndex ?? null,
        missionStepTitle: stepTarget?.missionStepTitle ?? null,
      });
      router.push(href);
      return;
    }

    if (!roomsLoading && !roomsError && availableRooms.length > 0) {
      setLaunchingRowKey(null);
      setSelectedStepTarget(stepTarget);
      setShowRoomPicker(true);
      return;
    }

    setLaunchingRowKey(null);
    prepareMissionRoomHandoff({
      path: effectivePath,
      missionDomainLabel,
      missionStepIndex: stepTarget?.missionStepIndex ?? null,
      missionStepTitle: stepTarget?.missionStepTitle ?? null,
    });
    router.push(ROOMS_ROUTE);
  };

  const handlePrimaryAction = () => {
    setLaunchingRowKey(null);
    setSelectedStepTarget(null);
    handleOpenRoomEntry(null);
  };

  const handleLaunchStep = (row: MissionStepPreviewRow) => {
    if (row.targetItemIndex === null) return;

    setLaunchingRowKey(row.key);
    handleOpenRoomEntry({
      missionStepIndex: row.targetItemIndex,
      missionStepTitle: row.title,
    });
  };

  if (!isOpen) return null;

  if (showRoomPicker) {
    return (
      <MissionRoomPickerModal
        isOpen={isOpen}
        onClose={handleCloseBrief}
        onBack={() => setShowRoomPicker(false)}
        backLabel="Back to mission"
        title="Choose another room"
        path={effectivePath}
        missionStepIndex={selectedStepTarget?.missionStepIndex ?? null}
        missionStepTitle={selectedStepTarget?.missionStepTitle ?? null}
      />
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCloseBrief}
      ariaLabel={`Mission brief for ${effectivePath.title}`}
      panelClassName="max-w-[720px] !p-0"
    >
      <div className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-36"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in srgb, var(--sg-sage-100) 48%, var(--sg-white) 52%) 0%, transparent 100%)",
          }}
        />

        {isLoading && !path ? (
          <MissionBriefSkeleton />
        ) : error && !path ? (
          <div className="space-y-4 px-6 py-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-[var(--sg-shell-900)]">
                Couldn&apos;t load this mission
              </p>
              <p className="text-sm leading-6 text-[var(--sg-shell-500)]">
                {error}
              </p>
            </div>

            <div className="flex justify-end">
              <Button variant="cta" size="sm" onClick={handleCloseBrief}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="relative space-y-3 px-6 pb-6 pt-7 sm:pr-16">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--sg-shell-500)]">
                  {launchDomain.label}
                </p>
                {showStatus ? (
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-1 text-2xs font-semibold"
                    style={{
                      background:
                        state === "completed"
                          ? "color-mix(in srgb, var(--sg-gold-100) 72%, var(--sg-white) 28%)"
                          : "color-mix(in srgb, var(--sg-sage-100) 72%, var(--sg-white) 28%)",
                      color:
                        state === "completed"
                          ? "var(--sg-gold-700)"
                          : "var(--sg-forest-500)",
                    }}
                  >
                    {state === "completed" ? "Completed" : "In progress"}
                  </span>
                ) : null}
              </div>

              <div className="space-y-2">
                <h2 className="text-[1.55rem] font-semibold leading-[1.1] text-[var(--sg-shell-900)]">
                  {effectivePath.title}
                </h2>
                <p className="text-sm leading-7 text-[var(--sg-shell-700)]">{framing}</p>
              </div>
            </div>

            <BriefSection title="Mission focus">
              <div className="space-y-3">
                <p className="text-sm leading-7 text-[var(--sg-shell-700)]">{whyNow}</p>
                {scopeGuardrails ? (
                  <p className="text-sm leading-7 text-[var(--sg-shell-500)]">
                    {scopeGuardrails}
                  </p>
                ) : null}
              </div>
            </BriefSection>

            <BriefSection title="What you'll make">
              <div className="space-y-3">
                {artifactLabel ? (
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--sg-shell-500)]">
                    {artifactLabel}
                  </p>
                ) : null}

                <p className="text-sm leading-7 text-[var(--sg-shell-700)]">
                  {expectedOutput}
                </p>

                {successPreview.length > 0 ? (
                  <ul className="space-y-2">
                    {successPreview.map((criterion) => (
                      <li
                        key={criterion}
                        className="flex items-start gap-2 text-sm leading-6 text-[var(--sg-shell-600)]"
                      >
                        <CheckCircle2
                          size={14}
                          className="mt-1 shrink-0 text-[var(--sg-forest-500)]"
                        />
                        <span>{criterion}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {completionStandard ? (
                  <p className="text-sm leading-7 text-[var(--sg-shell-500)]">
                    {completionStandard}
                  </p>
                ) : null}
              </div>
            </BriefSection>

            <BriefSection title="Mission steps">
              <MissionStepPreview
                rows={stepPreview.rows}
                state={state}
                actionableRowKey={stepPreview.actionableRowKey}
                hiddenBeforeCount={stepPreview.hiddenBeforeCount}
                hiddenAfterCount={stepPreview.hiddenAfterCount}
                launchingRowKey={launchingRowKey}
                canLaunchStep={canLaunchStep}
                onLaunchStep={handleLaunchStep}
              />
            </BriefSection>

            <div className="px-6 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  {state === "completed" && workHref ? (
                    <Link
                      href={workHref}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--sg-forest-500)] transition-colors hover:text-[var(--sg-shell-900)]"
                    >
                      View work
                      <ArrowRight size={14} />
                    </Link>
                  ) : null}
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  {showChooseAnotherRoom ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setLaunchingRowKey(null);
                        setSelectedStepTarget(null);
                        setShowRoomPicker(true);
                      }}
                      disabled={isLaunchingRoom}
                    >
                      Choose another room
                    </Button>
                  ) : null}
                  <Button
                    variant="cta"
                    size="sm"
                    rightIcon={<ArrowRight size={14} />}
                    onClick={handlePrimaryAction}
                    loading={primaryActionLoading}
                    disabled={roomsLoading || isLaunchingRoom}
                  >
                    {primaryLabel}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
