import type {
  AuthoritySourceType,
  ClaimType,
  ContradictionSeverity,
  CredibilityTier,
  EvidenceTier,
  LaunchDomainKey,
  MarketerImpactType,
  SourceKind,
  SourcePacketReadinessState,
  SourcePacketRejectReason,
  SourcePacketStatus,
  TimelinessClass,
  TopicCategory,
  TrendStatus,
  WorkflowSlug,
} from "./common";

export interface TopicCandidate {
  topicId: string | null;
  topicSlug: string;
  topicName: string;
  topicCategory: TopicCategory;
  clusterId: string | null;
  discoveryReason: "heat" | "manual_seed" | "search_gap" | "market_state";
  signalIds: string[];
  heatScoreSnapshot: number | null;
  signalCount7d: number;
  sourceDiversity7d: number;
}

export interface SourcePacket {
  packetId: string;
  schemaVersion: "source_packet_v1";
  packetHash: string;
  status: SourcePacketStatus;
  readiness: SourcePacketReadiness;
  topic: SourcePacketTopic;
  lineage: SourcePacketLineage;
  sourceWindow: SourceWindow;
  freshness: PacketFreshness;
  credibility: PacketCredibility;
  whyNow: WhyNowFrame;
  keyClaims: PacketClaim[];
  contradictions: PacketContradiction[];
  uncertainties: PacketUncertainty[];
  marketerRelevanceHints: MarketerRelevanceHint[];
  sourceItems: SourcePacketSourceItem[];
  exclusions: string[];
  quality: SourcePacketQuality;
  assembledAt: string;
  expiresAt: string;
}

export interface SourcePacketReadiness {
  state: SourcePacketReadinessState;
  rationale: string;
  blockers: SourcePacketBlocker[];
  nextReviewAt: string | null;
}

export interface SourcePacketBlocker {
  code:
    | "thin_evidence"
    | "vendor_only_evidence"
    | "weak_marketer_use_case"
    | "unclear_practical_workflow"
    | "contradictory_signals"
    | "not_one_session_actionable"
    | "missing_high_credibility_source"
    | "missing_authoritative_source"
    | "topic_too_broad_for_packet"
    | "source_mix_too_homogeneous"
    | "missing_signal_support_for_timely_topic"
    | "weak_why_now_evidence";
  detail: string;
}

export interface SourcePacketTopic {
  topicId: string | null;
  topicSlug: string;
  topicName: string;
  topicCategory: TopicCategory;
  clusterId: string | null;
  heatScoreSnapshot: number | null;
  signalCount7d: number;
  sourceDiversity7d: number;
}

export interface SourcePacketLineage {
  inputSignalIds: string[];
  inputContentIds: string[];
  generationRunId: string;
}

export interface SourceWindow {
  startAt: string;
  endAt: string;
  lookbackDays: number;
  timelinessClass: TimelinessClass;
  recommendedTtlHours: number;
}

export interface PacketFreshness {
  recencyScore: number;
  velocityScore: number;
  noveltyScore: number;
  trendStatus: TrendStatus;
  staleAfter: string;
}

export interface PacketCredibility {
  overallScore: number;
  highestEvidenceTier: EvidenceTier;
  highCredibilitySourceCount: number;
  lowCredibilitySourceCount: number;
  vendorOnly: boolean;
}

export interface WhyNowFrame {
  summary: string;
  changeType:
    | "new-release"
    | "feature-maturation"
    | "cost-shift"
    | "workflow-adoption"
    | "competitive-pressure"
    | "evergreen-relevance";
  whatChanged: string[];
  whatIsReadyNow: string[];
  whatIsNoiseOrNotYetProven: string[];
  expiryReason: string;
}

export interface PacketClaim {
  claimId: string;
  statement: string;
  claimType: ClaimType;
  confidence: number;
  importance: "high" | "medium" | "low";
  sourceItemIds: string[];
  excerptIds: string[];
}

export interface SourcePacketSourceItem {
  sourceItemId: string;
  sourceKind: SourceKind;
  evidenceTier: EvidenceTier;
  stance: "supports" | "contextualizes" | "questions" | "contradicts";
  url: string;
  externalId: string | null;
  title: string;
  creatorOrPublication: string | null;
  domain: string | null;
  publishedAt: string | null;
  discoveredAt: string;
  indexedAt: string | null;
  contentFormat: "video" | "article" | "post" | "doc" | "thread";
  durationSeconds: number | null;
  wordCount: number | null;
  summary: string;
  topics: string[];
  freshness: SourceFreshness;
  credibility: SourceCredibility;
  excerpts: SourceExcerpt[];
  claims: SourceClaim[];
}

export interface SourceFreshness {
  ageDays: number | null;
  withinWindow: boolean;
  freshnessScore: number;
}

export interface SourceCredibility {
  tier: CredibilityTier;
  score: number;
  authorityRationale: string;
  selfPromoRisk: "low" | "medium" | "high";
  authoritySourceType: AuthoritySourceType;
  matchedAuthorityKey: string | null;
  baseScore: number;
  baseTier: CredibilityTier;
  floorApplied: boolean;
}

export interface AuthorityScoringAuditEntry {
  sourceItemId: string;
  title: string;
  creatorOrPublication: string | null;
  authoritySourceType: AuthoritySourceType;
  matchedAuthorityKey: string | null;
  baseScore: number;
  baseTier: CredibilityTier;
  adjustedScore: number;
  adjustedTier: CredibilityTier;
  floorApplied: boolean;
  qualityScore: number | null;
}

export interface SourcePacketDiagnostics {
  authoritativeSourceCount: number;
  officialDomainCount: number;
  officialCreatorCount: number;
  secondarySourceCount: number;
  genericTutorialCount: number;
  uniqueCreatorCount: number;
  coherenceScore: number;
  workflowSurfaceCount: number;
  analysisMode: "llm" | "fallback";
  authorityScoringAudit: AuthorityScoringAuditEntry[];
}

export interface SourceExcerpt {
  excerptId: string;
  text: string;
  location:
    | { kind: "timestamp"; startSeconds: number; endSeconds: number }
    | { kind: "paragraph"; paragraphIndex: number }
    | { kind: "section"; label: string };
  usageRole:
    | "capability-evidence"
    | "limitation"
    | "timeliness"
    | "marketing-impact";
}

export interface SourceClaim {
  claimId: string;
  statement: string;
  confidence: number;
  actionable: boolean;
  excerptIds: string[];
}

export interface PacketContradiction {
  contradictionId: string;
  summary: string;
  conflictingClaimIds: string[];
  severity: ContradictionSeverity;
  resolutionStatus: "resolved" | "unresolved" | "monitor";
  recommendedEditorialStance: string;
}

export interface PacketUncertainty {
  uncertaintyId: string;
  summary: string;
  affectedClaimIds: string[];
  reason:
    | "low_source_count"
    | "vendor_only"
    | "community_rumor"
    | "outdated_signal"
    | "ambiguous_impact";
  severity: "low" | "medium" | "high";
}

export interface MarketerRelevanceHint {
  hintId: string;
  launchDomain: LaunchDomainKey;
  workflowSlug: WorkflowSlug;
  impactType: MarketerImpactType;
  whyMarketersShouldCare: string;
  exampleUseCase: string;
  missionable: boolean;
  suggestedArtifact: string | null;
}

export interface SourcePacketQuality {
  completenessScore: number;
  usableForGeneration: boolean;
  rejectReasons: SourcePacketRejectReason[];
  reviewerNotes: string[];
  diagnostics?: SourcePacketDiagnostics;
}
