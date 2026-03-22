import { randomUUID, createHash } from "crypto";
import OpenAI from "openai";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import {
  buildSourcePacketPrompt,
  SOURCE_PACKET_RESPONSE_SCHEMA,
  type SourcePacketPromptInput,
  type SourcePacketPromptSource,
} from "@/lib/missions/prompts/sourcePacketPrompt";
import {
  createSourcePacket,
  getSourcePacketByHash,
} from "@/lib/missions/repositories/sourcePacketRepo";
import type {
  AuthoritySourceType,
  EvidenceTier,
  TimelinessClass,
  TrendStatus,
} from "@/lib/missions/types/common";
import type {
  AuthorityScoringAuditEntry,
  MarketerRelevanceHint,
  PacketClaim,
  PacketContradiction,
  PacketUncertainty,
  SourcePacket,
  SourcePacketDiagnostics,
  SourcePacketSourceItem,
  TopicCandidate,
} from "@/lib/missions/types/sourcePacket";

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI();
  }

  return openaiClient;
}

export interface ContentLakeRow {
  id: string;
  content_type: "video" | "article";
  external_id: string;
  source: string;
  source_url: string;
  title: string;
  description: string | null;
  creator_name: string | null;
  published_at: string | null;
  duration_seconds: number | null;
  article_word_count: number | null;
  article_text?: string | null;
  quality_score: number | null;
  topics: string[];
  editorial_note: string | null;
  indexed_at: string;
}

interface SignalRow {
  id: string;
  source: string;
  source_id: string | null;
  source_url: string | null;
  title: string;
  summary: string | null;
  raw_data: Record<string, unknown> | null;
  created_at: string;
}

interface PacketAnalysisResult {
  why_now: {
    summary: string;
    change_type:
      | "new-release"
      | "feature-maturation"
      | "cost-shift"
      | "workflow-adoption"
      | "competitive-pressure"
      | "evergreen-relevance";
    what_changed: string[];
    what_is_ready_now: string[];
    what_is_noise_or_not_yet_proven: string[];
    expiry_reason: string;
  };
  key_claims: Array<{
    statement: string;
    claim_type: PacketClaim["claimType"];
    confidence: number;
    importance: PacketClaim["importance"];
    source_indexes: number[];
  }>;
  contradictions: Array<{
    summary: string;
    severity: PacketContradiction["severity"];
    conflicting_claim_indexes: number[];
    resolution_status: PacketContradiction["resolutionStatus"];
    recommended_editorial_stance: string;
  }>;
  uncertainties: Array<{
    summary: string;
    reason: PacketUncertainty["reason"];
    severity: PacketUncertainty["severity"];
    affected_claim_indexes: number[];
  }>;
  marketer_relevance_hints: Array<{
    launch_domain: MarketerRelevanceHint["launchDomain"];
    workflow_slug: MarketerRelevanceHint["workflowSlug"];
    impact_type: MarketerRelevanceHint["impactType"];
    why_marketers_should_care: string;
    example_use_case: string;
    missionable: boolean;
    suggested_artifact: string | null;
  }>;
}

export interface SourcePacketAssemblerOptions {
  maxContentItems?: number;
  maxSignalItems?: number;
}

interface OfficialCreatorRule {
  authorityKey: string;
  creatorAliases: string[];
  allowedTopicSlugs: string[];
}

interface TopicProfile {
  phrases: string[];
}

interface AuthorityAssessment {
  authoritySourceType: AuthoritySourceType;
  matchedAuthorityKey: string | null;
  authorityRationale: string;
}

export interface RankedContentCandidate {
  row: ContentLakeRow;
  sourceKind: SourcePacketSourceItem["sourceKind"];
  evidenceTier: EvidenceTier;
  authority: AuthorityAssessment;
  freshness: SourcePacketSourceItem["freshness"];
  coherenceScore: number;
  genericTutorial: boolean;
  workflowSurface: string;
  selectionBucket: 1 | 2 | 3 | 4;
}

export interface CandidatePoolPreview {
  timelinessClass: TimelinessClass;
  lookbackDays: number;
  rankedCandidates: RankedContentCandidate[];
  selectedCandidates: RankedContentCandidate[];
}

const SOURCE_PACKET_ASSEMBLY_VERSION = "source-readiness-fix-v1";
const GENERIC_TUTORIAL_PATTERNS = [
  /hacks?/i,
  /things?\s+you\s+don'?t\s+know/i,
  /beginner/i,
  /full\s+guide/i,
  /build\s+anything/i,
  /tutorial\s+you\s+need/i,
  /amazing\s+things/i,
];
const TOPIC_PROFILE_OVERRIDES: Record<string, string[]> = {
  "prompt-engineering": ["prompt engineering"],
  "claude-code": ["claude code"],
  "model-context-protocol": ["model context protocol", "mcp"],
};
const OFFICIAL_CREATOR_RULES: OfficialCreatorRule[] = [
  {
    authorityKey: "anthropic",
    creatorAliases: ["anthropic"],
    allowedTopicSlugs: ["prompt-engineering", "claude-code", "model-context-protocol"],
  },
  {
    authorityKey: "openai",
    creatorAliases: ["openai"],
    allowedTopicSlugs: ["model-context-protocol"],
  },
  {
    authorityKey: "github",
    creatorAliases: ["github"],
    allowedTopicSlugs: ["github-copilot"],
  },
  {
    authorityKey: "visual-studio-code",
    creatorAliases: ["visual studio code"],
    allowedTopicSlugs: ["github-copilot"],
  },
];
const MAX_GENERIC_TUTORIALS = 2;
const MAX_SOURCES_PER_CREATOR = 2;

