"use client";

import type { ChangeEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, PanelsTopLeft, Search, Target } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { SearchDropdown } from "@/components/learn/SearchDropdown";
import { useGoals } from "@/lib/useGoals";
import { useLearnSearch } from "@/lib/useLearnSearch";
import { usePathGeneration } from "@/lib/usePathGeneration";
import { useSkillProfile } from "@/lib/useSkillProfile";
import { getMissionRoute } from "@/lib/appRoutes";
import { MissionCard } from "@/components/missions/MissionCard";
import { MyQueueBoard } from "@/components/missions/MyQueueBoard";
import type { LearningPath, LearningProgress } from "@/lib/types";

const POPULAR_TOPICS = [
  "prompt engineering",
  "ai agents",
  "cursor",
  "rag",
  "sql",
  "figma",
  "nextjs",
  "automation",
] as const;

/**
 * Mission-first work center that prioritizes active work, relevant starts, and
 * a lightweight queue without changing the underlying learning or room systems.
 */
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
    shouldOfferGeneration,
    error,
    setQueryFromTopic,
  } = useLearnSearch();
  const generation = usePathGeneration();
  const { goals, createGoal, updateGoal, archiveGoal } = useGoals();
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

  const savedPathIds = useMemo(
    () =>
      new Set(
        goals
          .filter((goal) => goal.linked_path_id && goal.status !== "archived")
          .map((goal) => goal.linked_path_id as string),
      ),
    [goals],
  );

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
    const unsavedPaths = eligiblePaths.filter((path) => !savedPathIds.has(path.id));
    const savedBackfill = eligiblePaths.filter((path) => savedPathIds.has(path.id));

    return [...unsavedPaths, ...savedBackfill].slice(0, 6);
  }, [activePathIds, completedPathIds, discoveryPaths, savedPathIds]);

  const activeMission = inProgressPaths[0] ?? null;
  const searchMode = query.trim().length > 0;
  const visibleSearchResults = useMemo(
    () =>
      searchResults.filter((path) => {
        const progress = progressMap.get(path.id);
        return progress?.status !== "completed" && !completedPathIds.has(path.id);
      }),
    [completedPathIds, progressMap, searchResults],
  );

  const handleSelectPath = useCallback(
    (pathId: string) => {
      setIsDropdownOpen(false);
      router.push(getMissionRoute(pathId));
    },
    [router],
  );

  const handleToggleSave = useCallback(
    async (path: LearningPath) => {
      const existingGoal = goals.find((goal) => goal.linked_path_id === path.id);

      if (existingGoal && existingGoal.status !== "archived") {
        await archiveGoal(existingGoal.id);
        return;
      }

      if (existingGoal) {
        await updateGoal(existingGoal.id, {
          status: "active",
          title: path.title,
          linked_path_id: path.id,
        });
        return;
      }

      await createGoal({
        title: path.title,
        linked_path_id: path.id,
      });
    },
    [archiveGoal, createGoal, goals, updateGoal],
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
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[var(--sg-radius-xl)] border border-shell-border bg-cream-50 px-5 py-6 sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute inset-y-0 right-0 w-2/3"
            style={{
              background:
                "radial-gradient(circle at top right, var(--sg-sage-100) 0%, transparent 62%)",
            }}
          />
          <div
            className="absolute -left-8 top-2 h-40 w-40 rounded-full blur-3xl"
            style={{ background: "var(--sg-forest-100)" }}
          />
          <div
            className="absolute bottom-0 right-12 h-48 w-48 rounded-full blur-3xl"
            style={{ background: "var(--sg-teal-100)" }}
          />
        </div>

        <div className="relative space-y-6">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center rounded-full border border-forest-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-forest-600">
              Missions
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold leading-tight text-shell-900 sm:text-[2.5rem]">
                Pick up meaningful work.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-shell-600 sm:text-base">
                Start a structured rep, resume what is already in motion, and bring an active mission into a room when you want shared momentum.
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr),auto] lg:items-end">
            <div className="space-y-3">
              <div className="relative">
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
                    savedPathIds={savedPathIds}
                    onToggleSave={handleToggleSave}
                  />
                )}
              </div>

              <p className="text-xs text-shell-500">
                Search for the work you want to do now, or build a custom mission from the dropdown.
              </p>

              {generation.status === "generating" && (
                <p className="text-xs text-forest-600">
                  Building a custom mission now.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <SummaryPill
                icon={<Target size={13} />}
                label="Structured work"
              />
              <SummaryPill
                icon={<CheckCircle2 size={13} />}
                label="Output-oriented"
              />
              <SummaryPill
                icon={<PanelsTopLeft size={13} />}
                label="Room-compatible"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
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
      </section>

      {error && (
        <p className="text-sm text-sg-coral-500">
          {error}
        </p>
      )}

      {searchMode ? (
        <section className="space-y-4">
          <SectionHeader
            title="Search Results"
            description="Mission matches based on the work you want to do right now."
          />

          {isSearching && visibleSearchResults.length === 0 ? (
            <MissionCardSkeletonGrid count={3} />
          ) : visibleSearchResults.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {visibleSearchResults.map((path) => (
                <MissionCard
                  key={path.id}
                  path={path}
                  progress={progressMap.get(path.id) ?? null}
                  isSaved={savedPathIds.has(path.id)}
                  onToggleSave={handleToggleSave}
                />
              ))}
            </div>
          ) : (
            <EmptySectionState
              title="No matching missions yet"
              description="Try a different workflow or use the Build Mission option in the search dropdown."
            />
          )}
        </section>
      ) : (
        <>
          {activeMission && (
            <section className="space-y-4">
              <SectionHeader
                title="Active Mission"
                description="Pick up the work that is already in motion before you browse for something new."
              />
              <MissionCard
                path={activeMission.path}
                progress={activeMission.progress}
                isSaved={savedPathIds.has(activeMission.path.id)}
                featured
              />
              {inProgressPaths.length > 1 && (
                <p className="text-sm text-shell-500">
                  +{inProgressPaths.length - 1} more active mission{inProgressPaths.length > 2 ? "s" : ""} waiting in My Queue.
                </p>
              )}
            </section>
          )}

          <section className="space-y-4">
            <SectionHeader
              title={activeMission ? "Recommended Next" : "Start A Mission"}
              description="Meaningful reps you can start quickly and carry into a room when you want shared momentum."
            />

            {isLoading ? (
              <MissionCardSkeletonGrid count={activeMission ? 4 : 6} />
            ) : recommendedPaths.length > 0 ? (
              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {recommendedPaths.map((path) => (
                  <MissionCard
                    key={path.id}
                    path={path}
                    isSaved={savedPathIds.has(path.id)}
                    onToggleSave={handleToggleSave}
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

          <MyQueueBoard
            availablePaths={discoveryPaths}
            activeMissions={inProgressPaths}
            completedEvidence={achievements}
          />
        </>
      )}
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
      <h2 className="text-2xl font-semibold text-shell-900">
        {title}
      </h2>
      <p className="text-sm text-shell-500">
        {description}
      </p>
    </div>
  );
}

function SummaryPill({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-shell-border bg-white px-3 py-1.5 text-xs font-medium text-shell-600">
      {icon}
      {label}
    </span>
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
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} className="animate-pulse p-5">
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="h-6 w-20 rounded-full bg-shell-100" />
              <div className="h-6 w-24 rounded-full bg-shell-100" />
            </div>
            <div className="space-y-2">
              <div className="h-7 w-2/3 rounded bg-shell-100" />
              <div className="h-4 w-full rounded bg-shell-100" />
              <div className="h-4 w-4/5 rounded bg-shell-100" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="h-20 rounded-[var(--sg-radius-lg)] bg-shell-50" />
              <div className="h-20 rounded-[var(--sg-radius-lg)] bg-shell-50" />
            </div>
            <div className="h-px bg-shell-100" />
            <div className="flex justify-end">
              <div className="h-9 w-24 rounded-[var(--sg-radius-btn)] bg-shell-100" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
