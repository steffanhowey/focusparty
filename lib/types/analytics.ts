// Analytics and performance types

export interface ContentPerformance {
  id: string;
  videoId: string;
  worldKey: string;
  periodDate: string;
  impressions: number;
  starts: number;
  completions: number;
  abandonments: number;
  extensions: number;
  avgWatchSeconds: number;
  completionRate: number;
  engagementScore: number;
}

export interface RoomPerformance {
  id: string;
  roomId: string;
  periodDate: string;
  uniqueParticipants: number;
  totalSessions: number;
  totalSprints: number;
  avgSessionMinutes: number;
  retentionRate: number;
  breakCompletionRate: number;
}

export interface CalibrationRecommendation {
  dimension: string;
  currentWeight: number;
  recommendedWeight: number;
  reason: string;
}

export interface ScoreCalibration {
  id: string;
  calibrationType: "taste_score" | "heat_score" | "creator_authority";
  runAt: string;
  sampleSize: number;
  correlation: number;
  currentWeights: Record<string, number>;
  recommendedWeights: Record<string, number> | null;
  recommendations: CalibrationRecommendation[];
  autoApplied: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

export interface AutoApprovalConfig {
  id: string;
  enabled: boolean;
  minHeatScore: number;
  minContentScore: number;
  minCreatorAuthority: number;
  minCurriculumItems: number;
  maxDailyApprovals: number;
  updatedAt: string;
  updatedBy: string | null;
}

export interface AutoApprovalLogEntry {
  id: string;
  blueprintId: string;
  criteriaSnapshot: AutoApprovalConfig;
  scoresSnapshot: Record<string, number>;
  decision: "approved" | "skipped" | "cap_reached";
  reason: string | null;
  createdAt: string;
}