/** Assemble and persist a canonical source packet for a topic candidate. */
export async function assembleSourcePacket(
  candidate: TopicCandidate,
  generationRunId: string,
  options: SourcePacketAssemblerOptions = {},
): Promise<SourcePacket> {
  const contentPreview = await previewTopicCandidatePool(candidate, options);
  const signalRows = await fetchSignalRows(candidate.clusterId, options.maxSignalItems ?? 3);
  const timelinessClass = inferTimelinessClass([
    ...contentPreview.selectedCandidates.map((candidateItem) => candidateItem.row.published_at),
    ...signalRows.map((row) => row.created_at),
  ]);
  const lookbackDays = getLookbackDays(timelinessClass);
  const sourceItems = buildSourceItems(
    contentPreview.selectedCandidates,
    signalRows,
    lookbackDays,
  );
  const packetHash = buildPacketHash(candidate, sourceItems);
  const existing = await getSourcePacketByHash(candidate.topicSlug, packetHash);

  if (existing) {
    return existing;
  }

  let analysisMode: SourcePacketDiagnostics["analysisMode"] = "llm";
  let rawAnalysis: PacketAnalysisResult;
  if (sourceItems.length === 0) {
    analysisMode = "fallback";
    rawAnalysis = buildFallbackAnalysis(candidate, sourceItems);
  } else {
    try {
      rawAnalysis = await requestPacketAnalysis(candidate, sourceItems);
    } catch {
      analysisMode = "fallback";
      rawAnalysis = buildFallbackAnalysis(candidate, sourceItems);
    }
  }

  const analysis = normalizePacketAnalysis(rawAnalysis, candidate, sourceItems);

  const now = new Date();
  const ttlHours = getRecommendedTtlHours(timelinessClass);
  const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000).toISOString();
  const keyClaims = buildPacketClaims(analysis, sourceItems);
  const contradictions = buildPacketContradictions(analysis, keyClaims);
  const uncertainties = buildPacketUncertainties(analysis, keyClaims);
  const marketerRelevanceHints = buildMarketerRelevanceHints(analysis);
  const enrichedSourceItems = attachClaimsToSourceItems(sourceItems, keyClaims);
  const highestEvidenceTier = getHighestEvidenceTier(enrichedSourceItems);
  const highCredibilitySourceCount = enrichedSourceItems.filter(
    (item) => item.credibility.tier === "high",
  ).length;
  const lowCredibilitySourceCount = enrichedSourceItems.filter(
    (item) => item.credibility.tier === "low",
  ).length;
  const diagnostics = buildPacketDiagnostics(
    enrichedSourceItems,
    contentPreview.selectedCandidates,
    analysisMode,
  );

  const packet: SourcePacket = {
    packetId: randomUUID(),
    schemaVersion: "source_packet_v1",
    packetHash,
    status: "assembled",
    readiness: {
      state: "tracking_only",
      rationale: "Pending readiness evaluation.",
      blockers: [],
      nextReviewAt: null,
    },
    topic: {
      topicId: candidate.topicId,
      topicSlug: candidate.topicSlug,
      topicName: candidate.topicName,
      topicCategory: candidate.topicCategory,
      clusterId: candidate.clusterId,
      heatScoreSnapshot: candidate.heatScoreSnapshot,
      signalCount7d: candidate.signalCount7d,
      sourceDiversity7d: candidate.sourceDiversity7d,
    },
    lineage: {
      inputSignalIds: signalRows.map((row) => row.id),
      inputContentIds: contentPreview.selectedCandidates.map((candidateItem) => candidateItem.row.id),
      generationRunId,
    },
    sourceWindow: {
      startAt: new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000).toISOString(),
      endAt: now.toISOString(),
      lookbackDays,
      timelinessClass,
      recommendedTtlHours: ttlHours,
    },
    freshness: {
      recencyScore: computeRecencyScore(enrichedSourceItems),
      velocityScore: computeVelocityScore(candidate),
      noveltyScore: computeNoveltyScore(candidate, enrichedSourceItems),
      trendStatus: computeTrendStatus(candidate),
      staleAfter: expiresAt,
    },
    credibility: {
      overallScore: computeOverallCredibility(enrichedSourceItems),
      highestEvidenceTier,
      highCredibilitySourceCount,
      lowCredibilitySourceCount,
      vendorOnly: isVendorOnly(enrichedSourceItems),
    },
    whyNow: {
      summary: analysis.why_now.summary,
      changeType: analysis.why_now.change_type,
      whatChanged: analysis.why_now.what_changed,
      whatIsReadyNow: analysis.why_now.what_is_ready_now,
      whatIsNoiseOrNotYetProven: analysis.why_now.what_is_noise_or_not_yet_proven,
      expiryReason: analysis.why_now.expiry_reason,
    },
    keyClaims,
    contradictions,
    uncertainties,
    marketerRelevanceHints,
    sourceItems: enrichedSourceItems,
    exclusions: [],
    quality: {
      completenessScore: computeCompletenessScore(
        enrichedSourceItems,
        keyClaims,
        marketerRelevanceHints,
        analysis.why_now.summary,
      ),
      usableForGeneration: false,
      rejectReasons: [],
      reviewerNotes: [],
      diagnostics,
    },
    assembledAt: now.toISOString(),
    expiresAt,
  };

  return createSourcePacket(packet);
}

/** Preview the authoritative/coherent content pool that would feed packet assembly. */
export async function previewTopicCandidatePool(
  candidate: TopicCandidate,
  options: SourcePacketAssemblerOptions = {},
): Promise<CandidatePoolPreview> {
  const maxContentItems = options.maxContentItems ?? 6;
  const selectionPoolLimit = Math.max(maxContentItems * 2, 12);
  const contentRows = await fetchContentRows(candidate.topicSlug, selectionPoolLimit);
  const timelinessClass = inferTimelinessClass(contentRows.map((row) => row.published_at));
  const lookbackDays = getLookbackDays(timelinessClass);
  const topicProfile = buildTopicProfile(candidate.topicSlug, candidate.topicName);
  const rankedCandidates = buildRankedContentCandidates(contentRows, topicProfile, lookbackDays);
  const selectedCandidates = selectRankedContentCandidates(rankedCandidates, maxContentItems);

  return {
    timelinessClass,
    lookbackDays,
    rankedCandidates,
    selectedCandidates,
  };
}

