import { z } from "zod";
import {
  EditorialDecisionStateSchema,
  FluencyLevelSchema,
  IsoDateStringSchema,
  LaunchDomainSchema,
  MissionFamilySchema,
  NullableIsoDateStringSchema,
  ProfessionalFunctionSchema,
} from "./commonSchema";

export const EditorialDecisionSchema = z.object({
  id: z.string().uuid(),
  sourcePacketId: z.string().uuid(),
  editorialKey: z.string().min(1),
  professionalFunction: ProfessionalFunctionSchema,
  fluencyLevel: FluencyLevelSchema,
  decision: EditorialDecisionStateSchema,
  editorialPriority: z.number().int().min(0).max(100),
  recommendedLaunchDomains: z.array(LaunchDomainSchema),
  recommendedFamilyScope: z.array(MissionFamilySchema),
  blockedByMissionBriefId: z.string().uuid().nullable(),
  supersedeMissionBriefId: z.string().uuid().nullable(),
  rationale: z.string().min(1),
  decisionContext: z.record(z.string(), z.unknown()),
  decidedAt: IsoDateStringSchema,
  expiresAt: NullableIsoDateStringSchema,
});

export type EditorialDecisionInput = z.infer<typeof EditorialDecisionSchema>;
