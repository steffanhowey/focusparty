"use client";

import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { SearchDropdown } from "@/components/learn/SearchDropdown";
import { PathCardSkeleton } from "@/components/learn/PathCardSkeleton";
import { useLearnSearch } from "@/lib/useLearnSearch";
import { usePathGeneration } from "@/lib/usePathGeneration";
import { useSkillProfile } from "@/lib/useSkillProfile";
import { getMissionRoute } from "@/lib/appRoutes";
import { MissionCard } from "@/components/missions/MissionCard";
import { getWorldConfig } from "@/lib/worlds";
import type { LearningProgress } from "@/lib/types";

const POPULAR_TOPICS = [
  "prompt engineering",
  "ai agents",
  "cursor",
  "rag",
  "sql",
  "automation",
] as const;

export function MissionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const heroWorld = getWorldConfig("vibe-coding");
  const {
    query,
    setQuery,
    discoveryPaths,
    inProgressPaths,
    isLoading,
    searchResults,
    isSearching,
    shouldOfferGeneration,
    error,
    setQueryFromTopic,
  } = useLearnSearch();
  const generation = usePathGeneration();
  const { achievements } = useSkillProfile();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigatedGeneratedPathRef = useRef<string | null>(null);

  useEffect(() => {
    const initialQuery = searchParams.get("q")?.trim();
    if (!initialQuery || initialQuery === query) return;

    const timeoutId = window.setTimeout(() => {
      setQuery(initialQuery);
      setIsDropdownOpen(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [query, searchParams, setQuery]);

  useEffect(() => {
    if (generation.status !== "complete" || !generation.generatedPath) return;
    if (navigatedGeneratedPathRef.current === generation.generatedPath.id) return;

    navigatedGeneratedPathRef.current = generation.generatedPath.id;
    router.push(getMissionRoute(generation.generatedPath.id));
  }, [generation.generatedPath, generation.status, router]);

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
    () => new Set(inProgressPaths.map((mission) => mission.path.id)),
    [inProgressPaths],
  );

  const recommendedPaths = useMemo(() => {
    const eligiblePaths = discoveryPaths.filter(
      (path) => !activePathIds.has(path.id) && !completedPathIds.has(path.id),
    );
    return eligiblePaths.slice(0, 4);
  }, [activePathIds, completedPathIds, discoveryPaths]);

  const activeMission = inProgressPaths[0] ?? null;
  const searchMode = query.trim().length > 0;
  const filteredSearchResults = useMemo(
    () =>
      searchResults.filter((path) => {
        const progress = progressMap.get(path.id);
        return progress?.status !== "completed" && !completedPathIds.has(path.id);
      }),
    [completedPathIds, progressMap, searchResults],
  );
  const visibleSearchResults = filteredSearchResults.slice(0, 4);
  const hiddenSearchResultCount = Math.max(
    filteredSearchResults.length - visibleSearchResults.length,
    0,
  );

  const handleSelectPath = useCallback(
    (pathId: string) => {
      setIsDropdownOpen(false);
      router.push(getMissionRoute(pathId));
    },
    [router],
  );

  const handleInputFocus = useCallback(() => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    if (query.trim()) setIsDropdownOpen(true);
  }, [query]);

  const handleInputBlur = useCallback(() => {
    blurTimeoutRef.current = setTimeout(() => {
      setIsDropdownOpen(false);
    }, 200);
  }, []);

  const handleQueryChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      setQuery(nextValue);
      setIsDropdownOpen(nextValue.trim().length > 0);
    },
    [setQuery],
  );

  const handleTopicClick = useCallback(
    (topic: string) => {
      setQueryFromTopic(topic.replace(/\s+/g, "-"));
      setIsDropdownOpen(true);
      inputRef.current?.focus();
    },
    [setQueryFromTopic],
  );

  const handleStartGeneration = useCallback(
    (nextQuery: string) => {
      setIsDropdownOpen(true);
      generation.generate(nextQuery);
    },
    [generation],
  );

  const showDropdown =
    query.trim().length > 0 &&
    (isDropdownOpen ||
      generation.status === "generating" ||
      generation.status === "failed");

  return (
    <div className="space-y-6">
      <section
        className="relative grid overflow-hidden rounded-md px-6 py-6 md:px-8 md:py-8"
        style={{ minHeight: "clamp(340px, 50vh, 500px)" }}
      >
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute inset-0"
            style={{ background: heroWorld.placeholderGradient }}
          />
          {heroWorld.placeholderPattern ? (
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: heroWorld.placeholderPattern,
                backgroundSize: "16px 16px",
              }}
            />
          ) : null}
          <div
            className="absolute inset-0"
            style={{ background: heroWorld.environmentOverlay }}
          />
          <div
            className="absolute -right-12 top-0 h-48 w-48 rounded-full opacity-20 blur-3xl"
            style={{ background: "var(--sg-teal-300)" }}
          />
        </div>

        <div className="relative my-auto flex w-full flex-col items-center justify-center gap-5 text-center">
          <div className="max-w-3xl space-y-2">
            <h1 className="text-3xl font-semibold leading-tight text-white sm:text-[2.35rem]">
              What do you want to learn?
            </h1>
            <p className="mx-auto max-w-2xl text-sm leading-6 text-white/72 sm:text-base">
              Search by workflow, skill, or output, then keep the rest of the page focused on the work that matters now.
            </p>
          </div>

          <div className="w-full max-w-3xl space-y-3">
            <div className="relative mx-auto w-full">
              <Search
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-shell-500"
              />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleQueryChange}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                placeholder="Search by workflow, skill, or expected output"
                className="w-full rounded-[var(--sg-radius-lg)] border border-shell-border bg-white py-3 pl-11 pr-4 text-sm text-shell-900 outline-none transition-colors focus:border-forest-400"
              />

              {showDropdown && (
                <SearchDropdown
                  query={query}
                  results={searchResults}
                  isSearching={isSearching}
                  shouldOfferGeneration={shouldOfferGeneration}
                generation={generation}
                onSelectPath={handleSelectPath}
                onStartGeneration={handleStartGeneration}
                onClose={() => setIsDropdownOpen(false)}
              />
            )}
            </div>

            {(generation.status === "generating" || generation.status === "failed") && (
              <p
                className={`text-center text-xs ${
                  generation.status === "failed" ? "text-sg-coral-500" : "text-forest-600"
                }`}
              >
                {generation.status === "failed"
                  ? "Could not build that mission just yet."
                  : "Building a custom mission now."}
              </p>
            )}

            <div className="flex flex-wrap justify-center gap-2">
              {POPULAR_TOPICS.map((topic) => {
                const isActive = query.trim().toLowerCase() === topic.toLowerCase();

                return (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => handleTopicClick(topic)}
                    className="inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
                    style={{
                      background: isActive ? "var(--sg-forest-500)" : "var(--sg-shell-white)",
                      borderColor: isActive ? "var(--sg-forest-500)" : "var(--sg-shell-border)",
                      color: isActive ? "var(--sg-shell-white)" : "var(--sg-shell-600)",
                    }}
                  >
                    {topic}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {error && (
        <p className="text-sm text-sg-coral-500">
          {error}
        </p>
      )}

      <div className="space-y-6">
        {activeMission && (
          <section className="space-y-3">
            <SectionHeader
              title="Active Mission"
              description="The work already in motion stays at the top of the page."
            />
            <MissionCard
              path={activeMission.path}
              progress={activeMission.progress}
              featured
            />
          </section>
        )}

        <section className="space-y-3">
          <SectionHeader
            title={searchMode ? "Mission Matches" : activeMission ? "Recommended Next" : "Start A Mission"}
            description={
              searchMode
                ? "A short set of relevant matches, without turning search into a long list."
                : "Clear starts you can pick up quickly and carry into a room when you want momentum."
            }
          />

          {searchMode ? (
            isSearching && visibleSearchResults.length === 0 ? (
              <MissionCardSkeletonGrid count={2} />
            ) : visibleSearchResults.length > 0 ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {visibleSearchResults.map((path) => (
                    <MissionCard
                      key={path.id}
                      path={path}
                      progress={progressMap.get(path.id) ?? null}
                      compact
                    />
                  ))}
                </div>
                {hiddenSearchResultCount > 0 && (
                  <p className="text-xs text-shell-500">
                    Showing the first 4 mission matches. Refine the search to narrow further.
                  </p>
                )}
              </>
            ) : (
              <EmptySectionState
                title="No matching missions yet"
                description="Try a different workflow, or use the Build Mission option in the search dropdown."
              />
            )
          ) : isLoading ? (
            <MissionCardSkeletonGrid count={activeMission ? 2 : 3} />
          ) : recommendedPaths.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recommendedPaths.map((path) => (
                <MissionCard
                  key={path.id}
                  path={path}
                  compact
                />
              ))}
            </div>
          ) : (
            <EmptySectionState
              title="No new missions surfaced yet"
              description="Search for a workflow above to find or build a mission."
            />
          )}
        </section>

      </div>
    </div>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-1">
      <h2 className="text-lg font-semibold text-shell-900">
        {title}
      </h2>
      <p className="text-sm text-shell-500">
        {description}
      </p>
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
        <h3 className="text-lg font-semibold text-shell-900">
          {title}
        </h3>
        <p className="text-sm leading-6 text-shell-500">
          {description}
        </p>
      </div>
    </Card>
  );
}

function MissionCardSkeletonGrid({ count }: { count: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <PathCardSkeleton key={index} />
      ))}
    </div>
  );
}
