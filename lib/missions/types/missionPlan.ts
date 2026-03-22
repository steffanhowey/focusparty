import type {
  ArtifactType,
  FluencyLevel,
  LaunchDomainKey,
  MissionFamily,
  ProfessionalFunction,
} from "./common";

export interface MissionPlan {
  topicSlug: string;
  professionalFunction: ProfessionalFunction;
  fluencyLevel: FluencyLevel;
  launchDomain: LaunchDomainKey;
  missionFamily: MissionFamily;
  artifactType: ArtifactType;
  rationale: string;
  candidateScores: MissionPlanCandidateScore[];
}

export interface MissionPlanCandidateScore {
  family: MissionFamily;
  score: number;
  rationale: string;
}
