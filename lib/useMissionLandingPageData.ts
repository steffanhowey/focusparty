"use client";

import { useEffect, useMemo, useState } from "react";
import { isPartyLaunchVisible } from "@/lib/launchRooms";
import { getMissionRoomRecommendations } from "@/lib/missionRoomRecommendations";
import type { PartyWithCount } from "@/lib/parties";
import type { AchievementSummary, LearningPath, LearningProgress } from "@/lib/types";
import { useDiscoverableParties } from "@/lib/useDiscoverableParties";

interface MissionLandingResponse {
  path: LearningPath;
  progress?: LearningProgress | null;
  achievement?: AchievementSummary | null;
}

interface UseMissionLandingPageDataReturn {
  path: LearningPath | null;
  progress: LearningProgress | null;
  achievement: AchievementSummary | null;
  isLoading: boolean;
  error: string | null;
  availableRooms: PartyWithCount[];
  roomsLoading: boolean;
  roomsError: string | null;
  recommendedRoom: PartyWithCount | null;
  fallbackRoom: PartyWithCount | null;
  missionDomainLabel: string | null;
}

export function useMissionLandingPageData(
  pathId: string,
): UseMissionLandingPageDataReturn {
  const [path, setPath] = useState<LearningPath | null>(null);
  const [progress, setProgress] = useState<LearningProgress | null>(null);
  const [achievement, setAchievement] = useState<AchievementSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const {
    parties,
    loading: roomsLoading,
    error: roomsError,
  } = useDiscoverableParties();

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/learn/paths/${pathId}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(response.status === 404 ? "Mission not found" : `HTTP ${response.status}`);
        }

        return (await response.json()) as MissionLandingResponse;
      })
      .then((data) => {
        if (controller.signal.aborted) return;

        setPath(data.path ?? null);
        setProgress(data.progress ?? null);
        setAchievement(data.achievement ?? null);
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) return;

        if (fetchError instanceof Error) {
          setError(fetchError.message);
          return;
        }

        setError("Could not load this mission right now.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [pathId]);

  const availableRooms = useMemo(
    () => parties.filter((party) => party.persistent && isPartyLaunchVisible(party)),
    [parties],
  );

  const roomRecommendation = useMemo(() => {
    if (!path) {
      return {
        recommendedRoom: null,
        otherRooms: [] as PartyWithCount[],
        missionDomainLabel: null,
      };
    }

    const recommendation = getMissionRoomRecommendations(path, parties);

    return {
      recommendedRoom: recommendation.recommendedRoom,
      otherRooms: recommendation.otherRooms,
      missionDomainLabel: recommendation.missionDomainLabel,
    };
  }, [parties, path]);

  return {
    path,
    progress,
    achievement,
    isLoading,
    error,
    availableRooms,
    roomsLoading,
    roomsError,
    recommendedRoom: roomRecommendation.recommendedRoom,
    fallbackRoom: roomRecommendation.otherRooms[0] ?? null,
    missionDomainLabel: roomRecommendation.missionDomainLabel,
  };
}
