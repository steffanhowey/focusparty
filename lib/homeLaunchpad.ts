import {
  getLaunchRoomMissionFitHint,
  getPartyLaunchPickerDescription,
  isPartyLaunchVisible,
} from "@/lib/launchRooms";
import {
  getMissionProgressSummary,
  getMissionRepSummary,
} from "@/lib/missionPresentation";
import { getMissionRoomRecommendations } from "@/lib/missionRoomRecommendations";
import type { PartyWithCount } from "@/lib/parties";
import type { MissionRecommendationViewModel } from "@/lib/missionRecommendations";
import type { GoalRecord, LearningPath, LearningProgress } from "@/lib/types";
import type { ProfileAchievement, SkillGaps } from "@/lib/useSkillProfile";

export interface HomeMissionProgressEntry {
  path: LearningPath;
  progress: LearningProgress;
}

export interface HomePrimaryAction {
  kind: "active" | "next" | "empty";
  mission: LearningPath | null;
  progress: LearningProgress | null;
  recommendation: MissionRecommendationViewModel | null;
}

interface BuildHomePrimaryActionOptions {
  activeMission: HomeMissionProgressEntry | null;
  recommendations: MissionRecommendationViewModel[];
  fallbackRecommendations: MissionRecommendationViewModel[];
}

interface BuildHomeBestNextRepOptions {
  primaryAction: HomePrimaryAction;
  recommendations: MissionRecommendationViewModel[];
  fallbackRecommendations: MissionRecommendationViewModel[];
}

export interface HomeBestRoom {
  party: PartyWithCount;
  source: "mission" | "fallback";
  whyLine: string;
  liveLine: string;
}

interface BuildHomeBestRoomOptions {
  focusPath: LearningPath | null;
  parties: PartyWithCount[];
}

export interface HomeRecentMovementItem {
  id: string;
  label: string;
  text: string;
}

interface BuildHomeRecentMovementOptions {
  achievements: ProfileAchievement[];
  gaps: SkillGaps | null;
  nextRecommendation?: MissionRecommendationViewModel | null;
}

export interface HomeQueueSnapshotItem {
  pathId: string | null;
  title: string;
  supportLine: string;
}

export interface HomeQueueSnapshot {
  activeItem: HomeQueueSnapshotItem | null;
  savedItems: HomeQueueSnapshotItem[];
  savedCount: number;
}

interface BuildHomeQueueSnapshotOptions {
  goals: GoalRecord[];
  activeMission: HomeMissionProgressEntry | null;
  knownPaths: LearningPath[];
}

