import { z } from "zod";
import {
  AuthoritySourceTypeSchema,
  ClaimTypeSchema,
  ContradictionSeveritySchema,
  CredibilityTierSchema,
  EvidenceTierSchema,
  IsoDateStringSchema,
  LaunchDomainSchema,
  MarketerImpactTypeSchema,
  NullableIsoDateStringSchema,
  SourceKindSchema,
  SourcePacketReadinessStateSchema,
  SourcePacketRejectReasonSchema,
  SourcePacketStatusSchema,
  TimelinessClassSchema,
  TopicCategorySchema,
  TrendStatusSchema,
  WorkflowSlugSchema,
} from "./commonSchema";

const TopicCandidateSchema = z.object({
  topicId: z.string().uuid().nullable(),
  topicSlug: z.string().min(1),
  topicName: z.string().min(1),
  topicCategory: TopicCategorySchema,
  clusterId: z.string().uuid().nullable(),
  discoveryReason: z.enum(["heat", "manual_seed", "search_gap", "market_state"]),
  signalIds: z.array(z.string()),
  heatScoreSnapshot: z.number().nullable(),
  signalCount7d: z.number().int().nonnegative(),
  sourceDiversity7d: z.number().int().nonnegative(),
});

const SourcePacketBlockerSchema = z.object({
  code: z.enum([
    "thin_evidence",
    "vendor_only_evidence",
    "weak_marketer_use_case",
    "unclear_practical_workflow",
    "contradictory_signals",
    "not_one_session_actionable",
    "missing_high_credibility_source",
    "missing_authoritative_source",
    "topic_too_broad_for_packet",
    "source_mix_too_homogeneous",
    "missing_signal_support_for_timely_topic",
    "weak_why_now_evidence",
  ]),
  detail: z.string().min(1),
});

const SourceExcerptSchema = z.object({
  excerptId: z.string().min(1),
  text: z.string().min(1),
  location: z.union([
    z.object({
      kind: z.literal("timestamp"),
      startSeconds: z.number().nonnegative(),
      endSeconds: z.number().nonnegative(),
    }),
    z.object({
      kind: z.literal("paragraph"),
      paragraphIndex: z.number().int().nonnegative(),
    }),
    z.object({
      kind: z.literal("section"),
      label: z.string().min(1),
    }),
  ]),
  usageRole: z.enum([
    "capability-evidence",
    "limitation",
    "timeliness",
    "marketing-impact",
  ]),
});

const SourceClaimSchema = z.object({
  claimId: z.string().min(1),
  statement: z.string().min(1),
  confidence: z.number().min(0).max(1),
  actionable: z.boolean(),
  excerptIds: z.array(z.string().min(1)),
});

const SourcePacketSourceItemSchema = z.object({
  sourceItemId: z.string().min(1),
  sourceKind: SourceKindSchema,
  evidenceTier: EvidenceTierSchema,
  stance: z.enum(["supports", "contextualizes", "questions", "contradicts"]),
  url: z.string().min(1),
  externalId: z.string().nullable(),
  title: z.string().min(1),
  creatorOrPublication: z.string().nullable(),
  domain: z.string().nullable(),
  publishedAt: NullableIsoDateStringSchema,
  discoveredAt: IsoDateStringSchema,
  indexedAt: NullableIsoDateStringSchema,
  contentFormat: z.enum(["video", "article", "post", "doc", "thread"]),
  durationSeconds: z.number().int().nonnegative().nullable(),
  wordCount: z.number().int().nonnegative().nullable(),
  summary: z.string().min(1),
  topics: z.array(z.string()),
  freshness: z.object({
    ageDays: z.number().nonnegative().nullable(),
    withinWindow: z.boolean(),
    freshnessScore: z.number().min(0).max(100),
  }),
  credibility: z.object({
    tier: CredibilityTierSchema,
    score: z.number().min(0).max(100),
    authorityRationale: z.string().min(1),
    selfPromoRisk: z.enum(["low", "medium", "high"]),
    authoritySourceType: AuthoritySourceTypeSchema,
    matchedAuthorityKey: z.string().nullable(),
    baseScore: z.number().min(0).max(100),
    baseTier: CredibilityTierSchema,
    floorApplied: z.boolean(),
  }),
  excerpts: z.array(SourceExcerptSchema),
  claims: z.array(SourceClaimSchema),
});

const PacketClaimSchema = z.object({
  claimId: z.string().min(1),
  statement: z.string().min(1),
  claimType: ClaimTypeSchema,
  confidence: z.number().min(0).max(1),
  importance: z.enum(["high", "medium", "low"]),
  sourceItemIds: z.array(z.string().min(1)),
  excerptIds: z.array(z.string().min(1)),
});

const PacketContradictionSchema = z.object({
  contradictionId: z.string().min(1),
  summary: z.string().min(1),
  conflictingClaimIds: z.array(z.string().min(1)),
  severity: ContradictionSeveritySchema,
  resolutionStatus: z.enum(["resolved", "unresolved", "monitor"]),
  recommendedEditorialStance: z.string().min(1),
});