async function fetchContentRows(
  topicSlug: string,
  limit: number,
): Promise<ContentLakeRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("fp_content_lake")
    .select(
      "id, content_type, external_id, source, source_url, title, description, creator_name, published_at, duration_seconds, article_word_count, article_text, quality_score, topics, editorial_note, indexed_at",
    )
    .eq("status", "active")
    .overlaps("topics", [topicSlug])
    .order("quality_score", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[missions/sourcePacketAssembler] content fetch failed:", error);
    return [];
  }

  return (data ?? []) as ContentLakeRow[];
}

async function fetchSignalRows(
  clusterId: string | null,
  limit: number,
): Promise<SignalRow[]> {
  if (!clusterId) return [];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("fp_signals")
    .select("id, source, source_id, source_url, title, summary, raw_data, created_at")
    .eq("topic_cluster_id", clusterId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[missions/sourcePacketAssembler] signal fetch failed:", error);
    return [];
  }

  return (data ?? []) as SignalRow[];
}

function inferTimelinessClass(dates: Array<string | null>): TimelinessClass {
  const ageDays = dates
    .filter((value): value is string => Boolean(value))
    .map((value) => diffDays(value))
    .filter((value) => value !== null) as number[];

  if (ageDays.length === 0) return "evergreen-foundation";

  const sorted = [...ageDays].sort((left, right) => left - right);
  const median = sorted[Math.floor(sorted.length / 2)];

  if (median <= 7) return "breaking-update";
  if (median <= 30) return "emerging-practice";
  if (median <= 90) return "current-standard";
  return "evergreen-foundation";
}

function getLookbackDays(timelinessClass: TimelinessClass): number {
  switch (timelinessClass) {
    case "breaking-update":
      return 7;
    case "emerging-practice":
      return 21;
    case "current-standard":
      return 45;
    default:
      return 90;
  }
}

function getRecommendedTtlHours(timelinessClass: TimelinessClass): number {
  switch (timelinessClass) {
    case "breaking-update":
      return 24 * 7;
    case "emerging-practice":
      return 24 * 21;
    case "current-standard":
      return 24 * 45;
    default:
      return 24 * 90;
  }
}

function buildSourceItems(
  contentCandidates: RankedContentCandidate[],
  signalRows: SignalRow[],
  lookbackDays: number,
): SourcePacketSourceItem[] {
  const contentItems = contentCandidates.map((candidate, index) => {
    const row = candidate.row;
    const excerptText = buildContentExcerpt(row);
    const credibility = buildSourceCredibility(
      safeDomain(row.source_url),
      row.quality_score,
      candidate.evidenceTier,
      candidate.authority,
    );

    return {
      sourceItemId: `src-${index + 1}-${row.id}`,
      sourceKind: candidate.sourceKind,
      evidenceTier: candidate.evidenceTier,
      stance: "supports" as const,
      url: row.source_url,
      externalId: row.external_id,
      title: row.title,
      creatorOrPublication: row.creator_name,
      domain: safeDomain(row.source_url),
      publishedAt: row.published_at,
      discoveredAt: row.indexed_at,
      indexedAt: row.indexed_at,
      contentFormat:
        row.content_type === "video"
          ? ("video" as const)
          : ("article" as const),
      durationSeconds: row.duration_seconds,
      wordCount: row.article_word_count,
      summary: (row.editorial_note ?? row.description ?? row.title).slice(0, 500),
      topics: row.topics ?? [],
      freshness: buildSourceFreshness(row.published_at ?? row.indexed_at, lookbackDays),
      credibility,
      excerpts: [
        {
          excerptId: `excerpt-${index + 1}-1`,
          text: excerptText,
          location:
            row.content_type === "video"
              ? { kind: "timestamp" as const, startSeconds: 0, endSeconds: 60 }
              : { kind: "paragraph" as const, paragraphIndex: 0 },
          usageRole: "capability-evidence" as const,
        },
      ],
      claims: [],
    };
  });

  const signalItems = signalRows.map((row, index) => {
    const sourceIndex = contentItems.length + index + 1;
    const domain = safeDomain(row.source_url);
    const sourceKind: SourcePacketSourceItem["sourceKind"] =
      row.source === "reddit"
        ? "reddit_thread"
        : row.source === "hn"
          ? "hn_post"
          : row.source === "rss"
            ? "rss_article"
            : "youtube_video";

    const evidenceTier: EvidenceTier =
      row.source === "reddit" || row.source === "hn" ? "community" : "secondary";

    return {
      sourceItemId: `src-${sourceIndex}-${row.id}`,
      sourceKind,
      evidenceTier,
      stance: "contextualizes" as const,
      url: row.source_url ?? `signal:${row.id}`,
      externalId: row.source_id,
      title: row.title,
      creatorOrPublication: (row.raw_data?.creator as string | undefined) ?? row.source,
      domain,
      publishedAt: row.created_at,
      discoveredAt: row.created_at,
      indexedAt: null,
      contentFormat:
        sourceKind === "youtube_video"
          ? ("video" as const)
          : sourceKind === "rss_article"
            ? ("article" as const)
            : ("thread" as const),
      durationSeconds: null,
      wordCount: null,
      summary: (row.summary ?? row.title).slice(0, 500),
      topics: Array.isArray(row.raw_data?.topics)
        ? (row.raw_data?.topics as string[])
        : [],
      freshness: buildSourceFreshness(row.created_at, lookbackDays),
      credibility: buildSourceCredibility(domain, 55, evidenceTier, {
        authoritySourceType: isOfficialDomain(domain) ? "official_domain" : "community",
        matchedAuthorityKey: isOfficialDomain(domain) ? domain : null,
        authorityRationale: isOfficialDomain(domain)
          ? "Official or vendor-controlled source."
          : "Signal or secondary source with limited authority.",
      }),
      excerpts: [
        {
          excerptId: `excerpt-${sourceIndex}-1`,
          text: (row.summary ?? row.title).slice(0, 280),
          location: { kind: "section" as const, label: "signal-summary" },
          usageRole: "timeliness" as const,
        },
      ],
      claims: [],
    };
  });

  return [...contentItems, ...signalItems];
}

