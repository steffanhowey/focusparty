"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { MissionRoomPickerModal } from "@/components/missions/MissionRoomPickerModal";
import { Button } from "@/components/ui/Button";
import {
  MISSIONS_ROUTE,
  PROGRESS_ROUTE,
  ROOMS_ROUTE,
  getProgressEvidenceRoute,
} from "@/lib/appRoutes";
import {
  getLaunchRoomMissionFitHint,
  getPartyLaunchDisplayName,
  getPartyLaunchPickerDescription,
} from "@/lib/launchRooms";
import { getMissionLaunchDomain } from "@/lib/launchTaxonomy";
import { prepareMissionRoomEntry } from "@/lib/missionRoomEntry";
import {
  formatMissionDuration,
  getMissionBriefing,
  getMissionCurrentItem,
  getMissionExpectedOutput,
  getMissionFraming,
  getMissionProgressSummary,
  getMissionSuccessPreview,
} from "@/lib/missionPresentation";
import { useMissionLandingPageData } from "@/lib/useMissionLandingPageData";
import type { CurriculumModule, LearningPath, LearningProgress, PathItem } from "@/lib/types";

type MissionLandingState = "ready" | "active" | "completed";

interface MissionUseItem {
  label: string;
  value: string;
}

interface MissionMapRow {
  key: string;
  title: string;
  meta: string | null;
  currentStepTitle: string | null;
  isCurrent: boolean;
  isCompleted: boolean;
}

function getMissionItemKey(item: PathItem, index: number): string {
  return item.item_id ?? item.content_id ?? `idx-${index}`;
}

function isMissionItemCompleted(
  progress: LearningProgress | null,
  item: PathItem,
  index: number,
): boolean {
  return progress?.item_states?.[getMissionItemKey(item, index)]?.completed ?? false;
}

function getMissionLandingState(
  progress: LearningProgress | null,
): MissionLandingState {
  if (progress?.status === "completed") return "completed";
  if (progress?.status === "in_progress" || (progress?.items_completed ?? 0) > 0) {
    return "active";
  }

  return "ready";
}

function formatMissionMetaLine(
  path: LearningPath,
  progress: LearningProgress | null,
): string {
  const effort = formatMissionDuration(path.estimated_duration_seconds);
  const progressSummary = getMissionProgressSummary(progress);
  const stepCount = path.items.length;
  const stepLabel = `${stepCount} ${stepCount === 1 ? "step" : "steps"}`;
  const state = getMissionLandingState(progress);

  if (state === "completed") {
    return `Completed · ${progressSummary} · ${effort}`;
  }

  if (state === "active") {
    return `In progress · ${progressSummary} · ${effort}`;
  }

  return `${effort} · ${stepLabel}`;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function getMissionWhyItMatters(
  path: LearningPath,
  progress: LearningProgress | null,
): string {
  const framing = getMissionFraming(path, progress);
  const framingKey = normalizeText(framing);
  const mission = getMissionBriefing(path, progress);
  const candidates = [mission?.context, path.description, path.goal];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (normalizeText(candidate) === framingKey) continue;
    return candidate;
  }

  return "A practical rep designed to turn AI understanding into finished work.";
}

function buildMissionUseItems(
  path: LearningPath,
  progress: LearningProgress | null,
): MissionUseItem[] {
  const mission = getMissionBriefing(path, progress);
  const items: MissionUseItem[] = [];
  const toolName = mission?.tool?.name ?? path.primary_tools?.[0] ?? null;

  if (toolName) {
    items.push({ label: "Tool", value: toolName });
  }

  if (mission?.tool_prompt?.trim()) {
    items.push({
      label: "Prompt",
      value: toolName ? `Prepared prompt for ${toolName}` : "Prepared prompt included",
    });
  }

  if (mission?.starter_code?.trim()) {
    items.push({
      label: "Starter template",
      value: "Included and ready in room",
    });
  }

  const sourceMaterial = path.items
    .filter((item) => item.task_type === "watch" && item.title.trim())
    .slice(0, 2)
    .map((item) => item.title.trim());

  if (sourceMaterial.length > 0) {
    items.push({
      label: "Source material",
      value: sourceMaterial.join(" · "),
    });
  }

  return items;
}

