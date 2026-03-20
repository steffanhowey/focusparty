import { getMissionPrimaryArea } from "@/lib/missionPresentation";
import type { PartyWithCount } from "@/lib/parties";
import type { LearningPath } from "@/lib/types";
import { getWorldConfig } from "@/lib/worlds";

interface MissionRoomRecommendations {
  recommendedRoom: PartyWithCount | null;
  otherRooms: PartyWithCount[];
  missionDomainLabel: string | null;
  missionDomainSlug: string | null;
}

const DOMAIN_NAME_TO_SLUG: Record<string, string> = {
  "writing & communication": "writing-communication",
  "technical building": "technical-building",
  "visual & design": "visual-design",
  "strategy & planning": "strategy-planning",
  "workflow automation": "workflow-automation",
  "persuasion & sales": "persuasion-sales",
  "operations & execution": "operations-execution",
  "operations execution": "operations-execution",
};

function normalizeDomainName(value: string | null | undefined): string | null {
  if (!value) return null;
  return DOMAIN_NAME_TO_SLUG[value.trim().toLowerCase()] ?? null;
}

/**
 * Ranks persistent rooms for a mission using the room world's supported
 * capability domains, with `default` and `gentle-start` as stable fallbacks.
 */
export function getMissionRoomRecommendations(
  path: LearningPath,
  parties: PartyWithCount[],
): MissionRoomRecommendations {
  const persistentRooms = parties.filter((party) => party.persistent);
  if (persistentRooms.length === 0) {
    return {
      recommendedRoom: null,
      otherRooms: [],
      missionDomainLabel: null,
      missionDomainSlug: null,
    };
  }

  const primaryArea = getMissionPrimaryArea(path);
  const missionDomainLabel = primaryArea.detail ?? primaryArea.label ?? null;
  const missionDomainSlug =
    normalizeDomainName(primaryArea.detail) ??
    normalizeDomainName(primaryArea.label);

  const scoredRooms = persistentRooms
    .map((party, index) => {
      const world = getWorldConfig(party.world_key);
      const matchesDomain =
        !!missionDomainSlug && world.skillDomains.includes(missionDomainSlug);

      let score = 0;

      if (matchesDomain) {
        score += 100;
      } else if (world.worldKey === "default") {
        score += 24;
      } else if (world.worldKey === "gentle-start") {
        score += 18;
      } else if (!missionDomainSlug) {
        score += 8;
      }

      score += Math.min(party.participant_count, 12);

      return { party, index, score };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.index - right.index;
    });

  return {
    recommendedRoom: scoredRooms[0]?.party ?? null,
    otherRooms: scoredRooms.slice(1).map((entry) => entry.party),
    missionDomainLabel,
    missionDomainSlug,
  };
}
