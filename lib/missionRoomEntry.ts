"use client";

import { getCanonicalRoomEntryRoute } from "@/lib/appRoutes";
import { writeMissionRoomHandoff } from "@/lib/missionRoomHandoff";
import type { PartyWithCount } from "@/lib/parties";
import type { LearningPath } from "@/lib/types";

interface MissionRoomEntryOptions {
  path: LearningPath;
  missionDomainLabel?: string | null;
  missionStepIndex?: number | null;
  missionStepTitle?: string | null;
}

interface MissionRoomEntryHrefOptions extends MissionRoomEntryOptions {
  party: PartyWithCount;
}

function buildMissionRoomSearchParams({
  path,
  missionDomainLabel = null,
  missionStepIndex = null,
  missionStepTitle = null,
}: MissionRoomEntryOptions): URLSearchParams {
  const params = new URLSearchParams();
  params.set("missionId", path.id);
  params.set("missionTitle", path.title);

  if (missionDomainLabel) {
    params.set("missionDomain", missionDomainLabel);
  }

  if (typeof missionStepIndex === "number" && Number.isInteger(missionStepIndex)) {
    params.set("missionStepIndex", String(missionStepIndex));
  }

  if (missionStepTitle) {
    params.set("missionStepTitle", missionStepTitle);
  }

  return params;
}

export function getMissionRoomEntryHref({
  party,
  path,
  missionDomainLabel = null,
  missionStepIndex = null,
  missionStepTitle = null,
}: MissionRoomEntryHrefOptions): string {
  const entryRoute = getCanonicalRoomEntryRoute(party);
  const params = buildMissionRoomSearchParams({
    path,
    missionDomainLabel,
    missionStepIndex,
    missionStepTitle,
  });

  return `${entryRoute}?${params.toString()}`;
}

export function prepareMissionRoomHandoff({
  path,
  missionDomainLabel = null,
  missionStepIndex = null,
  missionStepTitle = null,
}: MissionRoomEntryOptions): void {
  writeMissionRoomHandoff({
    missionId: path.id,
    missionTitle: path.title,
    missionDomain: missionDomainLabel,
    missionStepIndex,
    missionStepTitle,
  });
}

export function prepareMissionRoomEntry({
  party,
  path,
  missionDomainLabel = null,
  missionStepIndex = null,
  missionStepTitle = null,
}: MissionRoomEntryHrefOptions): string {
  prepareMissionRoomHandoff({
    path,
    missionDomainLabel,
    missionStepIndex,
    missionStepTitle,
  });

  return getMissionRoomEntryHref({
    party,
    path,
    missionDomainLabel,
    missionStepIndex,
    missionStepTitle,
  });
}
