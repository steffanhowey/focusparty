"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Search, ChevronDown } from "lucide-react";
import { useLearnSearch } from "@/lib/useLearnSearch";
import { PathCard } from "./PathCard";
import { PathCardSkeletonGrid } from "./PathCardSkeleton";
import { TopicFilters } from "./TopicFilters";
import { GenerationCard } from "./GenerationCard";
import type { LearningPath, LearningProgress } from "@/lib/types";

// Popular topics shown as quick-search triggers in the hero
const POPULAR_TOPICS = [
  "prompt-engineering",
  "rag",
  "ai-agents",
  "fine-tuning",
  "nextjs",
  "react",
  "vector-databases",
  "langchain",
  "cursor",
  "supabase",
  "openai-api",
  "system-design",
];

// ─── Category filter ─────────────────────────────────────────
// Maps high-level professional categories to the topic slugs that
// belong to each. A path matches a category if any of its topics
// overlap with that category's topic set.

interface CategoryDef {
  value: string;
  label: string;
  /** Topic slugs that belong to this category. Empty = matches all. */
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

// Build a fast lookup: topic slug → category values
const TOPIC_TO_CATEGORIES = new Map<string, Set<string>>();
for (const cat of CATEGORIES) {
  for (const t of cat.topics) {
    if (!TOPIC_TO_CATEGORIES.has(t)) TOPIC_TO_CATEGORIES.set(t, new Set());
    TOPIC_TO_CATEGORIES.get(t)!.add(cat.value);
  }
}

function pathMatchesCategory(path: LearningPath, categoryValue: string): boolean {
  if (categoryValue === "all") return true;
  // Check if any of the path's topics belong to this category
  return path.topics.some((t) => {
    const cats = TOPIC_TO_CATEGORIES.get(t);
    return cats?.has(categoryValue);
  });
}

// ─── Sort ────────────────────────────────────────────────────

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

const DIFFICULTY_ORDER: Record<string, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

// ─── Component ───────────────────────────────────────────────

/**
 * Main Learn page component.
 * Every card is a learning path. Clicking navigates to the learning environment.
 */
export function LearnPage() {
  const router = useRouter();
  const {
    query,
    setQuery,
    discoveryPaths,
    inProgressPaths,
    isLoading,
    error,
    message,
    hasSearched,
    setQueryFromTopic,
    generationStatus,
    retryGeneration,
  } = useLearnSearch();

  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<SortOption>("recommended");

  // Build a progress lookup map from in-progress paths
  const progressMap = useMemo(() => {
    const map = new Map<string, LearningProgress>();
    for (const { path, progress } of inProgressPaths) {
      map.set(path.id, progress);
    }
    return map;
  }, [inProgressPaths]);

  // Merge in-progress paths into the grid (deduplicated, in-progress first)
  const allPaths = useMemo(() => {
    const inProgressIds = new Set(inProgressPaths.map(({ path }) => path.id));
    const inProgressPathObjs = inProgressPaths.map(({ path }) => path);
    const otherPaths = discoveryPaths.filter((p) => !inProgressIds.has(p.id));
    return [...inProgressPathObjs, ...otherPaths];
  }, [discoveryPaths, inProgressPaths]);

  // Apply category filter
  const filteredPaths = useMemo(() => {
    if (category === "all") return allPaths;
    if (category === "in-progress") return allPaths.filter((p) => progressMap.has(p.id));
    return allPaths.filter((p) => pathMatchesCategory(p, category));
  }, [allPaths, category, progressMap]);

  // Apply sort
  const sortedPaths = useMemo(() => {
    const paths = [...filteredPaths];

    switch (sort) {
      case "newest":
        return paths.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      case "popular":
        return paths.sort((a, b) => (b.start_count ?? 0) - (a.start_count ?? 0));
      case "shortest":
        return paths.sort(
          (a, b) => a.estimated_duration_seconds - b.estimated_duration_seconds
        );
      case "longest":
        return paths.sort(
          (a, b) => b.estimated_duration_seconds - a.estimated_duration_seconds
        );
      case "beginner-first":
        return paths.sort(
          (a, b) =>
            (DIFFICULTY_ORDER[a.difficulty_level] ?? 1) -
            (DIFFICULTY_ORDER[b.difficulty_level] ?? 1)
        );
      case "advanced-first":
        return paths.sort(
          (a, b) =>
            (DIFFICULTY_ORDER[b.difficulty_level] ?? 1) -
            (DIFFICULTY_ORDER[a.difficulty_level] ?? 1)
        );
      case "recommended":
      default:
        return paths;
    }
  }, [filteredPaths, sort]);

  const handleCardClick = useCallback(
    (pathId: string) => {
      router.push(`/learn/paths/${pathId}`);
    },
    [router]
  );

  // Only show "In Progress" category when user has started paths
  const visibleCategories = useMemo(
    () =>
      CATEGORIES.filter(
        (c) => c.value !== "in-progress" || inProgressPaths.length > 0
      ),
    [inProgressPaths.length]
  );

  return (
    <div className="space-y-5 md:space-y-8">
      {/* Hero card — matches FeaturedRoom e-spot pattern */}
      <section
        className="relative flex w-full items-center justify-center overflow-hidden rounded-md border border-[var(--color-border-default)]"
        style={{ height: "clamp(340px, 50vh, 500px)" }}
      >
        {/* Background image */}
        <Image
          src="https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=1600&q=80"
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
        {/* Dark overlay for text readability */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "rgba(0,0,0,0.65)" }}
        />

        <div className="relative w-full space-y-4 px-4 md:space-y-6 md:px-10">
          {/* Title + subtitle */}
          <div className="text-center space-y-2 md:space-y-3">
            <h1 className="text-2xl font-bold text-white md:text-4xl">
              What do you want to learn?
            </h1>
            <p className="text-xs text-white/50 md:text-base">
              AI-curated learning paths from the best creators across the internet
            </p>
          </div>

          {/* Search Input */}
          <div className="relative max-w-2xl mx-auto">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search topics, skills, or keywords..."
              className="w-full pl-11 pr-4 py-2.5 md:py-3 rounded-xl text-sm border text-white placeholder:text-white/30 focus:outline-none focus:border-[var(--color-border-focus)] transition-colors"
              style={{
                background: "rgba(255,255,255,0.06)",
                borderColor: "rgba(255,255,255,0.1)",
              }}
            />
            {isLoading && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Topic Quick Filters */}
          <div className="max-w-2xl mx-auto">
            <TopicFilters
              topics={POPULAR_TOPICS}
              selected={[]}
              onToggle={setQueryFromTopic}
            />
          </div>
        </div>
      </section>

      {/* Error */}
      {error && (
        <p className="text-center text-sm text-[var(--color-coral-700)]">
          {error}
        </p>
      )}

      {/* Section header: title left, category + sort right — matches Practice page */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
          {hasSearched && !isLoading
            ? `${sortedPaths.length} path${sortedPaths.length !== 1 ? "s" : ""}`
            : "Learning Paths"}
        </h2>
        <div className="flex items-center gap-2">
          {hasSearched && !isLoading && query && (
            <span className="hidden text-sm text-[var(--color-text-tertiary)] sm:inline">
              &ldquo;{query}&rdquo;
              {generationStatus === "generating" && " · generating..."}
            </span>
          )}
          {/* Category dropdown */}
          <div className="relative">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="cursor-pointer appearance-none rounded-full border border-[var(--color-border-default)] bg-white/[0.06] px-4 py-2 pr-8 text-sm text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-focus)] focus:border-[var(--color-border-focus)] focus:outline-none"
            >
              {visibleCategories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              strokeWidth={1.5}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]"
            />
          </div>
          {/* Sort dropdown */}
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="cursor-pointer appearance-none rounded-full border border-[var(--color-border-default)] bg-white/[0.06] px-4 py-2 pr-8 text-sm text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-focus)] focus:border-[var(--color-border-focus)] focus:outline-none"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              strokeWidth={1.5}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]"
            />
          </div>
        </div>
      </div>

      {/* Results Grid */}
      {isLoading ? (
        <PathCardSkeletonGrid count={6} />
      ) : sortedPaths.length > 0 ||
        generationStatus === "generating" ||
        generationStatus === "failed" ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sortedPaths.map((path) => (
            <PathCard
              key={path.id}
              path={path}
              progress={progressMap.get(path.id) ?? null}
              onClick={handleCardClick}
            />
          ))}
          {(generationStatus === "generating" ||
            generationStatus === "failed") && (
            <GenerationCard
              status={generationStatus}
              query={query}
              onRetry={retryGeneration}
            />
          )}
        </div>
      ) : hasSearched ? (
        <div className="text-center py-16 space-y-2">
          <Search
            size={32}
            className="mx-auto text-[var(--color-text-tertiary)] opacity-40"
          />
          <p className="text-sm text-[var(--color-text-tertiary)]">
            {message ??
              "No learning paths found. Try a broader search or different topic."}
          </p>
        </div>
      ) : category === "in-progress" ? (
        <div className="text-center py-16 space-y-2">
          <p className="text-sm text-[var(--color-text-tertiary)]">
            No paths in progress yet. Start a learning path to track your progress.
          </p>
        </div>
      ) : category !== "all" ? (
        <div className="text-center py-16 space-y-2">
          <p className="text-sm text-[var(--color-text-tertiary)]">
            No paths found in this category yet. Try searching for a specific topic.
          </p>
        </div>
      ) : (
        <div className="text-center py-16 space-y-2">
          <p className="text-sm text-[var(--color-text-tertiary)]">
            Loading learning paths...
          </p>
        </div>
      )}
    </div>
  );
}
