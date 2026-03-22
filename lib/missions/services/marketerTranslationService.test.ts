import { describe, expect, it } from "vitest";
import type { SourcePacket } from "@/lib/missions/types/sourcePacket";
import { __testing } from "./marketerTranslationService";

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
      lowCredibilitySourceCount: 5,
      vendorOnly: false,
    },
    whyNow: {
      summary: "Prompt engineering matters for better AI-assisted content quality.",
      changeType: "workflow-adoption",
      whatChanged: ["Teams need better prompts."],
      whatIsReadyNow: ["Prompt workflow patterns are teachable now."],
      whatIsNoiseOrNotYetProven: ["Universal prompt hacks."],
      expiryReason: "Re-evaluate later.",
    },
    keyClaims: [
      {
        claimId: "claim-1",
        statement: "Prompt engineering improves content quality and repeatability.",
        claimType: "workflow-shift",
        confidence: 0.8,
        importance: "high",
        sourceItemIds: ["src-1"],
        excerptIds: ["excerpt-1"],
      },
      {
        claimId: "claim-2",
        statement: "Marketers can use prompts to improve AI-assisted content workflows.",
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
        launchDomain: "workflow-design-operations",
        workflowSlug: "workflow-design-operations",
        impactType: "quality",
        whyMarketersShouldCare:
          "Prompt engineering improves output quality and consistency for AI-assisted content work.",
        exampleUseCase:
          "Marketers can use prompt engineering to create more effective content generation strategies with AI tools.",
        missionable: true,
        suggestedArtifact: "Prompt engineering guide for marketers.",
      },
    ],
    sourceItems: [],
    exclusions: [],
    quality: {
      completenessScore: 85,
      usableForGeneration: true,
      rejectReasons: [],
      reviewerNotes: [],
    },
    assembledAt: new Date().toISOString(),
    expiresAt: new Date().toISOString(),
  };
}

describe("marketerTranslationService", () => {
  it("builds a family-scoped research fallback translation", () => {
    const translation = __testing.buildFallbackTranslation(
      buildPacket(),
      "marketing",
      ["research-synthesis"],
    );

    expect(translation?.missionFamilyCandidates[0]?.family).toBe("research-synthesis");
    expect(translation?.affectedLaunchDomains[0]?.launchDomain).toBe("research-insight");
    expect(translation?.marketerUseCase.toLowerCase()).toContain("content-brief drafting");
    expect(translation?.marketerUseCase.toLowerCase()).toContain("two prompt structures");
  });

  it("builds a family-scoped messaging fallback translation", () => {
    const translation = __testing.buildFallbackTranslation(
      buildPacket(),
      "marketing",
      ["messaging-translation"],
    );

    expect(translation?.missionFamilyCandidates[0]?.family).toBe("messaging-translation");
    expect(translation?.affectedLaunchDomains[0]?.launchDomain).toBe("positioning-messaging");
    expect(translation?.marketerUseCase.toLowerCase()).toContain("message matrix");
  });

  it("narrows claude-code messaging translation to one internal communication scenario", () => {
    const translation = __testing.buildFallbackTranslation(
      buildPacket({
        topicSlug: "claude-code",
        topicName: "Claude Code",
      }),
      "marketing",
      ["messaging-translation"],
    );

    expect(translation?.marketerUseCase.toLowerCase()).toContain("marketing ops lead");
    expect(translation?.marketerUseCase.toLowerCase()).toContain("non-fit boundary");
    expect(translation?.whyThisMattersForFunction.toLowerCase()).toContain("operations-minded teammates");
  });
});
