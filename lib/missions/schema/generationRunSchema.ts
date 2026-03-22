import { z } from "zod";
import {
  FluencyLevelSchema,
  IsoDateStringSchema,
  MissionEvaluationModeSchema,
  NullableIsoDateStringSchema,
  ProfessionalFunctionSchema,
} from "./commonSchema";

export const GenerationRunSchema = z.object({
  id: z.string().uuid(),
  evaluationMode: MissionEvaluationModeSchema,
  topicSlug: z.string().min(1),
  sourcePacketId: z.string().uuid().nullable(),
  editorialDecisionId: z.string().uuid().nullable(),
  missionBriefId: z.string().uuid().nullable(),
  editorialKey: z.string().min(1),
  stableKey: z.string().nullable(),
  professionalFunction: ProfessionalFunctionSchema,
  fluencyLevel: FluencyLevelSchema,
  currentStage: z.string().min(1),
  status: z.enum(["running", "completed", "rejected", "failed", "skipped"]),
  inputConfig: z.record(z.string(), z.unknown()),
  stageResults: z.record(z.string(), z.unknown()),
  outputSummary: z.record(z.string(), z.unknown()),
  rejectReasons: z.array(z.string()),
  error: z.record(z.string(), z.unknown()).nullable(),
  startedAt: IsoDateStringSchema,
  completedAt: NullableIsoDateStringSchema,
});

export type GenerationRunInput = z.infer<typeof GenerationRunSchema>;
