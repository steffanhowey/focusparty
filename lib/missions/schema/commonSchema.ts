import { FluencyLevelSchema, ProfessionalFunctionSchema } from "@/lib/learn/validation";
import { z } from "zod";

export { FluencyLevelSchema, ProfessionalFunctionSchema };

export const LaunchDomainSchema = z.enum([
  "research-insight",
  "positioning-messaging",
  "content-systems",
  "campaigns-experiments",
  "workflow-design-operations",
]);

export const LaunchRoomKeySchema = z.enum([
  "messaging-lab",
  "research-room",
  "campaign-sprint",
  "content-systems",
  "workflow-studio",
  "open-studio",
]);

export const TopicCategorySchema = z.enum([
  "tool",
  "technique",
  "concept",
  "role",
  "platform",
]);

export const SourceKindSchema = z.enum([
  "youtube_video",
  "rss_article",
  "official_docs",
  "product_release",
  "reddit_thread",
  "hn_post",
  "manual_editorial_note",
]);

export const EvidenceTierSchema = z.enum(["primary", "secondary", "community"]);
export const TimelinessClassSchema = z.enum([
  "breaking-update",
  "emerging-practice",
  "current-standard",
  "evergreen-foundation",
]);
export const TrendStatusSchema = z.enum(["breaking", "rising", "stable", "cooling"]);
export const CredibilityTierSchema = z.enum(["high", "medium", "low"]);
export const AuthoritySourceTypeSchema = z.enum([
  "official_domain",
  "official_creator",
  "community",
]);
export const ClaimTypeSchema = z.enum([
  "capability",
  "workflow-shift",
  "market-signal",
  "risk",
  "limitation",
]);
export const ContradictionSeveritySchema = z.enum(["minor", "material"]);
export const SourcePacketStatusSchema = z.enum([
  "assembled",
  "validated",
  "rejected",
  "superseded",
]);
export const SourcePacketReadinessStateSchema = z.enum([
  "tracking_only",
  "watchlist_only",
  "mission_ready",
]);
export const SourcePacketRejectReasonSchema = z.enum([
  "off_domain_topic",
  "insufficient_source_count",
  "insufficient_source_diversity",
  "low_credibility_source_base",
  "missing_why_now",
  "unresolved_material_contradiction",
  "stale_without_evergreen_rationale",
  "no_missionable_angle",
]);
export const EditorialDecisionStateSchema = z.enum([
  "generate_now",
  "hold",
  "reject",
  "supersede_existing",
  "duplicate_active",
  "not_priority_yet",
]);
export const MissionFamilySchema = z.enum([
  "adoption-evaluation",
  "research-synthesis",
  "messaging-translation",
  "campaign-design",
  "content-system-design",
  "workflow-design",
  "creative-direction",
]);
export const ArtifactTypeSchema = z.enum([
  "adoption-memo",
  "audience-brief",
  "competitive-brief",
  "message-matrix",
  "experiment-plan",
  "content-system",
  "workflow-spec",
  "creative-brief",
  "prompt-pack",
]);
export const MissionStatusSchema = z.enum([
  "draft",
  "active",
  "rejected",
  "superseded",
  "archived",
]);
export const MissionRejectReasonSchema = z.enum([
  "off_domain_topic",
  "insufficient_source_packet",
  "no_marketer_relevance",
  "no_allowed_family_candidates",
  "family_selection_low_confidence",
  "stale_without_evergreen_rationale",
  "artifact_too_generic",
  "artifact_not_marketer_native",
  "timebox_not_one_session",
  "steps_ambiguous",
  "missing_required_inputs",
  "tool_unresolved",
  "missing_source_traceability",
  "too_few_success_criteria",
  "success_criteria_subjective_language",
  "success_criteria_missing_observable_condition",
  "success_criteria_missing_required_artifact_structure",
  "success_criteria_unverifiable",
  "room_fit_poor",
  "duplicate_active_version",
  "unresolved_material_contradiction",
  "low_novel_user_value",
]);
export const MissionEvaluationModeSchema = z.enum([
  "benchmark",
  "prototype",
  "shadow",
  "production",
]);
export const WorkflowSlugSchema = z.enum([
  "research-insight",
  "positioning-messaging",
  "content-systems",
  "campaigns-experiments",
  "workflow-design-operations",
]);
export const MarketerImpactTypeSchema = z.enum([
  "speed",
  "quality",
  "coverage",
  "experimentation",
  "cost",
  "risk",
]);
export const MissionGuidanceLevelSchema = z.enum([
  "guided",
  "scaffolded",
  "independent",
  "solo",
]);
export const MissionInputTypeSchema = z.enum([
  "brand_context",
  "product_context",
  "audience_context",
  "offer",
  "url",
  "text",
  "asset",
  "source_selection",
]);
export const MissionConstraintTypeSchema = z.enum([
  "truthfulness",
  "scope",
  "brand",
  "channel",
  "tool",
  "time",
  "evidence",
]);
export const SubmissionModeSchema = z.enum(["text", "screenshot", "link", "mixed"]);
export const MissionEvidenceItemTypeSchema = z.enum([
  "artifact",
  "prompt",
  "screenshot",
  "summary",
]);
export const MissionQualityDecisionSchema = z.enum(["pass", "fail"]);

export const IsoDateStringSchema = z.string().datetime({ offset: true });
export const NullableIsoDateStringSchema = IsoDateStringSchema.nullable();

export const MissionQualityDimensionScoresSchema = z.object({
  freshness: z.number().min(0).max(5),
  trustworthiness: z.number().min(0).max(5),
  marketer_relevance: z.number().min(0).max(5),
  specificity: z.number().min(0).max(5),
  one_session_fit: z.number().min(0).max(5),
  scaffolding: z.number().min(0).max(5),
  opinionatedness: z.number().min(0).max(5),
  source_traceability: z.number().min(0).max(5),
  novel_user_value: z.number().min(0).max(5),
});
