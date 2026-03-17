"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import { Search, ChevronDown, Loader2, X, TrendingUp } from "lucide-react";
import { useLearnSearch } from "@/lib/useLearnSearch";
import { usePathGeneration, GENERATION_STEPS } from "@/lib/usePathGeneration";
import type { UsePathGenerationReturn } from "@/lib/usePathGeneration";
import { useSkillRecommendations } from "@/lib/useSkillRecommendations";
import { useSkillMarketState } from "@/lib/useSkillMarketState";
import { PathCard } from "./PathCard";
import { PathCardSkeletonGrid } from "./PathCardSkeleton";
import { TopicFilters } from "./TopicFilters";
import { SearchDropdown } from "./SearchDropdown";
import { SkillRecommendations } from "./SkillRecommendations";
import { WeeklyDigestCard } from "./WeeklyDigestCard";
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
 * Search dropdown overlays the hero for instant results + explicit Build Path.
 * Discovery grid below shows popular/recent paths (unchanged by search).
 */
export function LearnPage() {
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
  const { recommendations } = useSkillRecommendations();
  const { trending } = useSkillMarketState();

  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<SortOption>("recommended");
  const [skillFilter, setSkillFilter] = useState<{ slug: string; name: string } | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const [generationQuery, setGenerationQuery] = useState("");

  // Navigation is now handled inside GenerationOverlay after the "ready" moment

  // Clear skill filter when category or query changes
  useEffect(() => { setSkillFilter(null); }, [category, query]);

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

  // Apply category + skill filter
  const filteredPaths = useMemo(() => {
    let paths = allPaths;
    if (category === "in-progress") {
      paths = paths.filter((p) => progressMap.has(p.id));
    } else if (category !== "all") {
      paths = paths.filter((p) => pathMatchesCategory(p, category));
    }
    if (skillFilter) {
      paths = paths.filter((p) =>
        p.skill_tags?.some((t) => t.skill_slug === skillFilter.slug)
      );
    }
    return paths;
  }, [allPaths, category, progressMap, skillFilter]);

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

  const handleSelectPath = useCallback(
    (pathId: string) => {
      setIsDropdownOpen(false);
      window.location.href = `/learn/paths/${pathId}`;
    },
    [],
  );

  const handleCardClick = useCallback(
    (pathId: string) => {
      window.location.href = `/learn/paths/${pathId}`;
    },
    [],
  );

  const handleSkillClick = useCallback(
    (slug: string, name: string) => {
      setSkillFilter((prev) => (prev?.slug === slug ? null : { slug, name }));
    },
    [],
  );

  const handleStartGeneration = useCallback(
    (q: string) => {
      setGenerationQuery(q);
      setIsDropdownOpen(false);
      generation.generate(q);
    },
    [generation],
  );

  const handleCloseDropdown = useCallback(() => {
    setIsDropdownOpen(false);
  }, []);

  const handleInputFocus = useCallback(() => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    if (query.trim()) setIsDropdownOpen(true);
  }, [query]);

  const handleInputBlur = useCallback(() => {
    // Delay to allow clicks on dropdown items to register
    blurTimeoutRef.current = setTimeout(() => {
      setIsDropdownOpen(false);
    }, 200);
  }, []);

  const handleTopicClick = useCallback(
    (slug: string) => {
      setQueryFromTopic(slug);
      setIsDropdownOpen(true);
      inputRef.current?.focus();
    },
    [setQueryFromTopic],
  );

  // Open dropdown when query changes (from typing)
  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setQuery(val);
      setIsDropdownOpen(val.trim().length > 0);
    },
    [setQuery],
  );

  // Only show "In Progress" category when user has started paths
  const visibleCategories = useMemo(
    () =>
      CATEGORIES.filter(
        (c) => c.value !== "in-progress" || inProgressPaths.length > 0
      ),
    [inProgressPaths.length]
  );

  const showDropdown = isDropdownOpen && query.trim().length > 0;

  const showGenerationOverlay =
    generation.status === "generating" ||
    generation.status === "complete" ||
    generation.status === "failed";

  const handleDismissOverlay = useCallback(() => {
    generation.reset();
  }, [generation]);

  return (
    <>
      {/* Full-screen overlay — mimics the path page with a modal on top */}
      {showGenerationOverlay && (
        <GenerationOverlay
          query={generationQuery}
          generation={generation}
          onDismiss={handleDismissOverlay}
        />
      )}

    <div className="space-y-5 md:space-y-8">
      {/* Hero card — matches FeaturedRoom e-spot pattern */}
      <section
        className="relative flex w-full items-center justify-center rounded-md border border-shell-border"
        style={{ height: "clamp(340px, 50vh, 500px)" }}
      >
        {/* Background image — overflow-hidden on wrapper so dropdown can escape */}
        <div className="absolute inset-0 overflow-hidden rounded-md">
          <Image
            src="https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=1600&q=80"
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
        </div>
        <div className="relative w-full space-y-4 px-4 md:space-y-6 md:px-10">
          {/* Title + subtitle */}
          <div className="text-center space-y-2 md:space-y-3">
            <h1
              className="text-2xl font-bold text-white md:text-4xl"
              style={{ textShadow: "0 2px 12px rgba(0,0,0,0.7), 0 1px 3px rgba(0,0,0,0.5)" }}
            >
              What do you want to learn?
            </h1>
            <p
              className="text-xs text-white/80 md:text-base"
              style={{ textShadow: "0 1px 8px rgba(0,0,0,0.7), 0 1px 2px rgba(0,0,0,0.5)" }}
            >
              AI-curated learning paths from the best creators across the internet
            </p>
          </div>

          {/* Search Input + Dropdown container */}
          <div className="relative max-w-2xl mx-auto">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 z-10"
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleQueryChange}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              placeholder="Search topics, skills, or keywords..."
              className="w-full pl-11 pr-4 py-2.5 md:py-3 text-sm rounded-xl border text-white placeholder:text-white/50 backdrop-blur-md focus:outline-none focus:border-white/30 transition-colors"
              style={{
                background: "rgba(15,35,24,0.55)",
                borderColor: "rgba(255,255,255,0.2)",
              }}
            />
            {isSearching && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            )}

            {/* Search Dropdown */}
            {showDropdown && (
              <SearchDropdown
                query={query}
                results={searchResults}
                isSearching={isSearching}
                shouldOfferGeneration={shouldOfferGeneration}
                generation={generation}
                onSelectPath={handleSelectPath}
                onStartGeneration={handleStartGeneration}
                onClose={handleCloseDropdown}
              />
            )}
          </div>

          {/* Topic Quick Filters */}
          <div className="max-w-2xl mx-auto">
            <TopicFilters
              topics={POPULAR_TOPICS}
              selected={[]}
              onToggle={handleTopicClick}
            />
          </div>
        </div>
      </section>

      {/* Error */}
      {error && (
        <p className="text-center text-sm text-sg-coral-500">
          {error}
        </p>
      )}

      {/* Skill-based recommendations (discovery mode only) */}
      {!query && recommendations.length > 0 && (
        <SkillRecommendations recommendations={recommendations} />
      )}

      {/* Weekly digest card (discovery mode only) */}
      {!query && <WeeklyDigestCard />}

      {/* Trending skills pills (discovery mode only) */}
      {!query && trending.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs text-shell-500 shrink-0">
            Trending:
          </span>
          {trending.slice(0, 5).map((ms) => {
            const name = ms.skill_slug
              .split("-")
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(" ");
            const isActive = skillFilter?.slug === ms.skill_slug;
            return (
              <button
                key={ms.skill_slug}
                type="button"
                onClick={() => handleSkillClick(ms.skill_slug, name)}
                className="inline-flex items-center gap-1 shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer"
                style={{
                  background: isActive
                    ? "var(--sg-gold-600)"
                    : "var(--sg-shell-100)",
                  color: isActive
                    ? "white"
                    : "var(--sg-shell-600)",
                }}
              >
                <TrendingUp size={10} />
                {name}
              </button>
            );
          })}
        </div>
      )}

      {/* Skill filter chip */}
      {skillFilter && (
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs text-shell-500">
            Filtered by:
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors hover:bg-shell-200"
            style={{
              background: "var(--sg-shell-100)",
              color: "var(--sg-shell-600)",
            }}
            onClick={() => setSkillFilter(null)}
          >
            {skillFilter.name}
            <X size={12} />
          </span>
        </div>
      )}

      {/* Section header + grid */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-shell-900">
          Learning Paths
        </h2>
        <div className="flex items-center gap-2">
          {/* Category dropdown */}
          <div className="relative">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="cursor-pointer appearance-none rounded-full border border-shell-border bg-shell-50 px-4 py-2 pr-8 text-sm text-shell-600 transition-colors hover:border-forest-400 focus:border-forest-400 focus:outline-none"
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
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-shell-500"
            />
          </div>
          {/* Sort dropdown */}
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="cursor-pointer appearance-none rounded-full border border-shell-border bg-shell-50 px-4 py-2 pr-8 text-sm text-shell-600 transition-colors hover:border-forest-400 focus:border-forest-400 focus:outline-none"
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
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-shell-500"
            />
          </div>
        </div>
      </div>

      {/* Discovery Grid */}
      {isLoading ? (
        <PathCardSkeletonGrid count={6} />
      ) : sortedPaths.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sortedPaths.map((path) => (
            <PathCard
              key={path.id}
              path={path}
              progress={progressMap.get(path.id) ?? null}
              onClick={handleCardClick}
              onSkillClick={handleSkillClick}
            />
          ))}
        </div>
      ) : category === "in-progress" ? (
        <div className="text-center py-16 space-y-2">
          <p className="text-sm text-shell-500">
            No paths in progress yet. Start a learning path to track your progress.
          </p>
        </div>
      ) : category !== "all" ? (
        <div className="text-center py-16 space-y-2">
          <p className="text-sm text-shell-500">
            No paths found in this category yet. Try searching for a specific topic.
          </p>
        </div>
      ) : (
        <div className="text-center py-16 space-y-2">
          <p className="text-sm text-shell-500">
            Loading learning paths...
          </p>
        </div>
      )}
    </div>
    </>
  );
}

