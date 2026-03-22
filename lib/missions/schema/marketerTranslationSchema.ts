import { z } from "zod";
import {
  ArtifactTypeSchema,
  LaunchDomainSchema,
  MissionFamilySchema,
  ProfessionalFunctionSchema,
} from "./commonSchema";

export const MarketerTranslationSchema = z.object({
  translationId: z.string().min(1),
  topicSlug: z.string().min(1),
  professionalFunction: ProfessionalFunctionSchema,
  whyThisMattersForFunction: z.string().min(1),
  marketerUseCase: z.string().min(1),
  affectedLaunchDomains: z
    .array(
      z.object({
        launchDomain: LaunchDomainSchema,
        score: z.number().min(0).max(1),
        rationale: z.string().min(1),
      }),
    )
    .min(1),
  missionFamilyCandidates: z
    .array(
      z.object({
        family: MissionFamilySchema,
        score: z.number().min(0).max(1),
        rationale: z.string().min(1),
        recommendedArtifactType: ArtifactTypeSchema,
      }),
    )
    .min(1),
  recommendedUseCases: z.array(z.string().min(1)).min(1),
  nonUseCases: z.array(z.string()),
  requiredInputHints: z.array(z.string()),
  opinionatedStance: z.string().min(1),
  whatToIgnore: z.array(z.string()),
});

export type MarketerTranslationInput = z.infer<typeof MarketerTranslationSchema>;
