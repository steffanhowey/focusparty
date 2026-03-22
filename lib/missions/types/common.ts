import type { LaunchDomainKey } from "@/lib/launchTaxonomy";
import type { LaunchRoomKey } from "@/lib/launchRooms";
import type {
  FluencyLevel,
  ProfessionalFunction,
} from "@/lib/onboarding/types";

export type { FluencyLevel, LaunchDomainKey, LaunchRoomKey, ProfessionalFunction };

export type TopicCategory = "tool" | "technique" | "concept" | "role" | "platform";

export type SourceKind =
  | "youtube_video"
  | "rss_article"
  | "official_docs"
  | "product_release"
  | "reddit_thread"
  | "hn_post"
  | "manual_editorial_note";

export type EvidenceTier = "primary" | "secondary" | "community";

export type TimelinessClass =
  | "breaking-update"
  | "emerging-practice"
  | "current-standard"
  | "evergreen-foundation";

export type TrendStatus = "breaking" | "rising" | "stable" | "cooling";

export type CredibilityTier = "high" | "medium" | "low";

export type AuthoritySourceType =
  | "official_domain"
  | "official_creator"
  | "community";

export type ClaimType =
  | "capability"
  | "workflow-shift"
  | "market-signal"
  | "risk"
  | "limitation";

export type ContradictionSeverity = "minor" | "material";

export type SourcePacketStatus =
  | "assembled"
  | "validated"
  | "rejected"
  | "superseded";

export type SourcePacketReadinessState =
  | "tracking_only"
  | "watchlist_only"
  | "mission_ready";

export type SourcePacketRejectReason =
  | "off_domain_topic"
  | "insufficient_source_count"
  | "insufficient_source_diversity"
  | "low_credibility_source_base"
  | "missing_why_now"
  | "unresolved_material_contradiction"
  | "stale_without_evergreen_rationale"
  | "no_missionable_angle";

export type EditorialDecisionState =
  | "generate_now"
  | "hold"
  | "reject"
  | "supersede_existing"
  | "duplicate_active"
  | "not_priority_yet";

export type MissionFamily =
  | "adoption-evaluation"
  | "research-synthesis"
  | "messaging-translation"
  | "campaign-design"
  | "content-system-design"
  | "workflow-design"
  | "creative-direction";

export type ArtifactType =
  | "adoption-memo"
  | "audience-brief"
  | "competitive-brief"
  | "message-matrix"
  | "experiment-plan"
  | "content-system"
  | "workflow-spec"
  | "creative-brief"
  | "prompt-pack";

export type MissionStatus =
  | "draft"
  | "active"
  | "rejected"
  | "superseded"
  | "archived";

export type MissionRejectReason =
  | "off_domain_topic"
  | "insufficient_source_packet"
  | "no_marketer_relevance"
  | "no_allowed_family_candidates"
  | "family_selection_low_confidence"
  | "stale_without_evergreen_rationale"
  | "artifact_too_generic"
  | "artifact_not_marketer_native"
  | "timebox_not_one_session"
  | "steps_ambiguous"
  | "missing_required_inputs"
  | "tool_unresolved"
  | "missing_source_traceability"
  | "too_few_success_criteria"
  | "success_criteria_subjective_language"
  | "success_criteria_missing_observable_condition"
  | "success_criteria_missing_required_artifact_structure"
  | "success_criteria_unverifiable"
  | "room_fit_poor"
  | "duplicate_active_version"
  | "unresolved_material_contradiction"
  | "low_novel_user_value";

export type MissionEvaluationMode =
  | "benchmark"
  | "prototype"
  | "shadow"
  | "production";

export type WorkflowSlug =
  | "research-insight"
  | "positioning-messaging"
  | "content-systems"
  | "campaigns-experiments"
  | "workflow-design-operations";

export type MarketerImpactType =
  | "speed"
  | "quality"
  | "coverage"
  | "experimentation"
  | "cost"
  | "risk";

export type MissionGuidanceLevel =
  | "guided"
  | "scaffolded"
  | "independent"
  | "solo";

export type MissionInputType =
  | "brand_context"
  | "product_context"
  | "audience_context"
  | "offer"
  | "url"
  | "text"
  | "asset"
  | "source_selection";

export type MissionConstraintType =
  | "truthfulness"
  | "scope"
  | "brand"
  | "channel"
  | "tool"
  | "time"
  | "evidence";

export type SubmissionMode = "text" | "screenshot" | "link" | "mixed";

export type MissionEvidenceItemType =
  | "artifact"
  | "prompt"
  | "screenshot"
  | "summary";

export type MissionQualityDecision = "pass" | "fail";

export interface MissionQualityDimensionScores {
  freshness: number;
  trustworthiness: number;
  marketer_relevance: number;
  specificity: number;
  one_session_fit: number;
  scaffolding: number;
  opinionatedness: number;
  source_traceability: number;
  novel_user_value: number;
}