function buildTopicProfile(topicSlug: string, topicName: string): TopicProfile {
  const phrases = new Set<string>();
  const normalizedSlug = normalizeSearchText(topicSlug.replace(/-/g, " "));
  const normalizedName = normalizeSearchText(topicName);

  if (normalizedSlug.length > 0) {
    phrases.add(normalizedSlug);
  }
  if (normalizedName.length > 0) {
    phrases.add(normalizedName);
  }
  for (const override of TOPIC_PROFILE_OVERRIDES[topicSlug] ?? []) {
    const normalized = normalizeSearchText(override);
    if (normalized.length > 0) {
      phrases.add(normalized);
    }
  }

  return {
    phrases: [...phrases],
  };
}

function buildRankedContentCandidates(
  contentRows: ContentLakeRow[],
  topicProfile: TopicProfile,
  lookbackDays: number,
): RankedContentCandidate[] {
  return contentRows
    .map((row) => {
      const authority = assessAuthority(row, topicProfile);
      const evidenceTier = inferContentEvidenceTier(row, authority);
      const sourceKind = inferContentSourceKind(row, authority);
      const freshness = buildSourceFreshness(row.published_at ?? row.indexed_at, lookbackDays);
      const coherenceScore = computeCandidateCoherenceScore(row, topicProfile);
      const genericTutorial = isGenericTutorial(row);
      const workflowSurface = classifyWorkflowSurface(row);
      const selectionBucket = determineSelectionBucket(
        authority,
        coherenceScore,
        genericTutorial,
      );

      return {
        row,
        sourceKind,
        evidenceTier,
        authority,
        freshness,
        coherenceScore,
        genericTutorial,
        workflowSurface,
        selectionBucket,
      } satisfies RankedContentCandidate;
    })
    .sort(compareRankedCandidates);
}

function selectRankedContentCandidates(
  rankedCandidates: RankedContentCandidate[],
  maxContentItems: number,
): RankedContentCandidate[] {
  const selected: RankedContentCandidate[] = [];
  const creatorCounts = new Map<string, number>();
  let genericTutorialCount = 0;

  for (const candidate of rankedCandidates) {
    if (selected.length >= maxContentItems) {
      break;
    }

    const creatorKey = normalizeSearchText(candidate.row.creator_name ?? "");
    if (creatorKey) {
      const count = creatorCounts.get(creatorKey) ?? 0;
      if (count >= MAX_SOURCES_PER_CREATOR) {
        continue;
      }
    }

    if (candidate.genericTutorial && genericTutorialCount >= MAX_GENERIC_TUTORIALS) {
      continue;
    }

    if (candidate.coherenceScore <= 0) {
      continue;
    }

    selected.push(candidate);
    if (creatorKey) {
      creatorCounts.set(creatorKey, (creatorCounts.get(creatorKey) ?? 0) + 1);
    }
    if (candidate.genericTutorial) {
      genericTutorialCount += 1;
    }
  }

  const hasAuthoritativeInPool = rankedCandidates.some(
    (candidate) => candidate.authority.authoritySourceType !== "community",
  );
  const hasAuthoritativeSelected = selected.some(
    (candidate) => candidate.authority.authoritySourceType !== "community",
  );

  if (hasAuthoritativeInPool && !hasAuthoritativeSelected) {
    const firstAuthoritative = rankedCandidates.find(
      (candidate) => candidate.authority.authoritySourceType !== "community" && candidate.coherenceScore > 0,
    );
    if (firstAuthoritative) {
      const replaceIndex = selected.findIndex((candidate) => candidate.genericTutorial);
      if (replaceIndex >= 0) {
        selected.splice(replaceIndex, 1, firstAuthoritative);
      } else if (selected.length < maxContentItems) {
        selected.push(firstAuthoritative);
      } else if (selected.length > 0) {
        selected[selected.length - 1] = firstAuthoritative;
      }
    }
  }

  return selected.slice(0, maxContentItems);
}

function buildContentExcerpt(row: ContentLakeRow): string {
  const articleText = row.article_text?.slice(0, 280);
  if (articleText) return articleText;
  if (row.editorial_note) return row.editorial_note.slice(0, 280);
  if (row.description) return row.description.slice(0, 280);
  return row.title;
}

function inferContentSourceKind(
  row: ContentLakeRow,
  authority: AuthorityAssessment,
): SourcePacketSourceItem["sourceKind"] {
  if (row.content_type === "video") return "youtube_video";

  const domain = safeDomain(row.source_url);
  if (authority.authoritySourceType === "official_domain" || isOfficialDomain(domain)) {
    return /release|announce|launch|update/i.test(row.title)
      ? "product_release"
      : "official_docs";
  }

  return "rss_article";
}

function inferContentEvidenceTier(
  row: ContentLakeRow,
  authority: AuthorityAssessment,
): EvidenceTier {
  const domain = safeDomain(row.source_url);
  if (
    row.content_type === "article" &&
    (authority.authoritySourceType === "official_domain" || isOfficialDomain(domain))
  ) {
    return "primary";
  }
  return "secondary";
}

function buildSourceFreshness(
  publishedAt: string | null,
  lookbackDays: number,
): SourcePacketSourceItem["freshness"] {
  const ageDays = diffDays(publishedAt);
  if (ageDays === null) {
    return {
      ageDays: null,
      withinWindow: false,
      freshnessScore: 35,
    };
  }

  const withinWindow = ageDays <= lookbackDays;
  const freshnessScore = Math.max(
    5,
    Math.min(100, Math.round(((lookbackDays - ageDays) / lookbackDays) * 100)),
  );

  return { ageDays, withinWindow, freshnessScore };
}

