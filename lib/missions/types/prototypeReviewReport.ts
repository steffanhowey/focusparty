import type {
  FluencyLevel,
  MissionFamily,
  ProfessionalFunction,
} from "./common";

export interface PrototypeReviewReport {
  id: string;
  prototypeKey: string;
  audienceFunction: ProfessionalFunction;
  fluencyLevel: FluencyLevel;
  topicSlugs: string[];
  familyScope: MissionFamily[];
  benchmarkVersion: string;
  reviewedBriefIds: string[];
  sourcePacketCount: number;
  missionReadyPacketCount: number;
  editorialGenerateNowCount: number;
  briefGeneratedCount: number;
  briefPassCount: number;
  briefFailCount: number;
  essentialFields: string[];
  deadWeightFields: string[];
  promoteToTier1Fields: string[];
  unstableFamilyDecisions: Array<{
    topicSlug: string;
    competingFamilies: MissionFamily[];
    note: string;
  }>;
  rejectReasonFrequency: Array<{
    reason: string;
    count: number;
  }>;
  genericBriefFindings: Array<{
    missionBriefId: string;
    note: string;
  }>;
  requiredChangesBeforeGeneralizedBuildout: string[];
  report: Record<string, unknown>;
  createdAt: string;
}