const PacketUncertaintySchema = z.object({
  uncertaintyId: z.string().min(1),
  summary: z.string().min(1),
  affectedClaimIds: z.array(z.string().min(1)),
  reason: z.enum([
    "low_source_count",
    "vendor_only",
    "community_rumor",
    "outdated_signal",
    "ambiguous_impact",
  ]),
  severity: z.enum(["low", "medium", "high"]),
});

const MarketerRelevanceHintSchema = z.object({
  hintId: z.string().min(1),
  launchDomain: LaunchDomainSchema,
  workflowSlug: WorkflowSlugSchema,
  impactType: MarketerImpactTypeSchema,
  whyMarketersShouldCare: z.string().min(1),
  exampleUseCase: z.string().min(1),
  missionable: z.boolean(),
  suggestedArtifact: z.string().nullable(),
});

export const SourcePacketSchema = z.object({
  packetId: z.string().uuid(),
  schemaVersion: z.literal("source_packet_v1"),
  packetHash: z.string().min(8),
  status: SourcePacketStatusSchema,
  readiness: z.object({
    state: SourcePacketReadinessStateSchema,
    rationale: z.string().min(1),
    blockers: z.array(SourcePacketBlockerSchema),
    nextReviewAt: NullableIsoDateStringSchema,
  }),
  topic: z.object({
    topicId: z.string().uuid().nullable(),
    topicSlug: z.string().min(1),
    topicName: z.string().min(1),
    topicCategory: TopicCategorySchema,
    clusterId: z.string().uuid().nullable(),
    heatScoreSnapshot: z.number().nullable(),
    signalCount7d: z.number().int().nonnegative(),
    sourceDiversity7d: z.number().int().nonnegative(),
  }),
  lineage: z.object({
    inputSignalIds: z.array(z.string()),
    inputContentIds: z.array(z.string()),
    generationRunId: z.string().min(1),
  }),
  sourceWindow: z.object({
    startAt: IsoDateStringSchema,
    endAt: IsoDateStringSchema,
    lookbackDays: z.number().int().positive(),
    timelinessClass: TimelinessClassSchema,
    recommendedTtlHours: z.number().int().positive(),
  }),
  freshness: z.object({
    recencyScore: z.number().min(0).max(100),
    velocityScore: z.number().min(0).max(100),
    noveltyScore: z.number().min(0).max(100),
    trendStatus: TrendStatusSchema,
    staleAfter: IsoDateStringSchema,
  }),
  credibility: z.object({
    overallScore: z.number().min(0).max(100),
    highestEvidenceTier: EvidenceTierSchema,
    highCredibilitySourceCount: z.number().int().nonnegative(),
    lowCredibilitySourceCount: z.number().int().nonnegative(),
    vendorOnly: z.boolean(),
  }),
  whyNow: z.object({
    summary: z.string().min(1),
    changeType: z.enum([
      "new-release",
      "feature-maturation",
      "cost-shift",
      "workflow-adoption",
      "competitive-pressure",
      "evergreen-relevance",
    ]),
    whatChanged: z.array(z.string()),
    whatIsReadyNow: z.array(z.string()),
    whatIsNoiseOrNotYetProven: z.array(z.string()),
    expiryReason: z.string().min(1),
  }),
  keyClaims: z.array(PacketClaimSchema),
  contradictions: z.array(PacketContradictionSchema),
  uncertainties: z.array(PacketUncertaintySchema),
  marketerRelevanceHints: z.array(MarketerRelevanceHintSchema),
  sourceItems: z.array(SourcePacketSourceItemSchema),
  exclusions: z.array(z.string()),
  quality: z.object({
    completenessScore: z.number().min(0).max(100),
    usableForGeneration: z.boolean(),
    rejectReasons: z.array(SourcePacketRejectReasonSchema),
    reviewerNotes: z.array(z.string()),
    diagnostics: z
      .object({
        authoritativeSourceCount: z.number().int().nonnegative(),
        officialDomainCount: z.number().int().nonnegative(),
        officialCreatorCount: z.number().int().nonnegative(),
        secondarySourceCount: z.number().int().nonnegative(),
        genericTutorialCount: z.number().int().nonnegative(),
        uniqueCreatorCount: z.number().int().nonnegative(),
        coherenceScore: z.number().min(0).max(1),
        workflowSurfaceCount: z.number().int().nonnegative(),
        analysisMode: z.enum(["llm", "fallback"]),
        authorityScoringAudit: z.array(
          z.object({
            sourceItemId: z.string().min(1),
            title: z.string().min(1),
            creatorOrPublication: z.string().nullable(),
            authoritySourceType: AuthoritySourceTypeSchema,
            matchedAuthorityKey: z.string().nullable(),
            baseScore: z.number().min(0).max(100),
            baseTier: CredibilityTierSchema,
            adjustedScore: z.number().min(0).max(100),
            adjustedTier: CredibilityTierSchema,
            floorApplied: z.boolean(),
            qualityScore: z.number().min(0).max(100).nullable(),
          }),
        ),
      })
      .optional(),
  }),
  assembledAt: IsoDateStringSchema,
  expiresAt: IsoDateStringSchema,
});

export type SourcePacketInput = z.infer<typeof SourcePacketSchema>;
export type TopicCandidateInput = z.infer<typeof TopicCandidateSchema>;

export { TopicCandidateSchema };
