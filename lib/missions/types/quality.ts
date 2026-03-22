import type {
  MissionQualityDecision,
  MissionQualityDimensionScores,
  MissionRejectReason,
} from "./common";

export interface MissionQualityStamp {
  score: number;
  dimensionScores: MissionQualityDimensionScores;
  gateDecision: MissionQualityDecision;
  rejectReasons: MissionRejectReason[];
  reviewedAt: string;
  notes: string[];
}