function buildSourceCredibility(
  domain: string | null,
  qualityScore: number | null,
  evidenceTier: EvidenceTier,
  authority: AuthorityAssessment,
): SourcePacketSourceItem["credibility"] {
  const normalizedQuality = qualityScore ?? 55;
  const baseScore = Math.max(
    25,
    Math.min(
      100,
      Math.round(
        normalizedQuality * 0.6 +
          (isOfficialDomain(domain) ? 25 : 0) +
          (evidenceTier === "primary" ? 10 : evidenceTier === "secondary" ? 0 : -10),
      ),
    ),
  );
  const authorityBonus =
    authority.authoritySourceType === "official_domain"
      ? 25
      : authority.authoritySourceType === "official_creator"
        ? 22
        : 0;
  let score = Math.max(
    25,
    Math.min(
      100,
      Math.round(
        normalizedQuality * 0.6 +
          authorityBonus +
          (evidenceTier === "primary" ? 10 : evidenceTier === "secondary" ? 0 : -10),
      ),
    ),
  );
  let floorApplied = false;

  if (
    authority.authoritySourceType === "official_creator" &&
    normalizedQuality >= 85 &&
    score < 80
  ) {
    score = 80;
    floorApplied = true;
  }

  const baseTier = getCredibilityTier(baseScore);
  const tier = getCredibilityTier(score);

  return {
    tier,
    score,
    authorityRationale: authority.authorityRationale,
    selfPromoRisk: authority.authoritySourceType === "community" ? "low" : "high",
    authoritySourceType: authority.authoritySourceType,
    matchedAuthorityKey: authority.matchedAuthorityKey,
    baseScore,
    baseTier,
    floorApplied,
  };
}

function assessAuthority(
  row: ContentLakeRow,
  topicProfile: TopicProfile,
): AuthorityAssessment {
  const domain = safeDomain(row.source_url);
  if (isOfficialDomain(domain)) {
    return {
      authoritySourceType: "official_domain",
      matchedAuthorityKey: domain,
      authorityRationale: "Official or vendor-controlled source.",
    };
  }

  if (row.content_type === "video") {
    const creator = normalizeSearchText(row.creator_name ?? "");
    const matchingRule = OFFICIAL_CREATOR_RULES.find((rule) => {
      if (!rule.allowedTopicSlugs.some((slug) => topicProfile.phrases.includes(normalizeSearchText(slug.replace(/-/g, " "))))) {
        return false;
      }

      return rule.creatorAliases.some((alias) => normalizeSearchText(alias) === creator);
    });

    if (matchingRule) {
      return {
        authoritySourceType: "official_creator",
        matchedAuthorityKey: matchingRule.authorityKey,
        authorityRationale: "Official creator on a platform-hosted source.",
      };
    }
  }

  return {
    authoritySourceType: "community",
    matchedAuthorityKey: null,
    authorityRationale:
      (row.quality_score ?? 55) >= 70
        ? "High-quality indexed source."
        : "Signal or secondary source with limited authority.",
  };
}

function computeCandidateCoherenceScore(
  row: ContentLakeRow,
  topicProfile: TopicProfile,
): number {
  const searchable = normalizeSearchText(
    [row.title, row.description ?? "", row.editorial_note ?? "", ...(row.topics ?? [])].join(" "),
  );
  const hits = topicProfile.phrases.filter((phrase) => phrase.length > 0 && searchable.includes(phrase))
    .length;

  if (hits === 0) {
    return 0;
  }

  return roundToTwo(Math.min(1, hits / Math.max(1, topicProfile.phrases.length)));
}

function isGenericTutorial(row: ContentLakeRow): boolean {
  const text = `${row.title} ${row.description ?? ""}`;
  return GENERIC_TUTORIAL_PATTERNS.some((pattern) => pattern.test(text));
}

function determineSelectionBucket(
  authority: AuthorityAssessment,
  coherenceScore: number,
  genericTutorial: boolean,
): RankedContentCandidate["selectionBucket"] {
  if (coherenceScore <= 0) {
    return 4;
  }

  if (authority.authoritySourceType === "official_domain") {
    return 1;
  }

  if (authority.authoritySourceType === "official_creator") {
    return 2;
  }

  return genericTutorial ? 4 : 3;
}

function compareRankedCandidates(
  left: RankedContentCandidate,
  right: RankedContentCandidate,
): number {
  if (left.selectionBucket !== right.selectionBucket) {
    return left.selectionBucket - right.selectionBucket;
  }

  if (left.coherenceScore !== right.coherenceScore) {
    return right.coherenceScore - left.coherenceScore;
  }

  if (left.freshness.freshnessScore !== right.freshness.freshnessScore) {
    return right.freshness.freshnessScore - left.freshness.freshnessScore;
  }

  return (right.row.quality_score ?? 0) - (left.row.quality_score ?? 0);
}

function classifyWorkflowSurface(row: ContentLakeRow): string {
  const text = `${row.title} ${row.description ?? ""} ${(row.topics ?? []).join(" ")}`.toLowerCase();

  if (/prompt/.test(text)) return "prompting";
  if (/code|coding|developer|app|mcp/.test(text)) return "coding";
  if (/workflow|automation|ops|process/.test(text)) return "workflow";
  if (/message|copy|brand|position/.test(text)) return "messaging";
  if (/research|synthesis|insight/.test(text)) return "research";
  if (/image|design|creative|visual/.test(text)) return "creative";
  return "generic";
}

function getCredibilityTier(score: number): SourcePacketSourceItem["credibility"]["tier"] {
  if (score >= 80) return "high";
  if (score >= 60) return "medium";
  return "low";
}

