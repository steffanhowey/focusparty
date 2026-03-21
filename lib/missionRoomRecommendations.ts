import {
  getLaunchRoomPreferenceOrder,
  getMissionLaunchDomain,
} from "@/lib/launchTaxonomy";
import type { PartyWithCount } from "@/lib/parties";
import type { LearningPath } from "@/lib/types";
import {
  getPartyLaunchRoomEntry,
  isPartyLaunchVisible,
  type LaunchRoomKey,
} from "@/lib/launchRooms";
import { getPartyRuntimeWorldKey } from "@/lib/worlds";

interface MissionRoomRecommendations {
  recommendedRoom: PartyWithCount | null;
  otherRooms: PartyWithCount[];
  missionDomainLabel: string | null;
  missionDomainSlug: string | null;
}

const ROOM_PREFERENCE_SCORES = [120, 90, 78, 70];

/**
 * Ranks persistent rooms for a mission using the launch-domain room preference
 * order first, then live relevance, then the existing general fallbacks.
 */
export function getMissionRoomRecommendations(
  path: LearningPath,
  parties: PartyWithCount[],
): MissionRoomRecommendations {
  const persistentRooms = parties.filter(
    (party) => party.persistent && isPartyLaunchVisible(party),
  );
  if (persistentRooms.length === 0) {
    return {
      recommendedRoom: null,
      otherRooms: [],
      missionDomainLabel: null,
      missionDomainSlug: null,
    };
  }

  const launchDomain = getMissionLaunchDomain(path);
  const missionDomainLabel = launchDomain.label;
  const missionDomainSlug = launchDomain.key;
  const preferredRooms =
    launchDomain.source === "fallback"
      ? []
      : getLaunchRoomPreferenceOrder(launchDomain.key);

  const scoredRooms = persistentRooms
    .map((party, index) => {
      const launchRoom = getPartyLaunchRoomEntry(party);
      const runtimeWorldKey = getPartyRuntimeWorldKey(party);
      const launchRoomKey = launchRoom?.key ?? null;
      const preferredRoomIndex = launchRoomKey
        ? preferredRooms.indexOf(launchRoomKey)
        : -1;

      let score = 0;

      if (
        preferredRoomIndex >= 0 &&
        preferredRoomIndex < ROOM_PREFERENCE_SCORES.length
      ) {
        score += ROOM_PREFERENCE_SCORES[preferredRoomIndex];
      } else if (
        preferredRooms.length === 0 &&
        (launchRoom?.key === "research-room" || runtimeWorldKey === "default")
      ) {
        score += 24;
      } else if (
        preferredRooms.length === 0 &&
        (launchRoom?.key === "open-studio" || runtimeWorldKey === "gentle-start")
      ) {
        score += 18;
      } else if (preferredRooms.length === 0) {
        score += 8;
      }

      if (party.status === "active") {
        score += 12;
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
