import type {
  FluencyLevel,
  MissionEvaluationMode,
  ProfessionalFunction,
} from "./common";

export interface MissionGenerationRun {
  id: string;
  evaluationMode: MissionEvaluationMode;
  topicSlug: string;
  sourcePacketId: string | null;
  editorialDecisionId: string | null;
  missionBriefId: string | null;
  editorialKey: string;
  stableKey: string | null;
  professionalFunction: ProfessionalFunction;
  fluencyLevel: FluencyLevel;
  currentStage: string;
  status: "running" | "completed" | "rejected" | "failed" | "skipped";
  inputConfig: Record<string, unknown>;
  stageResults: Record<string, unknown>;
  outputSummary: Record<string, unknown>;
  rejectReasons: string[];
  error: Record<string, unknown> | null;
  startedAt: string;
  completedAt: string | null;
}