async function requestPacketAnalysis(
  candidate: TopicCandidate,
  sourceItems: SourcePacketSourceItem[],
): Promise<PacketAnalysisResult> {
  const promptSources: SourcePacketPromptSource[] = sourceItems.map((item, index) => ({
    source_index: index + 1,
    source_item_id: item.sourceItemId,
    title: item.title,
    creator_or_publication: item.creatorOrPublication,
    published_at: item.publishedAt,
    source_kind: item.sourceKind,
    evidence_tier: item.evidenceTier,
    summary: item.summary,
    topics: item.topics,
    editorial_note: item.claims[0]?.statement ?? null,
    excerpt: item.excerpts[0]?.text ?? null,
  }));

  const promptInput: SourcePacketPromptInput = {
    topic_name: candidate.topicName,
    topic_slug: candidate.topicSlug,
    topic_category: candidate.topicCategory,
    heat_score_snapshot: candidate.heatScoreSnapshot,
    signal_count_7d: candidate.signalCount7d,
    source_diversity_7d: candidate.sourceDiversity7d,
    sources: promptSources,
  };

  const prompt = buildSourcePacketPrompt(promptInput);
  const response = await getOpenAIClient().chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    max_tokens: 1800,
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: SOURCE_PACKET_RESPONSE_SCHEMA,
    },
  });

  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new Error("Empty packet analysis response");
  }

  return JSON.parse(text) as PacketAnalysisResult;
}

function buildFallbackAnalysis(
  candidate: TopicCandidate,
  sourceItems: SourcePacketSourceItem[],
): PacketAnalysisResult {
  const topSources = sourceItems.slice(0, 3);
  const launchDomain = guessLaunchDomainFromSources(topSources);
  const workflowSlug = launchDomain;

  return {
    why_now: {
      summary:
        candidate.heatScoreSnapshot && candidate.heatScoreSnapshot >= 0.5
          ? `${candidate.topicName} is showing enough recent signal to warrant a practical first rep.`
          : `${candidate.topicName} has enough accumulated evidence to support a practical marketer rep.`,
      change_type:
        candidate.heatScoreSnapshot && candidate.heatScoreSnapshot >= 0.5
          ? "workflow-adoption"
          : "evergreen-relevance",
      what_changed: topSources.map((source) => source.title).slice(0, 3),
      what_is_ready_now: [
        "A focused first use case can be tested in one session.",
        "Marketers can evaluate the workflow without deep technical setup.",
      ],
      what_is_noise_or_not_yet_proven: [
        "Long-term strategic advantage is still unclear.",
      ],
      expiry_reason: "Re-evaluate when the source mix or topic heat shifts materially.",
    },
    key_claims: topSources.map((source, index) => ({
      statement: source.summary,
      claim_type: index === 0 ? "workflow-shift" : "capability",
      confidence: 0.65,
      importance: index === 0 ? "high" : "medium",
      source_indexes: [index + 1],
    })),
    contradictions: [],
    uncertainties: [
      {
        summary: "The available source base is still weighted toward secondary coverage.",
        reason: "low_source_count",
        severity: "medium",
        affected_claim_indexes: [1],
      },
    ],
    marketer_relevance_hints: [
      {
        launch_domain: launchDomain,
        workflow_slug: workflowSlug,
        impact_type: "speed",
        why_marketers_should_care:
          "This can compress the time it takes to translate a new capability into a practical workflow.",
        example_use_case: `Use ${candidate.topicName} to produce a marketer-ready first output instead of starting with scattered research.`,
        missionable: topSources.length >= 2,
        suggested_artifact: launchDomain === "positioning-messaging" ? "message-matrix" : "audience-brief",
      },
    ],
  };
}

function normalizePacketAnalysis(
  analysis: PacketAnalysisResult,
  candidate: TopicCandidate,
  sourceItems: SourcePacketSourceItem[],
): PacketAnalysisResult {
  const fallback = buildFallbackAnalysis(candidate, sourceItems);
  const normalizedWhatChanged = sanitizeStringArray(
    analysis.why_now.what_changed,
  );
  const normalizedReadyNow = sanitizeStringArray(
    analysis.why_now.what_is_ready_now,
  );
  const normalizedNoise = sanitizeStringArray(
    analysis.why_now.what_is_noise_or_not_yet_proven,
  );

  const normalizedClaims = analysis.key_claims
    .map((claim, index) => ({
      ...claim,
      statement:
        normalizeText(claim.statement) ??
        sourceItems[index]?.summary ??
        fallback.key_claims[index % fallback.key_claims.length]?.statement ??
        `${candidate.topicName} is worth evaluating through a concrete marketer rep.`,
      source_indexes:
        claim.source_indexes.length > 0
          ? claim.source_indexes
          : [Math.min(index + 1, Math.max(sourceItems.length, 1))],
    }))
    .filter((claim) => claim.statement.trim().length > 0);

  const normalizedHints = analysis.marketer_relevance_hints
    .map((hint, index) => ({
      ...hint,
      why_marketers_should_care:
        normalizeText(hint.why_marketers_should_care) ??
        fallback.marketer_relevance_hints[index % fallback.marketer_relevance_hints.length]
          ?.why_marketers_should_care ??
        "This should save a marketer time by compressing scattered research into a practical first move.",
      example_use_case:
        normalizeText(hint.example_use_case) ??
        fallback.marketer_relevance_hints[index % fallback.marketer_relevance_hints.length]
          ?.example_use_case ??
        `Use ${candidate.topicName} to produce a marketer-ready first output in one session.`,
    }))
    .filter(
      (hint) =>
        hint.why_marketers_should_care.trim().length > 0 &&
        hint.example_use_case.trim().length > 0,
    );

  return {
    why_now: {
      summary:
        normalizeText(analysis.why_now.summary) ??
        fallback.why_now.summary,
      change_type: analysis.why_now.change_type,
      what_changed:
        normalizedWhatChanged.length > 0
          ? normalizedWhatChanged
          : fallback.why_now.what_changed,
      what_is_ready_now:
        normalizedReadyNow.length > 0
          ? normalizedReadyNow
          : fallback.why_now.what_is_ready_now,
      what_is_noise_or_not_yet_proven:
        normalizedNoise.length > 0
          ? normalizedNoise
          : fallback.why_now.what_is_noise_or_not_yet_proven,
      expiry_reason:
        normalizeMeaningfulText(analysis.why_now.expiry_reason) ??
        fallback.why_now.expiry_reason,
    },
    key_claims:
      normalizedClaims.length > 0 ? normalizedClaims : fallback.key_claims,
    contradictions: analysis.contradictions.map((contradiction) => ({
      ...contradiction,
      summary:
        normalizeText(contradiction.summary) ??
        "Conflicting evidence requires a cautious editorial stance.",
      recommended_editorial_stance:
        normalizeText(contradiction.recommended_editorial_stance) ??
        "Acknowledge the contradiction and avoid overclaiming certainty.",
    })),
    uncertainties: analysis.uncertainties.map((uncertainty) => ({
      ...uncertainty,
      summary:
        normalizeText(uncertainty.summary) ??
        "The current evidence base is still incomplete.",
    })),
    marketer_relevance_hints:
      normalizedHints.length > 0
        ? normalizedHints
        : fallback.marketer_relevance_hints,
  };
}

