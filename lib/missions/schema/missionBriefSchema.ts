import { z } from "zod";
import {
  ArtifactTypeSchema,
  FluencyLevelSchema,
  IsoDateStringSchema,
  LaunchDomainSchema,
  LaunchRoomKeySchema,
  MissionConstraintTypeSchema,
  MissionEvidenceItemTypeSchema,
  MissionFamilySchema,
  MissionGuidanceLevelSchema,
  MissionInputTypeSchema,
  MissionQualityDecisionSchema,
  MissionRejectReasonSchema,
  MissionStatusSchema,
  ProfessionalFunctionSchema,
  SourcePacketReadinessStateSchema,
  SubmissionModeSchema,
  TimelinessClassSchema,
  MissionQualityDimensionScoresSchema,
} from "./commonSchema";

const MissionStepSchema = z.object({
  stepId: z.string().min(1),
  title: z.string().min(1),
  instruction: z.string().min(1),
  expectedOutput: z.string().min(1),
  estimatedMinutes: z.number().int().positive(),
});

const MissionSuccessCriterionSchema = z.object({
  criterionId: z.string().min(1),
  label: z.string().min(1),
  definition: z.string().min(1),
  critical: z.boolean(),
  verificationMethod: z.enum(["binary", "rubric"]).optional(),
});

const MissionSourceReferenceSchema = z.object({
  referenceId: z.string().min(1),
  sourceItemId: z.string().min(1),
  claimIds: z.array(z.string().min(1)),
  supportsSections: z.array(
    z.enum([
      "why_now",
      "why_marketing",
      "artifact",
      "steps",
      "success_criteria",
    ]),
  ),
});

const MissionQualityStampSchema = z.object({
  score: z.number().min(0).max(100),
  dimensionScores: MissionQualityDimensionScoresSchema,
  gateDecision: MissionQualityDecisionSchema,
  rejectReasons: z.array(MissionRejectReasonSchema),
  reviewedAt: IsoDateStringSchema,
  notes: z.array(z.string()),
});