// ─── Generation Overlay ──────────────────────────────────────
// Full-screen fixed overlay that mimics the path page layout
// with a frosted-glass modal showing animated checkmark steps.

type StepState = "idle" | "active" | "complete" | "failed";

/** Animated checkmark — simple check icon with pop-in animation */
function AnimatedCheck({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className="fp-gen-check"
      style={{ animation: "fp-check-pop 350ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards" }}
    >
      <circle cx="8" cy="8" r="7" stroke="var(--sg-forest-300)" strokeWidth={1.5} fill="none" />
      <path
        d="M4.5 8.2 L7 10.5 L11.5 5.5"
        stroke="var(--sg-forest-300)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Animated X icon for failure */
function AnimatedFail({ size = 18 }: { size?: number }) {
  return (
    <div
      className="fp-gen-fail"
      style={{ animation: "fp-fail-shake 400ms ease-out" }}
    >
      <X size={size} strokeWidth={2} style={{ color: "var(--sg-coral-500)" }} />
    </div>
  );
}

/** Single step row in the generation progress */
function StepRow({ label, state, delay }: { label: string; state: StepState; delay: number }) {
  return (
    <div
      className="fp-gen-step flex items-center gap-3 h-8"
      style={{
        animation: state !== "idle" ? `fp-step-enter 300ms ease-out ${delay}ms both` : undefined,
        opacity: state === "idle" ? 0 : undefined,
      }}
    >
      {/* Icon area — 18px wide */}
      <div className="w-[18px] h-[18px] flex items-center justify-center shrink-0">
        {state === "active" && (
          <Loader2 size={14} className="animate-spin" style={{ color: "var(--sg-forest-300)" }} />
        )}
        {state === "complete" && <AnimatedCheck size={18} />}
        {state === "failed" && <AnimatedFail size={18} />}
      </div>

      {/* Label */}
      <span
        className="text-sm transition-all duration-300"
        style={{
          color:
            state === "active"
              ? "white"
              : state === "complete"
                ? "rgba(255,255,255,0.4)"
                : state === "failed"
                  ? "var(--sg-coral-500)"
                  : "rgba(255,255,255,0.4)",
          textDecoration: state === "complete" ? "line-through" : "none",
          opacity: state === "complete" ? 0.6 : 1,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function GenerationOverlay({
  query,
  generation,
  onDismiss,
}: {
  query: string;
  generation: UsePathGenerationReturn;
  onDismiss: () => void;
}) {
  const { elapsedMs, status, generatedPath } = generation;

  // Track which steps have been revealed (for stagger entrance)
  const [revealedUpTo, setRevealedUpTo] = useState(0);
  // Track the failed step index (the step that was active when failure occurred)
  const [failedStepIndex, setFailedStepIndex] = useState<number | null>(null);
  // Cascade-complete state: when generation finishes before all time thresholds
  const [cascadeComplete, setCascadeComplete] = useState(false);
  const cascadeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const navigateTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Determine which step should be active based on elapsed time
  const timeBasedActiveIndex = GENERATION_STEPS.reduce(
    (idx, step, i) => (elapsedMs >= step.thresholdMs ? i : idx),
    0,
  );

  // Reveal steps as they become active
  useEffect(() => {
    if (status === "generating" && timeBasedActiveIndex > revealedUpTo) {
      setRevealedUpTo(timeBasedActiveIndex);
    }
  }, [status, timeBasedActiveIndex, revealedUpTo]);

  // On failure: mark the currently active step
  useEffect(() => {
    if (status === "failed" && failedStepIndex === null) {
      setFailedStepIndex(revealedUpTo);
    }
  }, [status, failedStepIndex, revealedUpTo]);

  // On completion: cascade remaining steps to "complete"
  useEffect(() => {
    if (status !== "complete" || cascadeComplete) return;

    // Cascade-complete any remaining steps with 200ms stagger
    const remaining = GENERATION_STEPS.length - 1 - revealedUpTo;
    const cascadeDuration = remaining * 200;

    if (remaining > 0) {
      let i = 0;
      const step = () => {
        setRevealedUpTo((prev) => Math.min(prev + 1, GENERATION_STEPS.length - 1));
        i++;
        if (i < remaining) {
          cascadeTimerRef.current = setTimeout(step, 200);
        }
      };
      cascadeTimerRef.current = setTimeout(step, 200);
    }

    // Mark cascade complete after all steps have finished
    const completeTimer = setTimeout(() => {
      setCascadeComplete(true);
    }, cascadeDuration);

    return () => {
      if (cascadeTimerRef.current) clearTimeout(cascadeTimerRef.current);
      clearTimeout(completeTimer);
    };
  }, [status, revealedUpTo, cascadeComplete]);

  // Auto-navigate once cascade is done and path is available
  useEffect(() => {
    if (!cascadeComplete || !generatedPath) return;

    navigateTimerRef.current = setTimeout(() => {
      window.location.href = `/learn/paths/${generatedPath.id}`;
    }, 600);

    return () => {
      if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current);
    };
  }, [cascadeComplete, generatedPath]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cascadeTimerRef.current) clearTimeout(cascadeTimerRef.current);
      if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current);
    };
  }, []);

  // Build step states
  const stepStates: StepState[] = GENERATION_STEPS.map((_, i) => {
    if (status === "failed") {
      if (failedStepIndex !== null && i < failedStepIndex) return "complete";
      if (i === failedStepIndex) return "failed";
      return "idle";
    }
    if (status === "complete" || cascadeComplete) {
      if (i <= revealedUpTo) return "complete";
      return "idle";
    }
    // generating
    if (i < revealedUpTo) return "complete";
    if (i === revealedUpTo) return "active";
    return "idle";
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Dark backdrop — real Learn page shows through dimmed + blurred */}
      <div
        className="absolute inset-0"
        style={{
          background: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      />

      {/* Frosted-glass modal */}
      <div
        className="relative z-10 flex flex-col rounded-2xl border w-full max-w-md mx-4"
        style={{
          background: "rgba(8,8,8,0.88)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderColor: "rgba(255,255,255,0.08)",
          boxShadow: "0 12px 48px rgba(0,0,0,0.6)",
          padding: "40px 48px",
        }}
      >
        {/* Header */}
        <div className="w-full space-y-1.5 mb-6">
          <p className="text-lg font-semibold text-white">
            Building your learning path
          </p>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            {query}
          </p>
        </div>

        {/* Step rows */}
        <div className="w-full space-y-1">
          {GENERATION_STEPS.map((step, i) => (
            <StepRow
              key={step.label}
              label={step.label}
              state={stepStates[i]}
              delay={i * 100}
            />
          ))}
        </div>

        {/* Failure footer */}
        {status === "failed" && (
          <div className="mt-6 space-y-3">
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
              We couldn&apos;t build this path
            </p>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => generation.retry()}
                className="text-sm font-medium hover:underline cursor-pointer"
                style={{ color: "var(--sg-forest-300)" }}
              >
                Try again
              </button>
              <button
                type="button"
                onClick={onDismiss}
                className="text-sm cursor-pointer transition-colors"
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                Go back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