function buildMissionMapRows(
  path: LearningPath,
  progress: LearningProgress | null,
): MissionMapRow[] {
  const itemsByModule = new Map<number, Array<PathItem & { globalIndex: number }>>();

  path.items.forEach((item, index) => {
    const moduleIndex = item.module_index ?? 0;
    const existing = itemsByModule.get(moduleIndex) ?? [];
    existing.push({ ...item, globalIndex: index });
    itemsByModule.set(moduleIndex, existing);
  });

  const fallbackModules: CurriculumModule[] = [...itemsByModule.entries()]
    .sort(([left], [right]) => left - right)
    .map(([moduleIndex, items], index) => ({
      index: moduleIndex,
      title: itemsByModule.size === 1 ? "Mission" : `Part ${index + 1}`,
      description: "",
      task_count: items.length,
      duration_seconds: items.reduce((sum, item) => sum + item.duration_seconds, 0),
    }));

  const modules = path.modules?.length ? path.modules : fallbackModules;
  const currentItem = getMissionCurrentItem(path, progress);
  const currentModuleIndex = currentItem?.module_index ?? modules[0]?.index ?? 0;
  const isCompleted = getMissionLandingState(progress) === "completed";

  return modules
    .map((module) => {
      const items = itemsByModule.get(module.index) ?? [];
      const stepCount = items.length || module.task_count || 0;
      const stepLabel = stepCount > 0 ? `${stepCount} ${stepCount === 1 ? "step" : "steps"}` : null;
      const durationLabel =
        module.duration_seconds > 0 ? formatMissionDuration(module.duration_seconds) : null;
      const meta = [stepLabel, durationLabel].filter(Boolean).join(" · ") || null;
      const currentStepTitle =
        !isCompleted && module.index === currentModuleIndex ? currentItem?.title ?? null : null;

      return {
        key: `module-${module.index}`,
        title: module.title,
        meta,
        currentStepTitle,
        isCurrent: !isCompleted && module.index === currentModuleIndex,
        isCompleted:
          items.length > 0 &&
          items.every((item) => isMissionItemCompleted(progress, item, item.globalIndex)),
      };
    })
    .filter((row) => row.title || row.meta || row.currentStepTitle);
}

function MissionSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-[var(--sg-shell-border)] pt-6 first:border-t-0 first:pt-0">
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--sg-shell-900)]">{title}</h2>
        {children}
      </div>
    </section>
  );
}

