"use client";

import { useEffect, useMemo, useState } from "react";
import { buildHomePrimaryAction } from "@/lib/homeLaunchpad";
import { FUNCTION_OPTIONS } from "@/lib/onboarding/types";
import { useActiveMissions } from "@/lib/useActiveMissions";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { useMissionRecommendations } from "@/lib/useMissionRecommendations";
import {
  type ProfileAchievement,
  useSkillProfile,
} from "@/lib/useSkillProfile";

let cachedEvidenceArchive: ProfileAchievement[] | null = null;
let evidenceArchiveRequest: Promise<ProfileAchievement[]> | null = null;

async function loadEvidenceArchive(): Promise<ProfileAchievement[]> {
  if (cachedEvidenceArchive) {
    return cachedEvidenceArchive;
  }

  if (!evidenceArchiveRequest) {
    evidenceArchiveRequest = fetch("/api/learn/achievements")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return response.json();
      })
      .then((data) => {
        const achievements = (data.achievements ?? []) as ProfileAchievement[];
        cachedEvidenceArchive = achievements;
        return achievements;
      })
      .finally(() => {
        evidenceArchiveRequest = null;
      });
  }

  return evidenceArchiveRequest;
}

export interface UseProfilePageDataOptions {
  loadEvidenceArchive?: boolean;
}

export function useProfilePageData({
  loadEvidenceArchive: shouldLoadEvidenceArchive = false,
}: UseProfilePageDataOptions = {}) {
  const currentUser = useCurrentUser();
  const skillProfile = useSkillProfile();
  const activeMissions = useActiveMissions();
  const activeMission = useMemo(() => {
    if (activeMissions.missions.length === 0) return null;

    return [...activeMissions.missions].sort((left, right) => {
      return (
        new Date(right.progress.last_activity_at).getTime() -
        new Date(left.progress.last_activity_at).getTime()
      );
    })[0] ?? null;
  }, [activeMissions.missions]);
  const recommendationsState = useMissionRecommendations({
    surface: "progress",
    activePath: activeMission?.path ?? null,
    activePathId: activeMission?.path.id ?? null,
  });

  const [evidenceArchive, setEvidenceArchive] = useState<ProfileAchievement[]>(
    () => cachedEvidenceArchive ?? [],
  );
  const [evidenceLoaded, setEvidenceLoaded] = useState(
    () => cachedEvidenceArchive !== null,
  );
  const [evidenceError, setEvidenceError] = useState<string | null>(null);

  useEffect(() => {
    if (!shouldLoadEvidenceArchive || evidenceLoaded) return;

    let cancelled = false;

    loadEvidenceArchive()
      .then((achievements) => {
        if (cancelled) return;
        setEvidenceArchive(achievements);
        setEvidenceLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setEvidenceArchive([]);
        setEvidenceError("We couldn't load the full work archive.");
        setEvidenceLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [evidenceLoaded, shouldLoadEvidenceArchive]);

  const primaryAction = useMemo(
    () =>
      buildHomePrimaryAction({
        activeMission,
        recommendations: recommendationsState.recommendations,
        fallbackRecommendations: [],
      }),
    [activeMission, recommendationsState.recommendations],
  );

  const functionLabel =
    FUNCTION_OPTIONS.find(
      (option) => option.value === currentUser.primaryFunction,
    )?.label ?? null;

  const capabilityLine = useMemo(() => {
    if (skillProfile.achievements.length > 0) {
      return "Capability proven through completed work.";
    }

    return "Building capability through hands-on mission work.";
  }, [skillProfile.achievements.length]);

  const focusedNowLine = useMemo(() => {
    if (activeMission) {
      return activeMission.path.title;
    }

    if (primaryAction.kind === "next" && primaryAction.mission) {
      return primaryAction.mission.title;
    }

    if (activeMissions.isLoading || recommendationsState.isLoading) {
      return "Finding the next rep.";
    }

    return "Choose the next rep to get started.";
  }, [
    activeMission,
    activeMissions.isLoading,
    primaryAction.kind,
    primaryAction.mission,
    recommendationsState.isLoading,
  ]);

  const featuredAchievement = useMemo(() => {
    return (
      skillProfile.achievements.find((achievement) =>
        (achievement.skill_receipt?.skills ?? []).some(
          (entry) => entry.leveled_up,
        ),
      ) ??
      skillProfile.achievements[0] ??
      null
    );
  }, [skillProfile.achievements]);

  const secondaryAchievements = useMemo(() => {
    if (!featuredAchievement) return skillProfile.achievements.slice(0, 3);

    return skillProfile.achievements
      .filter((achievement) => achievement.id !== featuredAchievement.id)
      .slice(0, 3);
  }, [featuredAchievement, skillProfile.achievements]);

  return {
    currentUser,
    functionLabel,
    capabilityLine,
    focusedNowLine,
    activeMission,
    primaryAction,
    recommendationsLoading: recommendationsState.isLoading,
    skillProfile,
    featuredAchievement,
    secondaryAchievements,
    evidenceArchive,
    evidenceArchiveLoading:
      shouldLoadEvidenceArchive && !evidenceLoaded && !evidenceError,
    evidenceArchiveError: evidenceError,
  };
}
