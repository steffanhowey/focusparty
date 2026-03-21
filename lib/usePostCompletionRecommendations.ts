"use client";

import { useEffect, useState } from "react";
import type { LearningPath } from "@/lib/types";

interface UsePostCompletionRecommendationsOptions {
  path: LearningPath | null;
  currentPathId: string | null;
  enabled?: boolean;
}

interface UsePostCompletionRecommendationsReturn {
  paths: LearningPath[];
  isLoading: boolean;
}

function dedupePaths(paths: LearningPath[], currentPathId: string): LearningPath[] {
  const seen = new Set<string>();

  return paths.filter((path) => {
    if (path.id === currentPathId) return false;
    if (seen.has(path.id)) return false;
    seen.add(path.id);
    return true;
  });
}

export function usePostCompletionRecommendations({
  path,
  currentPathId,
  enabled = true,
}: UsePostCompletionRecommendationsOptions): UsePostCompletionRecommendationsReturn {
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!enabled || !path || !currentPathId) {
      setPaths([]);
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const resolvedPath = path;
    const resolvedCurrentPathId = currentPathId;

    async function loadRecommendations(): Promise<void> {
      setIsLoading(true);

      try {
        const recommendationResponse = await fetch("/api/learn/recommendations?limit=4");
        const recommendationData = recommendationResponse.ok
          ? await recommendationResponse.json()
          : null;

        const recommendedPaths = dedupePaths(
          ((recommendationData?.recommendations as Array<{ paths?: LearningPath[] }> | undefined) ?? [])
            .flatMap((recommendation) => recommendation.paths ?? []),
          resolvedCurrentPathId,
        ).slice(0, 3);

        if (!cancelled && recommendedPaths.length > 0) {
          setPaths(recommendedPaths);
          setIsLoading(false);
          return;
        }

        const searchQuery = resolvedPath.topics[0] ?? resolvedPath.query;
        const fallbackResponse = await fetch(
          `/api/learn/search?q=${encodeURIComponent(searchQuery)}&limit=4`,
        );
        const fallbackData = fallbackResponse.ok ? await fallbackResponse.json() : null;
        const fallbackPaths = dedupePaths(
          ((fallbackData?.discovery as LearningPath[] | undefined) ?? []),
          resolvedCurrentPathId,
        ).slice(0, 3);

        if (!cancelled) {
          setPaths(fallbackPaths);
        }
      } catch {
        if (!cancelled) {
          setPaths([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadRecommendations();

    return () => {
      cancelled = true;
    };
  }, [currentPathId, enabled, path]);

  return {
    paths,
    isLoading,
  };
}
