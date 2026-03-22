import {
  getMissionLaunchDomain,
  getMissionLaunchDomainPriority,
  type MissionLaunchDomain,
} from "@/lib/launchTaxonomy";
import { getLaunchMissionTransitionLine } from "@/lib/launchMissionContent";
import { getLaunchRoomMissionFitHint } from "@/lib/launchRooms";
import type { LearningPath } from "@/lib/types";

export type RecommendationReason =
  | "continue_momentum"
  | "level_up"
  | "function_gap"
  | "domain_expansion"
  | "market_demand";

export interface MissionRecommendationAction {
  type: "start_path" | "join_room" | "continue_path";
  label: string;
  href: string;
  room_name?: string;
  participant_count?: number;
}

export interface SkillRecommendationLike {
  reason: RecommendationReason;
  priority: number;
  paths: LearningPath[];
  action: MissionRecommendationAction | null;
}

export interface MissionRecommendationViewModel {
  path: LearningPath;
  reason: RecommendationReason;
  explanation: string;
  action: MissionRecommendationAction | null;
  launchDomain: MissionLaunchDomain;
  roomHint: string | null;
}

export interface BuildMissionRecommendationsOptions {
  surface: "home" | "missions" | "progress";
  activePathId?: string | null;
  activePath?: LearningPath | null;
}

const TRANSITION_LINES = new Map<string, string>([
  [
    "research-insight->positioning-messaging",
    "You gathered the insight. Next, sharpen the message.",
  ],
  [
    "research-insight->campaigns-experiments",
    "You did the research. Next, test campaign angles.",
  ],
  [
    "positioning-messaging->campaigns-experiments",
    "You clarified the messaging. Next, test campaign angles.",
  ],
  [
    "positioning-messaging->content-systems",
    "You clarified the messaging. Next, turn it into repeatable content.",
  ],
  [
    "content-systems->campaigns-experiments",
    "You built the system. Next, run it in a live campaign rep.",
  ],
  [
    "workflow-design-operations->content-systems",
    "You designed the workflow. Next, use it to ship content faster.",
  ],
  [
    "workflow-design-operations->campaigns-experiments",
    "You designed the workflow. Next, use it in a campaign rep.",
  ],
]);

function getMomentumLine(domain: MissionLaunchDomain): string {
  return `You've been making progress in ${domain.shortLabel}. Keep going.`;
}

function getGapLine(domain: MissionLaunchDomain): string {
  return `${domain.shortLabel} still needs more reps. This helps strengthen it.`;
}

function getLogicalFollowLine(domain: MissionLaunchDomain): string {
  return `This follows the work logically. Next, put ${domain.shortLabel.toLowerCase()} into practice.`;
}

function getHomeTransitionLine(
  activePath: LearningPath | null | undefined,
  nextPath: LearningPath,
  domain: MissionLaunchDomain,
): string | null {
  if (!activePath) return null;

  const explicitLaunchTransition = getLaunchMissionTransitionLine(activePath, nextPath);
  if (explicitLaunchTransition) return explicitLaunchTransition;

  const activeDomain = getMissionLaunchDomain(activePath);
  const transitionKey = `${activeDomain.key}->${domain.key}`;
  return TRANSITION_LINES.get(transitionKey) ?? null;
}

function getExplanation(
  recommendation: SkillRecommendationLike,
  path: LearningPath,
  domain: MissionLaunchDomain,
  options: BuildMissionRecommendationsOptions,
): string {
  if (options.surface === "home") {
    const transitionLine = getHomeTransitionLine(
      options.activePath,
      path,
      domain,
    );
    if (transitionLine) return transitionLine;
  }

  if (recommendation.reason === "continue_momentum") {
    return getMomentumLine(domain);
  }

  if (options.surface === "progress") {
    return getGapLine(domain);
  }

  if (
    recommendation.reason === "level_up" ||
    recommendation.reason === "function_gap"
  ) {
    return getGapLine(domain);
  }

  return getLogicalFollowLine(domain);
}

function getRoomHint(action: MissionRecommendationAction | null): string | null {
  if (!action?.room_name) return null;
  return (
    getLaunchRoomMissionFitHint(action.room_name) ??
    `Room fit: ${action.room_name}`
  );
}

export function buildMissionRecommendations(
  skillRecommendations: SkillRecommendationLike[],
  options: BuildMissionRecommendationsOptions,
): MissionRecommendationViewModel[] {
  const scoredRecommendations = skillRecommendations
    .map((recommendation, index) => {
      const path = recommendation.paths[0];
      if (!path) return null;
      if (options.activePathId && path.id === options.activePathId) return null;

      const launchDomain = getMissionLaunchDomain(path);
      const sourceBonus = getMissionLaunchDomainPriority(path);

      return {
        index,
        score: recommendation.priority + sourceBonus,
        recommendation,
        path,
        launchDomain,
      };
    })
    .filter(
      (
        recommendation,
      ): recommendation is {
        index: number;
        score: number;
        recommendation: SkillRecommendationLike;
        path: LearningPath;
        launchDomain: MissionLaunchDomain;
      } => Boolean(recommendation),
    )
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.index - right.index;
    });

  const seenPathIds = new Set<string>();
  const missionRecommendations: MissionRecommendationViewModel[] = [];

  for (const entry of scoredRecommendations) {
    if (seenPathIds.has(entry.path.id)) continue;
    seenPathIds.add(entry.path.id);

    missionRecommendations.push({
      path: entry.path,
      reason: entry.recommendation.reason,
      explanation: getExplanation(
        entry.recommendation,
        entry.path,
        entry.launchDomain,
        options,
      ),
      action: entry.recommendation.action,
      launchDomain: entry.launchDomain,
      roomHint: getRoomHint(entry.recommendation.action),
    });
  }

  return missionRecommendations;
}