export const MissionBriefSchema = z.object({
  missionId: z.string().uuid(),
  stableKey: z.string().min(1),
  schemaVersion: z.literal("mission_brief_v2"),
  status: MissionStatusSchema,
  identity: z.object({
    title: z.string().min(1),
    shortTitle: z.string().min(1),
    summary: z.string().min(1),
    professionalFunction: ProfessionalFunctionSchema,
    fluencyLevel: FluencyLevelSchema,
    missionFamily: MissionFamilySchema,
    launchDomain: LaunchDomainSchema,
  }),
  topic: z.object({
    topicSlug: z.string().min(1),
    topicName: z.string().min(1),
    sourcePacketId: z.string().uuid(),
    sourcePacketHash: z.string().min(8),
    sourcePacketReadinessState: SourcePacketReadinessStateSchema,
    timelinessClass: TimelinessClassSchema,
    heatScoreSnapshot: z.number().nullable(),
  }),
  framing: z.object({
    whyThisMattersNow: z.string().min(1),
    whyThisMattersForMarketing: z.string().min(1),
    marketerUseCase: z.string().min(1),
  }),
  artifact: z.object({
    artifactType: ArtifactTypeSchema,
    artifactName: z.string().min(1),
    outputDescription: z.string().min(1),
    audience: z.string().min(1),
    format: z.enum([
      "doc",
      "table",
      "deck-outline",
      "prompt-pack",
      "json",
      "worksheet",
    ]),
    completionDefinition: z.string().min(1),
    channel: z.string().nullable().optional(),
    minimumSections: z.array(z.string()).optional(),
  }),
  execution: z.object({
    timeboxMinutes: z.number().int().positive(),
    hardCapMinutes: z.number().int().positive(),
    steps: z.array(MissionStepSchema).min(3).max(6),
  }),
  successCriteria: z.array(MissionSuccessCriterionSchema).min(1),
  bestRoom: z.object({
    roomKey: LaunchRoomKeySchema.nullable(),
    launchDomain: LaunchDomainSchema,
    rationale: z.string().min(1),
  }),
  sourceReferences: z.array(MissionSourceReferenceSchema).min(1),
  quality: MissionQualityStampSchema,
  lifecycleCore: z.object({
    briefVersion: z.number().int().positive(),
    generatedAt: IsoDateStringSchema,
    expiresAt: IsoDateStringSchema,
  }),
  framingPlus: z
    .object({
      opinionatedTake: z.string().min(1),
      whatToIgnore: z.string().nullable(),
      expectedValueIfCompleted: z.string().min(1),
    })
    .optional(),
  inputs: z
    .object({
      requiredInputs: z.array(
        z.object({
          inputId: z.string().min(1),
          label: z.string().min(1),
          description: z.string().min(1),
          type: MissionInputTypeSchema,
          example: z.string().nullable(),
          canUsePlaceholder: z.boolean(),
        }),
      ),
      optionalInputs: z.array(
        z.object({
          inputId: z.string().min(1),
          label: z.string().min(1),
          description: z.string().min(1),
          type: MissionInputTypeSchema,
          example: z.string().nullable(),
          canUsePlaceholder: z.boolean(),
        }),
      ),
      systemDefaults: z.array(
        z.object({
          inputId: z.string().min(1),
          strategy: z.string().min(1),
          defaultValue: z.string().nullable(),
        }),
      ),
    })
    .optional(),
  tools: z
    .object({
      primary: z.object({
        toolKey: z.string().min(1),
        displayName: z.string().min(1),
        resolutionType: z.enum(["registry", "capability"]),
        capabilityTags: z.array(z.string()),
        required: z.boolean(),
        rationale: z.string().min(1),
      }),
      supporting: z.array(
        z.object({
          toolKey: z.string().min(1),
          displayName: z.string().min(1),
          resolutionType: z.enum(["registry", "capability"]),
          capabilityTags: z.array(z.string()),
          required: z.boolean(),
          rationale: z.string().min(1),
        }),
      ),
      disallowed: z.array(z.string()),
    })
    .optional(),
  scaffolding: z
    .object({
      guidanceLevel: MissionGuidanceLevelSchema,
      warmStartPrompt: z.string().nullable(),
      starterTemplate: z.string().nullable(),
      checkpoints: z.array(z.string()),
      commonFailureModes: z.array(z.string()),
    })
    .optional(),
  constraints: z
    .array(
      z.object({
        constraintId: z.string().min(1),
        type: MissionConstraintTypeSchema,
        rule: z.string().min(1),
        hard: z.boolean(),
      }),
    )
    .optional(),
  rubricDimensions: z
    .array(
      z.object({
        dimensionId: z.string().min(1),
        label: z.enum([
          "specificity",
          "channel-fit",
          "strategic-judgment",
          "evidence-use",
          "clarity",
          "completeness",
          "differentiation",
        ]),
        definition: z.string().min(1),
        passingScore: z.number().int().positive(),
      }),
    )
    .optional(),
  roomFitPlus: z
    .object({
      collaborationMode: z.enum([
        "solo-with-shared-momentum",
        "share-and-compare",
        "paired-review",
      ]),
      handoffMoments: z.array(z.string()),
      idealSessionMinutes: z.number().int().positive(),
    })
    .optional(),
  evidence: z
    .object({
      submissionMode: SubmissionModeSchema,
      requiredItems: z.array(
        z.object({
          label: z.string().min(1),
          type: MissionEvidenceItemTypeSchema,
          description: z.string().min(1),
        }),
      ),
      proofOfCompletion: z.array(z.string()),
      autoEvalFields: z.array(z.string()),
    })
    .optional(),
  lifecyclePlus: z
    .object({
      familyTemplateVersion: z.string().min(1),
      benchmarkVersion: z.string().min(1),
      supersedesMissionId: z.string().uuid().nullable(),
      cacheTags: z.array(z.string()),
      regenTriggers: z.array(z.string()),
    })
    .optional(),
});

export type MissionBriefInput = z.infer<typeof MissionBriefSchema>;
export type MissionQualityStampInput = z.infer<typeof MissionQualityStampSchema>;
