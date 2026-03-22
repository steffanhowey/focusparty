import type {
  ArtifactType,
  LaunchDomainKey,
  MissionFamily,
  ProfessionalFunction,
} from "./common";

export interface MarketerTranslation {
  translationId: string;
  topicSlug: string;
  professionalFunction: ProfessionalFunction;
  whyThisMattersForFunction: string;
  marketerUseCase: string;
  affectedLaunchDomains: MarketerTranslationDomainCandidate[];
  missionFamilyCandidates: MissionFamilyCandidate[];
  recommendedUseCases: string[];
  nonUseCases: string[];
  requiredInputHints: string[];
  opinionatedStance: string;
  whatToIgnore: string[];
}

export interface MarketerTranslationDomainCandidate {
  launchDomain: LaunchDomainKey;
  score: number;
  rationale: string;
}

export interface MissionFamilyCandidate {
  family: MissionFamily;
  score: number;
  rationale: string;
  recommendedArtifactType: ArtifactType;
}