function capitalizeWords(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getOrderedRecommendations(
  recommendations: MissionRecommendationViewModel[],
  fallbackRecommendations: MissionRecommendationViewModel[],
): MissionRecommendationViewModel[] {
  const ordered: MissionRecommendationViewModel[] = [];
  const seenPathIds = new Set<string>();

  for (const recommendation of [
    ...recommendations,
    ...fallbackRecommendations,
  ]) {
    if (seenPathIds.has(recommendation.path.id)) continue;
    seenPathIds.add(recommendation.path.id);
    ordered.push(recommendation);
  }

  return ordered;
}

function formatRoomLiveLine(party: PartyWithCount): string {
  const statusLabel = party.status === "active" ? "Active now" : "Open now";
  const participantLabel =
    party.participant_count === 1
      ? "1 in room"
      : `${party.participant_count} in room`;

  return `${statusLabel} · ${participantLabel}`;
}

function getMostRelevantLevelUp(achievements: ProfileAchievement[]) {
  return (
    achievements
      .flatMap((achievement) => achievement.skill_receipt?.skills ?? [])
      .find((entry) => entry.leveled_up) ?? null
  );
}

/**
 * Chooses the single primary mission action for Home.
 */
export function buildHomePrimaryAction({
  activeMission,
  recommendations,
  fallbackRecommendations,
}: BuildHomePrimaryActionOptions): HomePrimaryAction {
  if (activeMission) {
    return {
      kind: "active",
      mission: activeMission.path,
      progress: activeMission.progress,
      recommendation: null,
    };
  }

  const nextRecommendation =
    getOrderedRecommendations(recommendations, fallbackRecommendations)[0] ??
    null;

  if (nextRecommendation) {
    return {
      kind: "next",
      mission: nextRecommendation.path,
      progress: null,
      recommendation: nextRecommendation,
    };
  }

  return {
    kind: "empty",
    mission: null,
    progress: null,
    recommendation: null,
  };
}

/**
 * Chooses one distinct follow-on recommendation for Home, avoiding a duplicate
 * of the primary hero mission.
 */
export function buildHomeBestNextRep({
  primaryAction,
  recommendations,
  fallbackRecommendations,
}: BuildHomeBestNextRepOptions): MissionRecommendationViewModel | null {
  const orderedRecommendations = getOrderedRecommendations(
    recommendations,
    fallbackRecommendations,
  );
  const primaryMissionId = primaryAction.mission?.id ?? null;

  return (
    orderedRecommendations.find(
      (recommendation) => recommendation.path.id !== primaryMissionId,
    ) ?? null
  );
}

/**
 * Chooses the most relevant room assist for Home without changing room logic.
 */
export function buildHomeBestRoom({
  focusPath,
  parties,
}: BuildHomeBestRoomOptions): HomeBestRoom | null {
  const persistentLaunchRooms = parties.filter(
    (party) => party.persistent && isPartyLaunchVisible(party),
  );
  if (persistentLaunchRooms.length === 0) return null;

  if (focusPath) {
    const recommendation = getMissionRoomRecommendations(
      focusPath,
      persistentLaunchRooms,
    );
    if (recommendation.recommendedRoom) {
      return {
        party: recommendation.recommendedRoom,
        source: "mission",
        whyLine:
          getLaunchRoomMissionFitHint(recommendation.recommendedRoom) ??
          getPartyLaunchPickerDescription(recommendation.recommendedRoom),
        liveLine: formatRoomLiveLine(recommendation.recommendedRoom),
      };
    }
  }

  const fallbackRoom =
    [...persistentLaunchRooms].sort((left, right) => {
      if (left.status === "active" && right.status !== "active") return -1;
      if (left.status !== "active" && right.status === "active") return 1;
      if (right.participant_count !== left.participant_count) {
        return right.participant_count - left.participant_count;
      }
      return 0;
    })[0] ?? null;

  if (!fallbackRoom) return null;

  return {
    party: fallbackRoom,
    source: "fallback",
    whyLine: getPartyLaunchPickerDescription(fallbackRoom),
    liveLine: formatRoomLiveLine(fallbackRoom),
  };
}

/**
 * Builds the compact orientation rows shown in Home's recent movement module.
 */
export function buildHomeRecentMovement({
  achievements,
  gaps,
  nextRecommendation = null,
}: BuildHomeRecentMovementOptions): HomeRecentMovementItem[] {
  const items: HomeRecentMovementItem[] = [];
  const latestAchievement = achievements[0] ?? null;
  const recentLevelUp = getMostRelevantLevelUp(achievements);
  const activeProgression = gaps?.active_progression[0] ?? null;

  if (latestAchievement) {
    items.push({
      id: `completed-${latestAchievement.id}`,
      label: "Completed",
      text: latestAchievement.path_title,
    });
  }

  if (recentLevelUp) {
    items.push({
      id: `strengthened-${recentLevelUp.skill.slug}`,
      label: "Strengthened",
      text: `${recentLevelUp.skill.name} to ${capitalizeWords(
        recentLevelUp.after.fluency_level,
      )}`,
    });
  } else if (activeProgression) {
    items.push({
      id: `strengthening-${activeProgression.skill_slug}`,
      label: "Strengthening",
      text: `${activeProgression.skill_name} toward ${activeProgression.next_level}`,
    });
  }

  if (nextRecommendation) {
    items.push({
      id: `needs-${nextRecommendation.path.id}`,
      label: "Needs reps",
      text: nextRecommendation.launchDomain.shortLabel,
    });
  }

  return items.slice(0, 3);
}

/**
 * Builds the lightweight saved/active mission snapshot for Home.
 */
export function buildHomeQueueSnapshot({
  goals,
  activeMission,
  knownPaths,
}: BuildHomeQueueSnapshotOptions): HomeQueueSnapshot {
  const pathMap = new Map<string, LearningPath>();
  for (const path of knownPaths) {
    pathMap.set(path.id, path);
  }

  const activePathId = activeMission?.path.id ?? null;
  const seenSavedPathIds = new Set<string>();
  const orderedSavedGoals = goals
    .filter((goal) => {
      if (!goal.linked_path_id) return false;
      if (goal.status === "archived" || goal.status === "completed")
        return false;
      if (goal.linked_path_id === activePathId) return false;
      if (seenSavedPathIds.has(goal.linked_path_id)) return false;
      seenSavedPathIds.add(goal.linked_path_id);
      return true;
    })
    .sort((left, right) => left.position - right.position);

  return {
    activeItem: activeMission
      ? {
          pathId: activeMission.path.id,
          title: activeMission.path.title,
          supportLine: getMissionProgressSummary(activeMission.progress),
        }
      : null,
    savedItems: orderedSavedGoals.slice(0, 2).map((goal) => {
      const path = goal.linked_path_id
        ? (pathMap.get(goal.linked_path_id) ?? null)
        : null;

      return {
        pathId: goal.linked_path_id,
        title: path?.title ?? goal.title,
        supportLine: path
          ? getMissionRepSummary(path)
          : "Saved for your next rep",
      };
    }),
    savedCount: orderedSavedGoals.length,
  };
}