function buildPacketClaims(
  analysis: PacketAnalysisResult,
  sourceItems: SourcePacketSourceItem[],
): PacketClaim[] {
  return analysis.key_claims.map((claim, index) => {
    const sourceItemIds = claim.source_indexes
      .map((value) => resolveItemFromIndex(sourceItems, value))
      .filter((item): item is SourcePacketSourceItem => item !== null)
      .map((item) => item.sourceItemId);
    const excerptIds = sourceItemIds
      .flatMap((sourceItemId) => sourceItems.find((item) => item.sourceItemId === sourceItemId)?.excerpts ?? [])
      .map((excerpt) => excerpt.excerptId);

    return {
      claimId: `claim-${index + 1}`,
      statement: claim.statement,
      claimType: claim.claim_type,
      confidence: clamp(claim.confidence, 0, 1),
      importance: claim.importance,
      sourceItemIds,
      excerptIds,
    };
  });
}

function buildPacketContradictions(
  analysis: PacketAnalysisResult,
  keyClaims: PacketClaim[],
): PacketContradiction[] {
  return analysis.contradictions.map((contradiction, index) => ({
    contradictionId: `contradiction-${index + 1}`,
    summary: contradiction.summary,
    conflictingClaimIds: contradiction.conflicting_claim_indexes
      .map((value) => resolveItemFromIndex(keyClaims, value))
      .filter((claim): claim is PacketClaim => claim !== null)
      .map((claim) => claim.claimId),
    severity: contradiction.severity,
    resolutionStatus: contradiction.resolution_status,
    recommendedEditorialStance: contradiction.recommended_editorial_stance,
  }));
}

function buildPacketUncertainties(
  analysis: PacketAnalysisResult,
  keyClaims: PacketClaim[],
): PacketUncertainty[] {
  return analysis.uncertainties.map((uncertainty, index) => ({
    uncertaintyId: `uncertainty-${index + 1}`,
    summary: uncertainty.summary,
    affectedClaimIds: uncertainty.affected_claim_indexes
      .map((value) => resolveItemFromIndex(keyClaims, value))
      .filter((claim): claim is PacketClaim => claim !== null)
      .map((claim) => claim.claimId),
    reason: uncertainty.reason,
    severity: uncertainty.severity,
  }));
}

function buildMarketerRelevanceHints(
  analysis: PacketAnalysisResult,
): MarketerRelevanceHint[] {
  return analysis.marketer_relevance_hints.map((hint, index) => ({
    hintId: `hint-${index + 1}`,
    launchDomain: hint.launch_domain,
    workflowSlug: hint.workflow_slug,
    impactType: hint.impact_type,
    whyMarketersShouldCare: hint.why_marketers_should_care,
    exampleUseCase: hint.example_use_case,
    missionable: hint.missionable,
    suggestedArtifact: hint.suggested_artifact,
  }));
}

function attachClaimsToSourceItems(
  sourceItems: SourcePacketSourceItem[],
  claims: PacketClaim[],
): SourcePacketSourceItem[] {
  return sourceItems.map((item) => ({
    ...item,
    claims: claims
      .filter((claim) => claim.sourceItemIds.includes(item.sourceItemId))
      .map((claim) => ({
        claimId: claim.claimId,
        statement: claim.statement,
        confidence: claim.confidence,
        actionable: claim.claimType !== "limitation",
        excerptIds: item.excerpts.map((excerpt) => excerpt.excerptId),
      })),
  }));
}

function buildPacketHash(
  candidate: TopicCandidate,
  sourceItems: SourcePacketSourceItem[],
): string {
  const payload = JSON.stringify({
    version: SOURCE_PACKET_ASSEMBLY_VERSION,
    topicSlug: candidate.topicSlug,
    sources: sourceItems.map((item) => ({
      sourceItemId: item.sourceItemId,
      url: item.url,
      publishedAt: item.publishedAt,
      title: item.title,
    })),
  });

  return createHash("sha256").update(payload).digest("hex");
}

function buildPacketDiagnostics(
  sourceItems: SourcePacketSourceItem[],
  selectedCandidates: RankedContentCandidate[],
  analysisMode: SourcePacketDiagnostics["analysisMode"],
): SourcePacketDiagnostics {
  const authoritativeSourceCount = sourceItems.filter(
    (item) => item.credibility.authoritySourceType !== "community",
  ).length;
  const officialDomainCount = sourceItems.filter(
    (item) => item.credibility.authoritySourceType === "official_domain",
  ).length;
  const officialCreatorCount = sourceItems.filter(
    (item) => item.credibility.authoritySourceType === "official_creator",
  ).length;
  const secondarySourceCount = sourceItems.filter(
    (item) => item.evidenceTier === "secondary",
  ).length;
  const genericTutorialCount = selectedCandidates.filter(
    (candidate) => candidate.genericTutorial,
  ).length;
  const uniqueCreatorCount = new Set(
    sourceItems.map((item) => normalizeSearchText(item.creatorOrPublication ?? "")).filter(Boolean),
  ).size;
  const coherenceValues = selectedCandidates.map((candidate) => candidate.coherenceScore);
  const coherenceScore =
    coherenceValues.length > 0
      ? roundToTwo(coherenceValues.reduce((sum, value) => sum + value, 0) / coherenceValues.length)
      : 0;
  const workflowSurfaceCount = new Set(
    selectedCandidates.map((candidate) => candidate.workflowSurface).filter((value) => value !== "generic"),
  ).size;
  const authorityScoringAudit: AuthorityScoringAuditEntry[] = sourceItems
    .filter((item) => item.credibility.authoritySourceType !== "community")
    .map((item) => ({
      sourceItemId: item.sourceItemId,
      title: item.title,
      creatorOrPublication: item.creatorOrPublication,
      authoritySourceType: item.credibility.authoritySourceType,
      matchedAuthorityKey: item.credibility.matchedAuthorityKey,
      baseScore: item.credibility.baseScore,
      baseTier: item.credibility.baseTier,
      adjustedScore: item.credibility.score,
      adjustedTier: item.credibility.tier,
      floorApplied: item.credibility.floorApplied,
      qualityScore:
        selectedCandidates.find((candidate) => candidate.row.id === item.sourceItemId.split("-").slice(2).join("-"))
          ?.row.quality_score ?? null,
    }));

  return {
    authoritativeSourceCount,
    officialDomainCount,
    officialCreatorCount,
    secondarySourceCount,
    genericTutorialCount,
    uniqueCreatorCount,
    coherenceScore,
    workflowSurfaceCount,
    analysisMode,
    authorityScoringAudit,
  };
}