function MissionMapPreview({ rows }: { rows: MissionMapRow[] }) {
  if (rows.length === 0) {
    return (
      <div
        className="rounded-[var(--sg-radius-lg)] border border-[var(--sg-shell-border)] px-4 py-4 text-sm leading-6 text-[var(--sg-shell-500)]"
        style={{
          background: "color-mix(in srgb, var(--sg-white) 78%, var(--sg-shell-50) 22%)",
        }}
      >
        Steps are still being prepared for this mission.
      </div>
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
          className={`px-4 py-4 sm:px-5 ${index > 0 ? "border-t border-[var(--sg-shell-border)]" : ""}`}
          style={{
            background: row.isCurrent
              ? "color-mix(in srgb, var(--sg-sage-100) 42%, var(--sg-white) 58%)"
              : "transparent",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium text-[var(--sg-shell-900)]">{row.title}</p>
              {row.meta ? (
                <p className="text-xs leading-5 text-[var(--sg-shell-500)]">{row.meta}</p>
              ) : null}
              {row.currentStepTitle ? (
                <p className="text-xs leading-5 text-[var(--sg-forest-500)]">
                  Current step: {row.currentStepTitle}
                </p>
              ) : null}
            </div>

            {row.isCompleted ? (
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[var(--sg-forest-500)]" />
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function MissionLandingSkeleton() {
  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_20rem]">
      <aside
        className="order-1 border-b border-[var(--sg-shell-border)] px-5 py-5 sm:px-6 xl:order-2 xl:border-b-0 xl:border-l"
        style={{
          background: "color-mix(in srgb, var(--sg-shell-50) 72%, var(--sg-white) 28%)",
        }}
      >
        <div className="space-y-4">
          <div className="h-4 w-24 animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
          <div className="h-8 w-3/4 animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
          <div className="space-y-2">
            <div className="h-10 w-full animate-pulse rounded-[var(--sg-radius-btn)] bg-[var(--sg-shell-100)]" />
            <div className="h-9 w-full animate-pulse rounded-[var(--sg-radius-btn)] bg-[var(--sg-shell-100)]" />
          </div>
        </div>
      </aside>

      <div className="order-2 px-5 py-6 sm:px-8 sm:py-7 xl:order-1">
        <div className="mx-auto max-w-[760px] space-y-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-3">
              <div className="h-5 w-36 animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
              <div className="h-5 w-full animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
              <div className="h-5 w-4/5 animate-pulse rounded-full bg-[var(--sg-shell-100)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MissionEmptyState({
  title,
  description,
  onBack,
}: {
  title: string;
  description: string;
  onBack: () => void;
}) {
  return (
    <div className="px-5 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-[640px] space-y-5">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-[var(--sg-shell-900)]">{title}</h2>
          <p className="text-sm leading-7 text-[var(--sg-shell-500)]">{description}</p>
        </div>

        <Button variant="cta" size="sm" onClick={onBack}>
          Back to Missions
        </Button>
      </div>
    </div>
  );
}

function LaunchRail({
  state,
  primaryLabel,
  onPrimaryAction,
  onSecondaryAction,
  recommendedRoomName,
  recommendedRoomSupport,
  fallbackRoomName,
  isLoading,
  isCompleted,
  workHref,
}: {
  state: MissionLandingState;
  primaryLabel: string;
  onPrimaryAction: () => void;
  onSecondaryAction: (() => void) | null;
  recommendedRoomName: string | null;
  recommendedRoomSupport: string;
  fallbackRoomName: string | null;
  isLoading: boolean;
  isCompleted: boolean;
  workHref: string | null;
}) {
  const stateLabel =
    state === "completed"
      ? "Completed"
      : state === "active"
        ? "In progress"
        : "Ready";

  return (
    <aside
      className="order-1 border-b border-[var(--sg-shell-border)] px-5 py-5 sm:px-6 xl:order-2 xl:border-b-0 xl:border-l"
      style={{
        background: "color-mix(in srgb, var(--sg-shell-50) 74%, var(--sg-white) 26%)",
      }}
    >
      <div className="space-y-6 xl:sticky xl:top-6">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--sg-shell-500)]">
            {stateLabel}
          </p>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-[var(--sg-shell-900)]">
              Best room fit
            </h2>
            <p className="text-sm leading-6 text-[var(--sg-shell-500)]">
              {recommendedRoomSupport}
            </p>
          </div>
        </div>

        {recommendedRoomName ? (
          <div className="space-y-2">
            <p className="text-base font-semibold text-[var(--sg-shell-900)]">
              {recommendedRoomName}
            </p>
            {fallbackRoomName && fallbackRoomName !== recommendedRoomName ? (
              <p className="text-sm leading-6 text-[var(--sg-shell-500)]">
                Also works well in {fallbackRoomName}.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-3">
          <Button
            variant="cta"
            size="sm"
            fullWidth
            rightIcon={<ArrowRight size={14} />}
            onClick={onPrimaryAction}
            loading={isLoading}
          >
            {primaryLabel}
          </Button>

          {onSecondaryAction ? (
            <Button
              variant="outline"
              size="sm"
              fullWidth
              onClick={onSecondaryAction}
            >
              Choose another room
            </Button>
          ) : null}
        </div>

        {isCompleted ? (
          <div className="space-y-2 border-t border-[var(--sg-shell-border)] pt-5">
            {workHref ? (
              <Link
                href={workHref}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--sg-forest-500)] transition-colors hover:text-[var(--sg-shell-900)]"
              >
                View work
                <ArrowRight size={14} />
              </Link>
            ) : null}

            <Link
              href={PROGRESS_ROUTE}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--sg-shell-600)] transition-colors hover:text-[var(--sg-shell-900)]"
            >
              Open Profile
              <ArrowRight size={14} />
            </Link>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

export function MissionDetailPage({ pathId }: { pathId: string }) {
  const router = useRouter();
  const [showRoomPicker, setShowRoomPicker] = useState(false);
  const [isLaunchingRoom, setIsLaunchingRoom] = useState(false);
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
    fallbackRoom,
    missionDomainLabel,
  } = useMissionLandingPageData(pathId);

  const landingState = useMemo(
    () => getMissionLandingState(progress),
    [progress],
  );
  const launchDomain = useMemo(
    () => (path ? getMissionLaunchDomain(path) : null),
    [path],
  );
  const framing = useMemo(
    () => (path ? getMissionFraming(path, progress) : null),
    [path, progress],
  );
  const whyItMatters = useMemo(
    () => (path ? getMissionWhyItMatters(path, progress) : null),
    [path, progress],
  );
  const outputTitle =
    landingState === "completed" ? "What you made" : "What you'll make";
  const outputLine = useMemo(
    () => (path ? getMissionExpectedOutput(path, progress) : null),
    [path, progress],
  );
  const useItems = useMemo(
    () => (path ? buildMissionUseItems(path, progress) : []),
    [path, progress],
  );
  const mapRows = useMemo(
    () => (path ? buildMissionMapRows(path, progress) : []),
    [path, progress],
  );
  const successCriteria = useMemo(
    () => (path ? getMissionSuccessPreview(path, progress) : []),
    [path, progress],
  );
  const headerMeta = useMemo(
    () => (path ? formatMissionMetaLine(path, progress) : null),
    [path, progress],
  );
  const primaryLabel =
    landingState === "active" ? "Continue in Room" : "Start in Room";
  const workHref =
    achievement?.share_slug ? getProgressEvidenceRoute(achievement.share_slug) : null;
  const recommendedRoomName = recommendedRoom
    ? getPartyLaunchDisplayName(recommendedRoom)
    : null;
  const recommendedRoomSupport =
    recommendedRoom && !roomsLoading
      ? getLaunchRoomMissionFitHint(recommendedRoom) ??
        getPartyLaunchPickerDescription(recommendedRoom)
      : roomsLoading
        ? "Finding the best room for this mission."
        : availableRooms.length > 0 && !roomsError
          ? "Pick the room that feels right for this mission."
          : "Browse rooms to find the right place to do this mission.";
  const fallbackRoomName = fallbackRoom
    ? getPartyLaunchDisplayName(fallbackRoom)
    : null;
  const showSecondaryAction = Boolean(
    recommendedRoom && !roomsLoading && !roomsError && availableRooms.length > 0,
  );
  const primaryActionLoading = Boolean(path) && (roomsLoading || isLaunchingRoom);
  const currentStep = path ? getMissionCurrentItem(path, progress) : null;

  const handlePrimaryAction = () => {
    if (!path) return;

    if (recommendedRoom) {
      setIsLaunchingRoom(true);
      const href = prepareMissionRoomEntry({
        party: recommendedRoom,
        path,
        missionDomainLabel,
      });
      router.push(href);
      return;
    }

    if (!roomsLoading && !roomsError && availableRooms.length > 0) {
      setShowRoomPicker(true);
      return;
    }

    router.push(ROOMS_ROUTE);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--sg-shell-50)]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[280px]"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--sg-sage-100) 52%, var(--sg-white) 48%) 0%, color-mix(in srgb, var(--sg-shell-50) 82%, var(--sg-white) 18%) 72%, transparent 100%)",
        }}
      />

      <div className="relative mx-auto max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8">
        <div
          className="overflow-hidden rounded-[var(--sg-radius-xl)] border border-[var(--sg-shell-border)]"
          style={{
            background:
              "color-mix(in srgb, var(--sg-white) 94%, var(--sg-cream-50) 6%)",
            boxShadow: "var(--shadow-float)",
          }}
        >
          <header className="border-b border-[var(--sg-shell-border)] px-5 py-5 sm:px-8 sm:py-7">
            <div className="space-y-6">
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<ArrowLeft size={14} />}
                  onClick={() => router.push(MISSIONS_ROUTE)}
                >
                  Missions
                </Button>
              </div>

              <div className="max-w-[760px] space-y-2">
                {launchDomain ? (
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--sg-shell-500)]">
                    {launchDomain.label}
                  </p>
                ) : null}

                <h1
                  className="text-[2rem] leading-[1.04] text-[var(--sg-shell-900)] sm:text-[2.6rem]"
                  style={{
                    fontFamily: "var(--font-display), 'Fraunces', Georgia, serif",
                  }}
                >
                  {path?.title ?? "Mission"}
                </h1>

                {headerMeta ? (
                  <p className="text-sm leading-6 text-[var(--sg-shell-500)]">
                    {headerMeta}
                  </p>
                ) : null}
              </div>
            </div>
          </header>

          {isLoading ? (
            <MissionLandingSkeleton />
          ) : error || !path ? (
            <MissionEmptyState
              title="Couldn’t load this mission"
              description={error ?? "Try opening it again from Missions."}
              onBack={() => router.push(MISSIONS_ROUTE)}
            />
          ) : (
            <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_20rem]">
              <LaunchRail
                state={landingState}
                primaryLabel={primaryLabel}
                onPrimaryAction={handlePrimaryAction}
                onSecondaryAction={
                  showSecondaryAction ? () => setShowRoomPicker(true) : null
                }
                recommendedRoomName={recommendedRoomName}
                recommendedRoomSupport={recommendedRoomSupport}
                fallbackRoomName={fallbackRoomName}
                isLoading={primaryActionLoading}
                isCompleted={landingState === "completed"}
                workHref={workHref}
              />

              <div className="order-2 px-5 py-6 sm:px-8 sm:py-7 xl:order-1">
                <div className="mx-auto max-w-[760px] space-y-6">
                  <MissionSection title="Mission framing">
                    <div className="space-y-3">
                      {framing ? (
                        <p className="text-lg leading-8 text-[var(--sg-shell-900)]">
                          {framing}
                        </p>
                      ) : null}

                      {whyItMatters ? (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--sg-shell-500)]">
                            Why it matters
                          </p>
                          <p className="text-sm leading-7 text-[var(--sg-shell-600)]">
                            {whyItMatters}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </MissionSection>

                  <MissionSection title={outputTitle}>
                    <p className="text-lg leading-8 text-[var(--sg-shell-900)]">
                      {outputLine}
                    </p>
                  </MissionSection>

                  {useItems.length > 0 ? (
                    <MissionSection title="What you'll use">
                      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                        {useItems.map((item) => (
                          <div key={item.label} className="space-y-1">
                            <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--sg-shell-500)]">
                              {item.label}
                            </dt>
                            <dd className="text-sm leading-6 text-[var(--sg-shell-700)]">
                              {item.value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </MissionSection>
                  ) : null}

                  <MissionSection title="Mission map">
                    <div className="space-y-3">
                      <p className="text-sm leading-6 text-[var(--sg-shell-500)]">
                        A quiet outline of what&apos;s ahead.
                      </p>
                      <MissionMapPreview rows={mapRows} />
                    </div>
                  </MissionSection>

                  <MissionSection title="What good looks like">
                    <div className="space-y-3">
                      <ul className="space-y-3">
                        {successCriteria.map((criterion) => (
                          <li
                            key={criterion}
                            className="flex items-start gap-3 text-sm leading-6 text-[var(--sg-shell-700)]"
                          >
                            <CheckCircle2
                              size={16}
                              className="mt-1 shrink-0 text-[var(--sg-forest-500)]"
                            />
                            <span>{criterion}</span>
                          </li>
                        ))}
                      </ul>

                      {landingState === "active" && currentStep ? (
                        <p className="text-sm leading-6 text-[var(--sg-shell-500)]">
                          Current step in room: {currentStep.title}
                        </p>
                      ) : null}
                    </div>
                  </MissionSection>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {path && showRoomPicker ? (
        <MissionRoomPickerModal
          isOpen={showRoomPicker}
          onClose={() => setShowRoomPicker(false)}
          path={path}
        />
      ) : null}
    </div>
  );
}
