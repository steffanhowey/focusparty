import { describe, expect, it } from "vitest";
import { __testing, type MissionBriefGeneratorInput } from "./missionBriefGenerator";
import type { SourcePacket } from "@/lib/missions/types/sourcePacket";
import type { MarketerTranslation } from "@/lib/missions/types/marketerTranslation";
import type { MissionPlan } from "@/lib/missions/types/missionPlan";

function buildPacket(
  overrides: Partial<SourcePacket["topic"]> = {},
): SourcePacket {
  return {
    packetId: "11111111-1111-4111-8111-111111111111",
    schemaVersion: "source_packet_v1",
    packetHash: "packet-hash-12345678",
    status: "validated",
    readiness: {
      state: "mission_ready",
      rationale: "Ready.",
      blockers: [],
      nextReviewAt: null,
    },
    topic: {
      topicId: "22222222-2222-4222-8222-222222222222",
      topicSlug: overrides.topicSlug ?? "prompt-engineering",
      topicName: overrides.topicName ?? "Prompt Engineering",
      topicCategory: "technique",
      clusterId: null,
      heatScoreSnapshot: null,
      signalCount7d: 0,
      sourceDiversity7d: 0,
    },
    lineage: {
      inputSignalIds: [],
      inputContentIds: ["src-1", "src-2"],
      generationRunId: "run-1",
    },
    sourceWindow: {
      startAt: new Date().toISOString(),
      endAt: new Date().toISOString(),
      lookbackDays: 90,
      timelinessClass: "evergreen-foundation",
      recommendedTtlHours: 2160,
    },
    freshness: {
      recencyScore: 5,
      velocityScore: 0,
      noveltyScore: 38,
      trendStatus: "cooling",
      staleAfter: new Date().toISOString(),
    },
    credibility: {
      overallScore: 58,
      highestEvidenceTier: "secondary",
      highCredibilitySourceCount: 1,
      lowCredibilitySourceCount: 0,
      vendorOnly: false,
    },
    whyNow: {
      summary: "Basic AI access is common now; the edge is getting more reliable and specific output in recurring work.",
      changeType: "workflow-adoption",
      whatChanged: ["Teams need more reliable AI-assisted workflows."],
      whatIsReadyNow: ["Practical workflow patterns can be applied now."],
      whatIsNoiseOrNotYetProven: ["Universal AI hacks."],
      expiryReason: "Re-evaluate later.",
    },
    keyClaims: [
      {
        claimId: "claim-1",
        statement: "Structured prompting improves output quality for repeated workflows.",
        claimType: "workflow-shift",
        confidence: 0.8,
        importance: "high",
        sourceItemIds: ["src-1"],
        excerptIds: ["excerpt-1"],
      },
      {
        claimId: "claim-2",
        statement: "Marketers benefit when prompt structures are matched to a specific job.",
        claimType: "capability",
        confidence: 0.8,
        importance: "high",
        sourceItemIds: ["src-2"],
        excerptIds: ["excerpt-2"],
      },
    ],
    contradictions: [],
    uncertainties: [],
    marketerRelevanceHints: [
      {
        hintId: "hint-1",
        launchDomain: "research-insight",
        workflowSlug: "research-insight",
        impactType: "quality",
        whyMarketersShouldCare:
          "The topic improves output quality for recurring workflows.",
        exampleUseCase:
          "A marketer can improve one recurring workflow instead of collecting generic AI advice.",
        missionable: true,
        suggestedArtifact: "Workflow brief",
      },
    ],
    sourceItems: [
      {
        sourceItemId: "src-1",
        sourceKind: "youtube_video",
        evidenceTier: "secondary",
        stance: "supports",
        title: "Source one",
        creatorOrPublication: "Source",
        domain: "example.com",
        publishedAt: new Date().toISOString(),
        discoveredAt: new Date().toISOString(),
        indexedAt: new Date().toISOString(),
        url: "https://example.com/one",
        externalId: "content-1",
        contentFormat: "video",
        durationSeconds: 300,
        wordCount: null,
        summary: "Summary one",
        topics: [overrides.topicSlug ?? "prompt-engineering"],
        freshness: {
          ageDays: 1,
          withinWindow: true,
          freshnessScore: 0.7,
        },
        credibility: {
          tier: "high",
          score: 88,
          authorityRationale: "Test authority.",
          selfPromoRisk: "low",
          authoritySourceType: "official_creator",
          matchedAuthorityKey: "anthropic",
          baseScore: 66,
          baseTier: "medium",
          floorApplied: false,
        },
        excerpts: [],
        claims: [],
      },
      {
        sourceItemId: "src-2",
        sourceKind: "youtube_video",
        evidenceTier: "secondary",
        stance: "supports",
        title: "Source two",
        creatorOrPublication: "Source",
        domain: "example.com",
        publishedAt: new Date().toISOString(),
        discoveredAt: new Date().toISOString(),
        indexedAt: new Date().toISOString(),
        url: "https://example.com/two",
        externalId: "content-2",
        contentFormat: "video",
        durationSeconds: 300,
        wordCount: null,
        summary: "Summary two",
        topics: [overrides.topicSlug ?? "prompt-engineering"],
        freshness: {
          ageDays: 2,
          withinWindow: true,
          freshnessScore: 0.7,
        },
        credibility: {
          tier: "high",
          score: 82,
          authorityRationale: "Test authority.",
          selfPromoRisk: "low",
          authoritySourceType: "official_creator",
          matchedAuthorityKey: "anthropic",
          baseScore: 62,
          baseTier: "medium",
          floorApplied: false,
        },
        excerpts: [],
        claims: [],
      },
    ],
    exclusions: [],
    quality: {
      completenessScore: 85,
      usableForGeneration: true,
      rejectReasons: [],
      reviewerNotes: [],
      diagnostics: {
        authoritativeSourceCount: 1,
        officialDomainCount: 0,
        officialCreatorCount: 1,
        secondarySourceCount: 2,
        genericTutorialCount: 0,
        uniqueCreatorCount: 2,
        coherenceScore: 1,
        workflowSurfaceCount: 1,
        analysisMode: "fallback",
        authorityScoringAudit: [],
      },
    },
    assembledAt: new Date().toISOString(),
    expiresAt: new Date().toISOString(),
  };
}

