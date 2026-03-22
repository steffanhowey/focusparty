"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { LaunchpadHero } from "@/components/home/LaunchpadHero";
import { PathCardSkeleton } from "@/components/learn/PathCardSkeleton";
import { useLearnSearch } from "@/lib/useLearnSearch";
import { useSkillProfile } from "@/lib/useSkillProfile";
import {
  MISSIONS_ROUTE,
} from "@/lib/appRoutes";
import { MissionCard } from "@/components/missions/MissionCard";
import { MissionBriefModal } from "@/components/missions/MissionBriefModal";
import { buildHomePrimaryAction } from "@/lib/homeLaunchpad";
import {
  buildLaunchFrontDoorBuckets,
  CORE_LAUNCH_FRONT_DOOR_STEPS,
} from "@/lib/launchFrontDoor";
import { buildMissionRecommendations } from "@/lib/missionRecommendations";
import {
  getMissionLaunchDomain,
  LAUNCH_DOMAIN_OPTIONS,
} from "@/lib/launchTaxonomy";
import { useMissionRecommendations } from "@/lib/useMissionRecommendations";
import type { LearningPath, LearningProgress } from "@/lib/types";
import { getLaunchMissionLaneKey } from "@/lib/launchMissionContent";

interface CategoryDef {
  value: string;
  label: string;
}

interface MissionBriefSelection {
  path: LearningPath;
  progress: LearningProgress | null;
}

const CATEGORIES: CategoryDef[] = [
  { value: "all", label: "All" },
  { value: "in-progress", label: "In Progress" },
  ...LAUNCH_DOMAIN_OPTIONS.map((domain) => ({
    value: domain.key,
    label: domain.label,
  })),
];

function pathMatchesCategory(
  path: LearningPath,
  categoryValue: string,
): boolean {
  if (categoryValue === "all") return true;
  return getMissionLaunchDomain(path).key === categoryValue;
}

type SortOption =
  | "recommended"
  | "newest"
  | "popular"
  | "shortest"
  | "longest"
  | "beginner-first"
  | "advanced-first";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "newest", label: "Newest" },
  { value: "popular", label: "Popular" },
  { value: "shortest", label: "Shortest" },
  { value: "longest", label: "Longest" },
  { value: "beginner-first", label: "Beginner First" },
  { value: "advanced-first", label: "Advanced First" },
];

const DISCOVERY_SELECT_CLASS_NAME =
  "cursor-pointer appearance-none rounded-full border border-shell-border bg-shell-50 px-4 py-2 pr-8 text-sm text-shell-600 transition-colors hover:border-forest-400 focus:border-forest-400 focus:outline-none";

const DIFFICULTY_ORDER: Record<string, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