function computeRecencyScore(sourceItems: SourcePacketSourceItem[]): number {
  if (sourceItems.length === 0) return 0;
  const total = sourceItems.reduce(
    (sum, item) => sum + item.freshness.freshnessScore,
    0,
  );
  return Math.round(total / sourceItems.length);
}

function computeVelocityScore(candidate: TopicCandidate): number {
  return Math.max(0, Math.min(100, Math.round(candidate.signalCount7d * 12)));
}

function computeNoveltyScore(
  candidate: TopicCandidate,
  sourceItems: SourcePacketSourceItem[],
): number {
  const diversityBonus = new Set(sourceItems.map((item) => item.sourceKind)).size * 8;
  const heatBonus = Math.round((candidate.heatScoreSnapshot ?? 0) * 35);
  return Math.max(0, Math.min(100, diversityBonus + heatBonus + 30));
}

function computeTrendStatus(candidate: TopicCandidate): TrendStatus {
  const heat = candidate.heatScoreSnapshot ?? 0;
  if (heat >= 0.75) return "breaking";
  if (heat >= 0.45) return "rising";
  if (heat >= 0.2) return "stable";
  return "cooling";
}

function computeOverallCredibility(sourceItems: SourcePacketSourceItem[]): number {
  if (sourceItems.length === 0) return 0;
  const total = sourceItems.reduce((sum, item) => sum + item.credibility.score, 0);
  return Math.round(total / sourceItems.length);
}

function getHighestEvidenceTier(sourceItems: SourcePacketSourceItem[]): EvidenceTier {
  if (sourceItems.some((item) => item.evidenceTier === "primary")) return "primary";
  if (sourceItems.some((item) => item.evidenceTier === "secondary")) return "secondary";
  return "community";
}

function isVendorOnly(sourceItems: SourcePacketSourceItem[]): boolean {
  if (sourceItems.length === 0) return false;
  return sourceItems.every(
    (item) =>
      item.credibility.selfPromoRisk === "high" &&
      item.credibility.authoritySourceType !== "community",
  );
}

function computeCompletenessScore(
  sourceItems: SourcePacketSourceItem[],
  keyClaims: PacketClaim[],
  hints: MarketerRelevanceHint[],
  whyNowSummary: string,
): number {
  const parts = [
    Math.min(30, sourceItems.length * 8),
    Math.min(25, keyClaims.length * 8),
    Math.min(20, hints.length * 8),
    whyNowSummary.trim().length > 0 ? 15 : 0,
    sourceItems.some((item) => item.evidenceTier === "primary") ? 10 : 0,
  ];

  return Math.max(0, Math.min(100, parts.reduce((sum, value) => sum + value, 0)));
}

function resolveItemFromIndex<T>(items: T[], rawIndex: number): T | null {
  const rounded = Math.round(rawIndex);
  return items[rounded] ?? items[rounded - 1] ?? null;
}

function normalizeText(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeMeaningfulText(
  value: string | null | undefined,
): string | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;

  const lower = normalized.toLowerCase();
  if (lower === "n/a" || lower === "na" || lower === "none") {
    return null;
  }

  return normalized;
}

function sanitizeStringArray(values: string[]): string[] {
  return values
    .map((value) => normalizeText(value))
    .filter((value): value is string => Boolean(value));
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function diffDays(value: string | null): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 86_400_000));
}

function safeDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function isOfficialDomain(domain: string | null): boolean {
  if (!domain) return false;
  const officialDomains = [
    "openai.com",
    "anthropic.com",
    "claude.com",
    "google.com",
    "deepmind.google",
    "notebooklm.google.com",
    "cursor.com",
    "vercel.com",
    "midjourney.com",
    "replit.com",
    "github.com",
    "notion.com",
  ];

  return officialDomains.some((candidate) => domain === candidate || domain.endsWith(`.${candidate}`));
}

function guessLaunchDomainFromSources(
  sourceItems: SourcePacketSourceItem[],
): MarketerRelevanceHint["launchDomain"] {
  const text = sourceItems
    .map((item) => `${item.title} ${item.summary} ${item.topics.join(" ")}`.toLowerCase())
    .join(" ");

  if (/campaign|experiment|launch|ads|outreach/.test(text)) {
    return "campaigns-experiments";
  }
  if (/message|position|copy|brand|tone/.test(text)) {
    return "positioning-messaging";
  }
  if (/content|newsletter|calendar|repurpose|editorial/.test(text)) {
    return "content-systems";
  }
  if (/workflow|automation|ops|process|handoff/.test(text)) {
    return "workflow-design-operations";
  }
  return "research-insight";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

export const __testing = {
  buildTopicProfile,
  buildRankedContentCandidates,
  buildSourceCredibility,
  assessAuthority,
  buildPacketDiagnostics,
};
