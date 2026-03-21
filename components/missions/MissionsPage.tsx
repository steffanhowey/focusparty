"use client";

import type { ChangeEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { SearchDropdown } from "@/components/learn/SearchDropdown";
import { PathCardSkeleton } from "@/components/learn/PathCardSkeleton";
import { useLearnSearch } from "@/lib/useLearnSearch";
import { usePathGeneration } from "@/lib/usePathGeneration";
import { useSkillProfile } from "@/lib/useSkillProfile";
import { getMissionRoute } from "@/lib/appRoutes";
import { MissionCard } from "@/components/missions/MissionCard";
import { getWorldConfig } from "@/lib/worlds";
import type { LearningPath, LearningProgress } from "@/lib/types";

const POPULAR_TOPICS = [
  "prompt engineering",
  "ai agents",
  "cursor",
  "rag",
  "sql",
  "automation",
] as const;

interface CategoryDef {
  value: string;
  label: string;
  topics: string[];
}

const CATEGORIES: CategoryDef[] = [
  { value: "all", label: "All Categories", topics: [] },
  { value: "in-progress", label: "In Progress", topics: [] },
  {
    value: "ai-fundamentals",
    label: "AI Fundamentals",
    topics: [
      "prompt-engineering",
      "ai-models",
      "llm",
      "machine-learning",
      "deep-learning",
      "neural-networks",
      "transformers",
      "embeddings",
      "fine-tuning",
      "ai-safety",
      "ai-ethics",
    ],
  },
  {
    value: "engineering",
    label: "Engineering",
    topics: [
      "ai-coding",
      "cursor",
      "copilot",
      "github-copilot",
      "nextjs",
      "react",
      "typescript",
      "python",
      "javascript",
      "system-design",
      "web-development",
      "full-stack",
      "backend",
      "frontend",
      "devops",
      "testing",
      "apis",
    ],
  },
  {
    value: "data",
    label: "Data & Analytics",
    topics: [
      "rag",
      "vector-databases",
      "supabase",
      "postgresql",
      "sql",
      "data-science",
      "data-engineering",
      "analytics",
      "visualization",
      "pandas",
      "jupyter",
    ],
  },
  {
    value: "agents-automation",
    label: "Agents & Automation",
    topics: [
      "ai-agents",
      "langchain",
      "langgraph",
      "crewai",
      "autogen",
      "n8n",
      "zapier",
      "make",
      "automation",
      "workflows",
      "mcp",
      "function-calling",
      "tool-use",
    ],
  },
  {
    value: "tools",
    label: "Tools & Platforms",
    topics: [
      "openai-api",
      "claude",
      "anthropic",
      "chatgpt",
      "midjourney",
      "v0",
      "bolt",
      "replit",
      "vercel",
      "figma",
      "notion",
      "perplexity",
    ],
  },
  {
    value: "product-design",
    label: "Product & Design",
    topics: [
      "product-management",
      "ux-design",
      "ui-design",
      "prototyping",
      "design-systems",
      "user-research",
      "ai-design",
    ],
  },
  {
    value: "marketing",
    label: "Marketing & Content",
    topics: [
      "content-strategy",
      "seo",
      "copywriting",
      "social-media",
      "email-marketing",
      "ai-writing",
      "content-creation",
      "branding",
    ],
  },
];

const TOPIC_TO_CATEGORIES = new Map<string, Set<string>>();
for (const category of CATEGORIES) {
  for (const topic of category.topics) {
    if (!TOPIC_TO_CATEGORIES.has(topic)) {
      TOPIC_TO_CATEGORIES.set(topic, new Set());
    }
    TOPIC_TO_CATEGORIES.get(topic)?.add(category.value);
  }
}

function pathMatchesCategory(path: LearningPath, categoryValue: string): boolean {
  if (categoryValue === "all") return true;
  return path.topics.some((topic) => TOPIC_TO_CATEGORIES.get(topic)?.has(categoryValue));
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

  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<SortOption>("recommended");
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

  const allPaths = useMemo(() => {
    const inProgressIds = new Set(inProgressPaths.map(({ path }) => path.id));
    const activePaths = inProgressPaths.map(({ path }) => path);
    const otherPaths = discoveryPaths.filter((path) => !inProgressIds.has(path.id));
    return [...activePaths, ...otherPaths];
  }, [discoveryPaths, inProgressPaths]);

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
  const visibleCategories = useMemo(
    () => CATEGORIES.filter((option) => option.value !== "in-progress" || inProgressPaths.length > 0),
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
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
      case "popular":
        return paths.sort((a, b) => (b.start_count ?? 0) - (a.start_count ?? 0));
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
        {inProgressPaths.length > 0 && (
          <section>
            <SectionHeader
              title="My Missions"
            />
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
          <SectionHeader
            title={searchMode ? "Mission Matches" : activeMission ? "Discovery What's Next" : "Start A Mission"}
            description={searchMode
              ? "A short set of relevant matches, without turning search into a long list."
              : activeMission
                ? undefined
                : "Clear starts you can pick up quickly and carry into a room when you want momentum."}
            actions={!searchMode ? (
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
                    onChange={(event) => setSort(event.target.value as SortOption)}
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
            ) : undefined}
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
          ) : sortedDiscoveryPaths.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {sortedDiscoveryPaths.map((path) => (
                <MissionCard
                  key={path.id}
                  path={path}
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
              title="No missions found in this category yet"
              description="Try another category or search for a specific workflow."
            />
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
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  if (!description) {
    return (
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-shell-900">
          {title}
        </h2>
        {actions ? (
          <div className="shrink-0">
            {actions}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className={`flex justify-between gap-4 ${description ? "items-start" : "items-center"}`}>
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-shell-900">
            {title}
          </h2>
          {description ? (
            <p className="text-sm text-shell-500">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="shrink-0">
            {actions}
          </div>
        ) : null}
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
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <PathCardSkeleton key={index} />
      ))}
    </div>
  );
}
