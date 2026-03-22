import { getEligibleMissionFamiliesForLane } from "@/lib/missions/config/familyCoverage";
import { getDefaultArtifactTypeForFamily } from "@/lib/missions/config/missionFamilies";
import type {
  FluencyLevel,
  LaunchDomainKey,
  MissionFamily,
  ProfessionalFunction,
} from "@/lib/missions/types/common";
import type { MarketerTranslation } from "@/lib/missions/types/marketerTranslation";
import type { MissionPlan } from "@/lib/missions/types/missionPlan";

export interface MissionFamilySelectorOptions {
  allowedFamilies?: MissionFamily[];
}

export interface MissionFamilySelectionResult {
  missionPlan: MissionPlan | null;
  failureReason: "no_allowed_family_candidates" | "family_selection_low_confidence" | null;
  candidateScores: MissionPlan["candidateScores"];
}

const FAMILY_DOMAIN_PREFERENCES: Record<MissionFamily, LaunchDomainKey[]> = {
  "adoption-evaluation": ["workflow-design-operations"],
  "research-synthesis": ["research-insight", "workflow-design-operations"],
  "messaging-translation": ["positioning-messaging", "research-insight"],
  "campaign-design": ["campaigns-experiments", "positioning-messaging"],
  "content-system-design": ["content-systems", "workflow-design-operations"],
  "workflow-design": ["workflow-design-operations", "research-insight"],
  "creative-direction": ["positioning-messaging", "content-systems"],
};

/** Deterministically select the mission family, launch domain, and artifact type. */
export function selectMissionFamily(
  translation: MarketerTranslation,
  professionalFunction: ProfessionalFunction,
  fluencyLevel: FluencyLevel,
  options: MissionFamilySelectorOptions = {},
): MissionFamilySelectionResult {
  const requestedFamilies =
    options.allowedFamilies && options.allowedFamilies.length > 0
      ? options.allowedFamilies
      : translation.missionFamilyCandidates.map((candidate) => candidate.family);
  const eligibleFamilies = getEligibleMissionFamiliesForLane({
    topicSlug: translation.topicSlug,
    professionalFunction,
    fluencyLevel,
    candidateFamilies: requestedFamilies,
  });
  const familyCandidates = translation.missionFamilyCandidates
    .filter((candidate) => eligibleFamilies.includes(candidate.family))
    .sort((left, right) => right.score - left.score);

  const candidateScores = familyCandidates.map((candidate) => ({
    family: candidate.family,
    score: candidate.score,
    rationale: candidate.rationale,
  }));

  if (familyCandidates.length === 0) {
    return {
      missionPlan: null,
      failureReason: "no_allowed_family_candidates",
      candidateScores,
    };
  }

  const [topCandidate, secondCandidate] = familyCandidates;
  if (!topCandidate) {
    return {
      missionPlan: null,
      failureReason: "family_selection_low_confidence",
      candidateScores,
    };
  }

  if (topCandidate.score < 0.55) {
    return {
      missionPlan: null,
      failureReason: "family_selection_low_confidence",
      candidateScores,
    };
  }

  if (
    secondCandidate &&
    topCandidate.score - secondCandidate.score < 0.05 &&
    topCandidate.score < 0.75
  ) {
    return {
      missionPlan: null,
      failureReason: "family_selection_low_confidence",
      candidateScores,
    };
  }

  const launchDomain = selectLaunchDomainForFamily(
    translation,
    topCandidate.family,
  );

  if (!launchDomain) {
    return {
      missionPlan: null,
      failureReason: "family_selection_low_confidence",
      candidateScores,
    };
  }

  return {
    missionPlan: {
      topicSlug: translation.topicSlug,
      professionalFunction,
      fluencyLevel,
      launchDomain,
      missionFamily: topCandidate.family,
      artifactType: inferArtifactType(topCandidate.family, translation.marketerUseCase),
      rationale: `${topCandidate.family} selected as the best job shape for "${translation.marketerUseCase}".`,
      candidateScores,
    },
    failureReason: null,
    candidateScores,
  };
}

function selectLaunchDomainForFamily(
  translation: MarketerTranslation,
  family: MissionFamily,
): LaunchDomainKey | null {
  const sortedDomains = [...translation.affectedLaunchDomains].sort(
    (left, right) => right.score - left.score,
  );
  const preferredDomains = FAMILY_DOMAIN_PREFERENCES[family];

  for (const preferred of preferredDomains) {
    const match = sortedDomains.find((candidate) => candidate.launchDomain === preferred);
    if (match) return match.launchDomain;
  }

  return sortedDomains[0]?.launchDomain ?? null;
}

function inferArtifactType(
  family: MissionFamily,
  marketerUseCase: string,
): MissionPlan["artifactType"] {
  const normalized = marketerUseCase.toLowerCase();

  if (family === "research-synthesis") {
    return /competitive|competitor|battlecard/.test(normalized)
      ? "competitive-brief"
      : "audience-brief";
  }

  if (family === "creative-direction") {
    return /prompt|asset|image/.test(normalized) ? "prompt-pack" : "creative-brief";
  }

  return getDefaultArtifactTypeForFamily(family);
}
