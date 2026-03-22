import type {
  EditorialDecisionState,
  FluencyLevel,
  LaunchDomainKey,
  MissionFamily,
  ProfessionalFunction,
} from "./common";

export interface MissionEditorialDecision {
  id: string;
  sourcePacketId: string;
  editorialKey: string;
  professionalFunction: ProfessionalFunction;
  fluencyLevel: FluencyLevel;
  decision: EditorialDecisionState;
  editorialPriority: number;
  recommendedLaunchDomains: LaunchDomainKey[];
  recommendedFamilyScope: MissionFamily[];
  blockedByMissionBriefId: string | null;
  supersedeMissionBriefId: string | null;
  rationale: string;
  decisionContext: Record<string, unknown>;
  decidedAt: string;
  expiresAt: string | null;
}
