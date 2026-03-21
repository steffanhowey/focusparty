"use client";

import { useEffect, useMemo, useState } from "react";

import {
  buildMissionRecommendations,
  type MissionRecommendationViewModel,
  type SkillRecommendationLike,
} from "@/lib/missionRecommendations";
import type { LearningPath } from "@/lib/types";

interface UseMissionRecommendationsOptions {
  surface: "home" | "missions" | "progress";
  activePathId?: string | null;
  activePath?: LearningPath | null;
  limit?: number;
}

interface UseMissionRecommendationsReturn {
  recommendations: MissionRecommendationViewModel[];
  isLoading: boolean;
}

export function useMissionRecommendations({
  surface,
  activePathId = null,
  activePath = null,
  limit = 6,
}: UseMissionRecommendationsOptions): UseMissionRecommendationsReturn {
  const [skillRecommendations, setSkillRecommendations] = useState<
    SkillRecommendationLike[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    fetch(`/api/learn/recommendations?limit=${limit}`)
      .then((res) => (res.ok ? res.json() : { recommendations: [] }))
      .then((data) => {
        if (cancelled) return;
        setSkillRecommendations(data.recommendations ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setSkillRecommendations([]);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [limit]);

  const recommendations = useMemo(
    () =>
      buildMissionRecommendations(skillRecommendations, {
        surface,
        activePathId,
        activePath,
      }),
    [activePath, activePathId, skillRecommendations, surface],
  );

  return { recommendations, isLoading };
}

