"use client";

/**
 * Hook to fetch skill-based path recommendations.
 * Used on the Learn page to show "Recommended for you" section.
 */

import { useState, useEffect } from "react";
import type { LearningPath } from "./types";

export interface SkillRecommendation {
  skill: {
    slug: string;
    name: string;
    domain_name: string;
  };
  reason: "level_up" | "function_gap" | "domain_expansion";
  reason_text: string;
  priority: number;
  paths: LearningPath[];
}

interface UseSkillRecommendationsReturn {
  recommendations: SkillRecommendation[];
  isLoading: boolean;
}

export function useSkillRecommendations(): UseSkillRecommendationsReturn {
  const [recommendations, setRecommendations] = useState<SkillRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/learn/recommendations?limit=6")
      .then((res) => (res.ok ? res.json() : { recommendations: [] }))
      .then((data) => setRecommendations(data.recommendations ?? []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  return { recommendations, isLoading };
}
