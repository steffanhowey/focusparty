"use client";

import { useRouter } from "next/navigation";
import { Search, Layers } from "lucide-react";
import { useLearnSearch } from "@/lib/useLearnSearch";
import { PathCard } from "./PathCard";
import { PathCardSkeletonGrid } from "./PathCardSkeleton";
import { TopicFilters } from "./TopicFilters";
import { ContinueLearning } from "./ContinueLearning";
import { GenerationCard } from "./GenerationCard";

// Popular topics shown as quick filters before search
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

  const handleCardClick = (pathId: string) => {
    router.push(`/learn/paths/${pathId}`);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Continue Learning */}
      {inProgressPaths.length > 0 && (
        <ContinueLearning paths={inProgressPaths} />
      )}

      {/* Hero */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">
          What do you want to learn?
        </h1>
        <p className="text-[var(--color-text-tertiary)] text-sm">
          AI-curated learning paths from the best creators across the internet
        </p>
      </div>

      {/* Search Input */}
      <div className="relative max-w-2xl mx-auto">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search topics, skills, or keywords..."
          className="w-full pl-11 pr-4 py-3 rounded-xl text-sm bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-border-focus)] transition-colors"
        />
        {isLoading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-[var(--color-text-tertiary)] border-t-transparent rounded-full animate-spin" />
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

      {/* Error */}
      {error && (
        <p className="text-center text-sm text-[var(--color-coral-700)]">
          {error}
        </p>
      )}

      {/* Results Header */}
      {hasSearched && !isLoading && (
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
          <Layers size={14} />
          <span>
            {discoveryPaths.length} learning path
            {discoveryPaths.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
            {generationStatus === "generating" && " (generating more...)"}
          </span>
        </div>
      )}

      {/* Results Grid */}
      {isLoading ? (
        <PathCardSkeletonGrid count={3} />
      ) : discoveryPaths.length > 0 ||
        generationStatus === "generating" ||
        generationStatus === "failed" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {discoveryPaths.map((path) => (
            <PathCard key={path.id} path={path} onClick={handleCardClick} />
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
