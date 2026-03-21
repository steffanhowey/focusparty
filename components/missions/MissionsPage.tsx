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
  getMissionRoute,
} from "@/lib/appRoutes";
import { MissionCard } from "@/components/missions/MissionCard";
import { MissionRoomPickerModal } from "@/components/missions/MissionRoomPickerModal";
import { buildHomePrimaryAction } from "@/lib/homeLaunchpad";
import { buildMissionRecommendations } from "@/lib/missionRecommendations";
import {
  getMissionLaunchDomain,
  LAUNCH_DOMAIN_OPTIONS,
} from "@/lib/launchTaxonomy";
import { useMissionRecommendations } from "@/lib/useMissionRecommendations";
import type { LearningPath, LearningProgress } from "@/lib/types";

interface CategoryDef {
  value: string;
  label: string;
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
  const [showHeroRoomPicker, setShowHeroRoomPicker] = useState(false);

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
    activeMission?.path.id,
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
  const sortedDiscoveryPaths = useMemo(() => {
    const paths = [...filteredDiscoveryPaths];

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
  }, [filteredDiscoveryPaths, sort]);
  const visibleDiscoveryPaths = sortedDiscoveryPaths;
  const handleOpenPrimaryAction = useCallback(() => {
    const heroMission = primaryAction.mission;

    if (heroMission) {
      router.push(getMissionRoute(heroMission.id));
      return;
    }

    router.push(MISSIONS_ROUTE);
  }, [primaryAction.mission, router]);
  const handleOpenHeroRoomPicker = useCallback(() => {
    if (!primaryAction.mission) return;
    setShowHeroRoomPicker(true);
  }, [primaryAction.mission]);

  return (
    <div className="space-y-6">
      <LaunchpadHero
        primaryAction={primaryAction}
        isLoading={heroIsLoading}
        onPrimaryAction={handleOpenPrimaryAction}
        onRoomAction={primaryAction.mission ? handleOpenHeroRoomPicker : undefined}
        previewDetailsVisible={false}
      />

      {error && <p className="text-sm text-sg-coral-500">{error}</p>}

      <div className="space-y-6">
        {inProgressPaths.length > 0 && (
          <section>
            <SectionHeader title="My Missions" />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {inProgressPaths.map(({ path, progress }) => (
                <MissionCard
                  key={path.id}
                  path={path}
                  progress={progress}
                  compact
                  cleanFrame
                />
              ))}
            </div>
          </section>
        )}

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
                <MissionCard key={path.id} path={path} compact cleanFrame />
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
      </div>

      {primaryAction.mission && showHeroRoomPicker ? (
        <MissionRoomPickerModal
          isOpen={showHeroRoomPicker}
          onClose={() => setShowHeroRoomPicker(false)}
          path={primaryAction.mission}
          progress={primaryAction.progress ?? null}
        />
      ) : null}
    </div>
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