function buildTranslation(
  overrides: Partial<MarketerTranslation> = {},
): MarketerTranslation {
  return {
    translationId: "translation-1",
    topicSlug: overrides.topicSlug ?? "prompt-engineering",
    professionalFunction: "marketing",
    whyThisMattersForFunction:
      overrides.whyThisMattersForFunction ?? "Why marketing.",
    marketerUseCase:
      overrides.marketerUseCase ?? "A marketer use case.",
    affectedLaunchDomains: [
      {
        launchDomain: "research-insight",
        score: 0.85,
        rationale: "Research fit.",
      },
    ],
    missionFamilyCandidates: [
      {
        family: "research-synthesis",
        score: 0.85,
        rationale: "Research fit.",
        recommendedArtifactType: "audience-brief",
      },
    ],
    recommendedUseCases: [overrides.marketerUseCase ?? "A marketer use case."],
    nonUseCases: ["Do not do a full technical deep-dive."],
    requiredInputHints: ["Brand context"],
    opinionatedStance: "Stay practical.",
    whatToIgnore: [],
  };
}

function buildMissionPlan(
  overrides: Partial<MissionPlan> = {},
): MissionPlan {
  return {
    topicSlug: overrides.topicSlug ?? "prompt-engineering",
    professionalFunction: "marketing",
    fluencyLevel: "practicing",
    missionFamily: overrides.missionFamily ?? "research-synthesis",
    artifactType: overrides.artifactType ?? "audience-brief",
    launchDomain: overrides.launchDomain ?? "research-insight",
    rationale: overrides.rationale ?? "Test plan.",
    candidateScores: overrides.candidateScores ?? [],
  };
}

function buildInput(
  overrides: {
    packet?: Partial<SourcePacket["topic"]>;
    translation?: Partial<MarketerTranslation>;
    missionPlan?: Partial<MissionPlan>;
  } = {},
): MissionBriefGeneratorInput {
  return {
    packet: buildPacket(overrides.packet),
    translation: buildTranslation(overrides.translation),
    missionPlan: buildMissionPlan(overrides.missionPlan),
    briefVersion: 1,
    benchmarkVersion: "benchmark_v1",
  };
}

describe("missionBriefGenerator launch lane tightening", () => {
  it("tightens prompt-engineering research into one named workflow", () => {
    const draft = __testing.buildFallbackMissionBriefDraft(buildInput());

    expect(draft.title).toContain("Content-Brief Drafting");
    expect(draft.artifact_name).toBe("Content-Brief Prompt Upgrade Brief");
    expect(draft.completion_definition).toContain("two specific prompt structures");
    expect(draft.completion_definition).toContain("two concrete failure modes");
    expect(draft.minimum_sections).toEqual([
      "named workflow",
      "prompt structure 1",
      "prompt structure 2",
      "failure modes to avoid",
      "recommended workflow change",
    ]);
  });

  it("tightens claude-code messaging into one usable internal message asset", () => {
    const draft = __testing.buildFallbackMissionBriefDraft(
      buildInput({
        packet: {
          topicSlug: "claude-code",
          topicName: "Claude Code",
        },
        translation: {
          topicSlug: "claude-code",
        },
        missionPlan: {
          topicSlug: "claude-code",
          missionFamily: "messaging-translation",
          artifactType: "message-matrix",
          launchDomain: "positioning-messaging",
        },
      }),
    );

    expect(draft.title).toContain("Claude Code");
    expect(draft.audience.toLowerCase()).toContain("marketing ops lead");
    expect(draft.output_description).toContain("one pain point");
    expect(draft.output_description).toContain("one objection");
    expect(draft.minimum_sections).toEqual([
      "audience",
      "pain point",
      "value claim",
      "proof set",
      "objection",
      "non-fit boundary",
      "example phrasing",
    ]);
  });
});
