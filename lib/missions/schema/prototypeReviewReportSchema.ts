import { z } from "zod";
import {
  FluencyLevelSchema,
  IsoDateStringSchema,
  MissionFamilySchema,
  ProfessionalFunctionSchema,
} from "./commonSchema";

export const PrototypeReviewReportSchema = z.object({
  id: z.string().uuid(),
  prototypeKey: z.string().min(1),
  audienceFunction: ProfessionalFunctionSchema,
  fluencyLevel: FluencyLevelSchema,
  topicSlugs: z.array(z.string().min(1)),
  familyScope: z.array(MissionFamilySchema),
  benchmarkVersion: z.string().min(1),
  reviewedBriefIds: z.array(z.string().uuid()),
  sourcePacketCount: z.number().int().nonnegative(),
  missionReadyPacketCount: z.number().int().nonnegative(),
  editorialGenerateNowCount: z.number().int().nonnegative(),
  briefGeneratedCount: z.number().int().nonnegative(),
  briefPassCount: z.number().int().nonnegative(),
  briefFailCount: z.number().int().nonnegative(),
  essentialFields: z.array(z.string()),
  deadWeightFields: z.array(z.string()),
  promoteToTier1Fields: z.array(z.string()),
  unstableFamilyDecisions: z.array(
    z.object({
      topicSlug: z.string().min(1),
      competingFamilies: z.array(MissionFamilySchema),
      note: z.string().min(1),
    }),
  ),
  rejectReasonFrequency: z.array(
    z.object({
      reason: z.string().min(1),
      count: z.number().int().nonnegative(),
    }),
  ),
  genericBriefFindings: z.array(
    z.object({
      missionBriefId: z.string().uuid(),
      note: z.string().min(1),
    }),
  ),
  requiredChangesBeforeGeneralizedBuildout: z.array(z.string()),
  report: z.record(z.string(), z.unknown()),
  createdAt: IsoDateStringSchema,
});

export type PrototypeReviewReportInput = z.infer<
  typeof PrototypeReviewReportSchema
>;
