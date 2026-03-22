import { z } from "zod";
import {
  ArtifactTypeSchema,
  FluencyLevelSchema,
  LaunchDomainSchema,
  MissionFamilySchema,
  ProfessionalFunctionSchema,
} from "./commonSchema";

export const MissionPlanSchema = z.object({
  topicSlug: z.string().min(1),
  professionalFunction: ProfessionalFunctionSchema,
  fluencyLevel: FluencyLevelSchema,
  launchDomain: LaunchDomainSchema,
  missionFamily: MissionFamilySchema,
  artifactType: ArtifactTypeSchema,
  rationale: z.string().min(1),
  candidateScores: z.array(
    z.object({
      family: MissionFamilySchema,
      score: z.number().min(0).max(1),
      rationale: z.string().min(1),
    }),
  ),
});

export type MissionPlanInput = z.infer<typeof MissionPlanSchema>;