export function MissionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    query,
    setQuery,
    discoveryPaths,
    inProgressPaths,
    isLoading,
    searchResults,
    isSearching,
    error,
  } = useLearnSearch();
  const { achievements } = useSkillProfile();
  const activeMission = inProgressPaths[0] ?? null;
  const { recommendations, isLoading: recommendationsLoading } =
    useMissionRecommendations({
      surface: "home",
      activePathId: activeMission?.path.id ?? null,
      activePath: activeMission?.path ?? null,
    });

  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<SortOption>("recommended");
  const [selectedMissionBrief, setSelectedMissionBrief] =
    useState<MissionBriefSelection | null>(null);

  useEffect(() => {
    const initialQuery = searchParams.get("q")?.trim();
    if (!initialQuery || initialQuery === query) return;

    const timeoutId = window.setTimeout(() => {
      setQuery(initialQuery);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [query, searchParams, setQuery]);

  const progressMap = useMemo(() => {
    const map = new Map<string, LearningProgress>();
    for (const { path, progress } of inProgressPaths) {
      map.set(path.id, progress);
    }
    return map;
  }, [inProgressPaths]);

  const completedPathIds = useMemo(
    () => new Set(achievements.map((achievement) => achievement.path_id)),
    [achievements],
  );
  const activePathIds = useMemo(
    () => new Set(inProgressPaths.map((entry) => entry.path.id)),
    [inProgressPaths],
  );

  const allPaths = useMemo(() => {
    const inProgressIds = new Set(inProgressPaths.map(({ path }) => path.id));
    const activePaths = inProgressPaths.map(({ path }) => path);
    const otherPaths = discoveryPaths.filter(
      (path) => !inProgressIds.has(path.id),
    );
    return [...activePaths, ...otherPaths];
  }, [discoveryPaths, inProgressPaths]);

  const fallbackMissionRecommendations = useMemo(() => {
    const availableFallbackPaths = discoveryPaths.filter((path) => {
      if (activePathIds.has(path.id)) return false;
      if (completedPathIds.has(path.id)) return false;
      if (
        recommendations.some(
          (recommendation) => recommendation.path.id === path.id,
        )
      ) {
        return false;
      }
      return true;
    });

    return buildMissionRecommendations(
      availableFallbackPaths.map((path) => ({
        reason: "domain_expansion" as const,
        priority: 0,
        paths: [path],
        action: null,
      })),
      {
        surface: "home",
        activePathId: activeMission?.path.id ?? null,
        activePath: activeMission?.path ?? null,
      },
    );
  }, [
    activeMission?.path,
    activePathIds,
    completedPathIds,
    discoveryPaths,
    recommendations,
  ]);

  const primaryAction = useMemo(
    () =>
      buildHomePrimaryAction({
        activeMission,
        recommendations,
        fallbackRecommendations: fallbackMissionRecommendations,
      }),
    [activeMission, fallbackMissionRecommendations, recommendations],
  );
  const isInitialMissionLoad =
    !query.trim() &&
    isLoading &&
    discoveryPaths.length === 0 &&
    inProgressPaths.length === 0;
  const heroIsLoading =
    isInitialMissionLoad ||
    (!activeMission &&
      recommendationsLoading &&
      recommendations.length === 0 &&
      fallbackMissionRecommendations.length === 0);

  const searchMode = query.trim().length > 0;
  const filteredSearchResults = useMemo(
    () =>
      searchResults.filter((path) => {
        const progress = progressMap.get(path.id);
        return (
          progress?.status !== "completed" && !completedPathIds.has(path.id)
        );
      }),
    [completedPathIds, progressMap, searchResults],
  );
  const visibleSearchResults = filteredSearchResults.slice(0, 4);
  const hiddenSearchResultCount = Math.max(
    filteredSearchResults.length - visibleSearchResults.length,
    0,
  );
  const visibleCategories = useMemo(
    () =>
      CATEGORIES.filter(
        (option) =>
          option.value !== "in-progress" || inProgressPaths.length > 0,
      ),
    [inProgressPaths.length],
  );
  const filteredDiscoveryPaths = useMemo(() => {
    let paths = allPaths.filter((path) => !completedPathIds.has(path.id));

    if (category === "in-progress") {
      paths = paths.filter((path) => progressMap.has(path.id));
    } else if (category !== "all") {
      paths = paths.filter((path) => pathMatchesCategory(path, category));
    }

    if (inProgressPaths.length > 0 && category !== "in-progress") {
      const inProgressIds = new Set(inProgressPaths.map(({ path }) => path.id));
      paths = paths.filter((path) => !inProgressIds.has(path.id));
    }

    return paths;
  }, [allPaths, category, completedPathIds, inProgressPaths, progressMap]);
  const launchFrontDoor = useMemo(
    () => buildLaunchFrontDoorBuckets(allPaths.filter((path) => !completedPathIds.has(path.id))),
    [allPaths, completedPathIds],
  );
  const sortedDiscoveryPaths = useMemo(() => {
    const curatedIds = new Set(
      !query.trim()
        ? [
            ...launchFrontDoor.corePaths.map((path) => path.id),
            ...launchFrontDoor.extendedPaths.map((path) => path.id),
          ]
        : [],
    );
    const paths = [...filteredDiscoveryPaths].filter((path) => !curatedIds.has(path.id));

    switch (sort) {
      case "newest":
        return paths.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
      case "popular":
        return paths.sort(
          (a, b) => (b.start_count ?? 0) - (a.start_count ?? 0),
        );
      case "shortest":
        return paths.sort(
          (a, b) => a.estimated_duration_seconds - b.estimated_duration_seconds,
        );
      case "longest":
        return paths.sort(
          (a, b) => b.estimated_duration_seconds - a.estimated_duration_seconds,
        );
      case "beginner-first":
        return paths.sort(
          (a, b) =>
            (DIFFICULTY_ORDER[a.difficulty_level] ?? 1) -
            (DIFFICULTY_ORDER[b.difficulty_level] ?? 1),
        );
      case "advanced-first":
        return paths.sort(
          (a, b) =>
            (DIFFICULTY_ORDER[b.difficulty_level] ?? 1) -
            (DIFFICULTY_ORDER[a.difficulty_level] ?? 1),
        );
      case "recommended":
      default:
        return paths;
    }
  }, [filteredDiscoveryPaths, launchFrontDoor.corePaths, launchFrontDoor.extendedPaths, query, sort]);
  const visibleDiscoveryPaths = sortedDiscoveryPaths;
  const openMissionBrief = useCallback(
    (path: LearningPath, progress: LearningProgress | null = null) => {
      setSelectedMissionBrief({ path, progress });
    },
    [],
  );
  const handleOpenPrimaryAction = useCallback(() => {
    const heroMission = primaryAction.mission;

    if (heroMission) {
      openMissionBrief(heroMission, primaryAction.progress ?? null);
      return;
    }

    router.push(MISSIONS_ROUTE);
  }, [openMissionBrief, primaryAction.mission, primaryAction.progress, router]);

  return (
    <div className="space-y-6">
      <LaunchpadHero
        primaryAction={primaryAction}
        isLoading={heroIsLoading}
        onPrimaryAction={handleOpenPrimaryAction}
        previewDetailsVisible={false}
      />

      {error && <p className="text-sm text-sg-coral-500">{error}</p>}

      <div className="space-y-6">
        {!searchMode && launchFrontDoor.corePaths.length > 0 ? (
          <LaunchFrontDoorSection
            corePaths={launchFrontDoor.corePaths}
            extendedPaths={launchFrontDoor.extendedPaths}
            progressByPathId={progressMap}
            onOpenMission={openMissionBrief}
          />
        ) : null}

        {inProgressPaths.length > 0 && (
          <section>
            <SectionHeader title="My Missions" />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {inProgressPaths.map(({ path, progress }) => (
                <MissionCard
                  key={path.id}
                  path={path}
                  progress={progress}
                  onOpenMission={openMissionBrief}
                  compact
                  cleanFrame
                />
              ))}
            </div>
          </section>
        )}

        {(searchMode ||
          isInitialMissionLoad ||
          isLoading ||
          visibleDiscoveryPaths.length > 0 ||
          category === "in-progress" ||
          category !== "all") && (
        <section>
          {isInitialMissionLoad ? (
            <>
              <SectionHeaderSkeleton />
              <MissionCardSkeletonGrid count={3} />
            </>
          ) : (
            <>
              <SectionHeader
                title={searchMode ? "Mission Matches" : "Browse Missions"}
                description={
                  searchMode
                    ? "Search stays focused on missions you can actually do next."
                    : "Browse by launch domain when you want to explore the right work for now."
                }
                actions={
                  !searchMode ? (
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <select
                          value={category}
                          onChange={(event) => setCategory(event.target.value)}
                          className={DISCOVERY_SELECT_CLASS_NAME}
                        >
                          {visibleCategories.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={14}
                          strokeWidth={1.5}
                          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-shell-500"
                        />
                      </div>
                      <div className="relative">
                        <select
                          value={sort}
                          onChange={(event) =>
                            setSort(event.target.value as SortOption)
                          }
                          className={DISCOVERY_SELECT_CLASS_NAME}
                        >
                          {SORT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={14}
                          strokeWidth={1.5}
                          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-shell-500"
                        />
                      </div>
                    </div>
                  ) : undefined
                }
              />

              {searchMode ? (
            isSearching && visibleSearchResults.length === 0 ? (
              <MissionCardSkeletonGrid count={2} />
            ) : visibleSearchResults.length > 0 ? (
              <>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {visibleSearchResults.map((path) => (
                    <MissionCard
                      key={path.id}
                      path={path}
                      progress={progressMap.get(path.id) ?? null}
                      onOpenMission={openMissionBrief}
                      compact
                      cleanFrame
                    />
                  ))}
                </div>
                {hiddenSearchResultCount > 0 && (
                  <p className="text-xs text-shell-500">
                    Showing the first 4 mission matches. Refine the search to
                    narrow further.
                  </p>
                )}
              </>
            ) : (
            <EmptySectionState
              title="No matching missions yet"
              description="Try a different workflow query to surface a better mission match."
            />
          )
          ) : isLoading ? (
            <MissionCardSkeletonGrid count={activeMission ? 2 : 3} />
          ) : visibleDiscoveryPaths.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {visibleDiscoveryPaths.map((path) => (
                <MissionCard
                  key={path.id}
                  path={path}
                  progress={progressMap.get(path.id) ?? null}
                  onOpenMission={openMissionBrief}
                  compact
                  cleanFrame
                />
              ))}
            </div>
          ) : category === "in-progress" ? (
            <EmptySectionState
              title="No missions in progress yet"
              description="Start a mission to track visible progress."
            />
          ) : category !== "all" ? (
            <EmptySectionState
              title="No missions found in this launch domain yet"
              description="Try another launch domain to find a better next mission."
            />
          ) : (
            <EmptySectionState
              title="No new missions surfaced yet"
              description="Check another launch domain to surface more missions."
            />
          )}
            </>
          )}
        </section>
        )}
      </div>

      {selectedMissionBrief ? (
        <MissionBriefModal
          key={selectedMissionBrief.path.id}
          isOpen
          onClose={() => setSelectedMissionBrief(null)}
          path={selectedMissionBrief.path}
          progress={selectedMissionBrief.progress}
        />
      ) : null}
    </div>
  );
}

function LaunchFrontDoorSection({
  corePaths,
  extendedPaths,
  progressByPathId,
  onOpenMission,
}: {
  corePaths: LearningPath[];
  extendedPaths: LearningPath[];
  progressByPathId: Map<string, LearningProgress>;
  onOpenMission: (path: LearningPath, progress: LearningProgress | null) => void;
}) {
  return (
    <section className="space-y-5">
      <Card className="p-5 sm:p-6">
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-shell-500">
              Launch Path
            </p>
            <h2 className="text-2xl font-semibold leading-tight text-shell-900">
              Go from better AI thinking to better marketing output to better workflow design.
            </h2>
            <p className="max-w-[50rem] text-sm leading-7 text-shell-500">
              Start with these three missions in order. Each one is built to finish in one session and end in a real artifact you can use next.
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            {CORE_LAUNCH_FRONT_DOOR_STEPS.map((step) => (
              <div
                key={step.laneKey}
                className="rounded-[var(--sg-radius-lg)] border border-[var(--sg-shell-border)] px-4 py-4"
                style={{
                  background:
                    "color-mix(in srgb, var(--sg-white) 80%, var(--sg-shell-50) 20%)",
                }}
              >
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-shell-500">
                    {step.stepLabel}
                  </p>
                  <p className="text-base font-semibold text-shell-900">{step.title}</p>
                  <p className="text-sm leading-6 text-shell-500">{step.supportLine}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <section>
        <SectionHeader
          title="Core launch path"
          description="Start here. These three missions are intentionally sequenced to sharpen how marketers think, write, and design workflows with AI."
        />
        <div className="grid gap-5 lg:grid-cols-3">
          {corePaths.map((path) => {
            const laneKey = getLaunchMissionLaneKey(path);
            const step = CORE_LAUNCH_FRONT_DOOR_STEPS.find(
              (candidate) => candidate.laneKey === laneKey,
            );

            return (
              <div key={path.id} className="space-y-2">
                {step ? (
                  <div className="space-y-0.5 px-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-shell-500">
                      {step.stepLabel}
                    </p>
                    <p className="text-sm text-shell-500">{step.title}</p>
                  </div>
                ) : null}

                <MissionCard
                  path={path}
                  progress={progressByPathId.get(path.id) ?? null}
                  onOpenMission={onOpenMission}
                  compact
                  cleanFrame
                />
              </div>
            );
          })}
        </div>
      </section>

      {extendedPaths.length > 0 ? (
        <section>
          <SectionHeader
            title="Optional depth"
            description="Go deeper when you want narrower or more technical reps. These strengthen the launch story, but they are not the front-door path."
          />
          <div className="grid gap-5 sm:grid-cols-2">
            {extendedPaths.map((path) => (
              <MissionCard
                key={path.id}
                path={path}
                progress={progressByPathId.get(path.id) ?? null}
                onOpenMission={onOpenMission}
                compact
                cleanFrame
              />
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}

function SectionHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  if (!description) {
    return (
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-shell-900">{title}</h2>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div
        className={`flex justify-between gap-4 ${description ? "items-start" : "items-center"}`}
      >
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-shell-900">{title}</h2>
          {description ? (
            <p className="text-sm text-shell-500">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </div>
  );
}

function EmptySectionState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="p-5">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-shell-900">{title}</h3>
        <p className="text-sm leading-6 text-shell-500">{description}</p>
      </div>
    </Card>
  );
}

function SectionHeaderSkeleton() {
  return (
    <div className="mb-6 space-y-3">
      <div
        className="h-8 w-56 animate-pulse rounded-full"
        style={{ background: "var(--sg-shell-200)" }}
      />
      <div
        className="h-4 w-[22rem] max-w-full animate-pulse rounded-full"
        style={{ background: "var(--sg-shell-100)" }}
      />
    </div>
  );
}

function MissionCardSkeletonGrid({ count }: { count: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <PathCardSkeleton key={index} />
      ))}
    </div>
  );
}
