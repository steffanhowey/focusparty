import { describe, expect, it } from "vitest";
import { __testing } from "./missionQualityGate";
import type { MissionBriefV2 } from "@/lib/missions/types/missionBriefV2";
import type { SourcePacket } from "@/lib/missions/types/sourcePacket";

function buildPacket(): SourcePacket {
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
      topicSlug: "prompt-engineering",
      topicName: "Prompt Engineering",
      topicCategory: "technique",
      clusterId: null,
      heatScoreSnapshot: null,
      signalCount7d: 0,
      sourceDiversity7d: 0,
    },
    lineage: {
      inputSignalIds: [],
      inputContentIds: [],
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
      recencyScore: 10,
      velocityScore: 0,
      noveltyScore: 30,
      trendStatus: "cooling",
      staleAfter: new Date().toISOString(),
    },
    credibility: {
      overallScore: 60,
      highestEvidenceTier: "secondary",
      highCredibilitySourceCount: 1,
      lowCredibilitySourceCount: 0,
      vendorOnly: false,
    },
    whyNow: {
      summary: "Why now.",
      changeType: "workflow-adoption",
      whatChanged: ["Something changed."],
      whatIsReadyNow: ["Something is ready."],
      whatIsNoiseOrNotYetProven: [],
      expiryReason: "Later.",
    },
    keyClaims: [],
    contradictions: [],
    uncertainties: [],
    marketerRelevanceHints: [],
    sourceItems: [],
    exclusions: [],
    quality: {
      completenessScore: 80,
      usableForGeneration: true,
      rejectReasons: [],
      reviewerNotes: [],
    },
    assembledAt: new Date().toISOString(),
    expiresAt: new Date().toISOString(),
  };
}

function buildBrief(successCriteria: MissionBriefV2["successCriteria"]): MissionBriefV2 {
  return {
    missionId: "33333333-3333-4333-8333-333333333333",
    stableKey: "prompt-engineering:marketing:practicing:research-synthesis",
    schemaVersion: "mission_brief_v2",
    status: "draft",
    identity: {
      title: "Prompt Engineering Research Brief",
      shortTitle: "Prompt Research",
      summary: "A prompt research brief for marketers.",
      professionalFunction: "marketing",
      fluencyLevel: "practicing",
      missionFamily: "research-synthesis",
      launchDomain: "research-insight",
    },
    topic: {
      topicSlug: "prompt-engineering",
      topicName: "Prompt Engineering",
      sourcePacketId: "11111111-1111-4111-8111-111111111111",
      sourcePacketHash: "packet-hash-12345678",
      sourcePacketReadinessState: "mission_ready",
      timelinessClass: "evergreen-foundation",
      heatScoreSnapshot: null,
    },
    framing: {
      whyThisMattersNow: "Why now.",
      whyThisMattersForMarketing: "Why marketing.",
      marketerUseCase: "Use prompt evidence to create a marketing research brief.",
    },
    artifact: {
      artifactType: "audience-brief",
      artifactName: "Prompt Research Brief",
      outputDescription: "A research brief with source-backed prompt guidance.",
      audience: "Marketers improving AI-assisted content workflows.",
      format: "doc",
      completionDefinition: "The brief is complete when a marketer can use it immediately.",
      minimumSections: [],
    },
    execution: {
      timeboxMinutes: 45,
      hardCapMinutes: 60,
      steps: [
        {
          stepId: "step-1",
          title: "Review claims",
          instruction: "Review packet claims.",
          expectedOutput: "A short working thesis.",
          estimatedMinutes: 10,
        },
        {
          stepId: "step-2",
          title: "Draft brief",
          instruction: "Draft the brief.",
          expectedOutput: "A complete first draft.",
          estimatedMinutes: 20,
        },
        {
          stepId: "step-3",
          title: "Finalize",
          instruction: "Finalize the brief.",
          expectedOutput: "A polished brief.",
          estimatedMinutes: 15,
        },
      ],
    },
    successCriteria,
    bestRoom: {
      roomKey: "research-room",
      launchDomain: "research-insight",
      rationale: "Best in research room.",
    },
    sourceReferences: [
      {
        referenceId: "ref-1",
        sourceItemId: "src-1",
        claimIds: ["claim-1"],
        supportsSections: ["why_now", "why_marketing", "artifact"],
      },
      {
        referenceId: "ref-2",
        sourceItemId: "src-2",
        claimIds: ["claim-2"],
        supportsSections: ["success_criteria", "steps"],
      },
    ],
    quality: {
      score: 0,
      dimensionScores: {
        freshness: 0,
        trustworthiness: 0,
        marketer_relevance: 0,
        specificity: 0,
        one_session_fit: 0,
        scaffolding: 0,
        opinionatedness: 0,
        source_traceability: 0,
        novel_user_value: 0,
      },
      gateDecision: "fail",
      rejectReasons: [],
      reviewedAt: new Date().toISOString(),
      notes: [],
    },
    lifecycleCore: {
      briefVersion: 1,
      generatedAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
    },
  };
}

describe("missionQualityGate deterministic success criteria checks", () => {
  it("labels too few success criteria separately", () => {
    const reasons = __testing.getDeterministicRejectReasons(
      buildBrief([
        {
          criterionId: "criterion-1",
          label: "One",
          definition: "The artifact includes a source-backed section.",
          critical: true,
          verificationMethod: "binary",
        },
        {
          criterionId: "criterion-2",
          label: "Two",
          definition: "The brief contains at least two recommendations.",
          critical: true,
          verificationMethod: "binary",
        },
      ]),
      buildPacket(),
    );

    expect(reasons).toContain("too_few_success_criteria");
    expect(reasons).not.toContain("success_criteria_unverifiable");
  });

  it("labels unverifiable criteria when definitions are vague", () => {
    const reasons = __testing.getDeterministicRejectReasons(
      buildBrief([
        {
          criterionId: "criterion-1",
          label: "One",
          definition: "The final artifact is relevant and actionable.",
          critical: true,
          verificationMethod: "binary",
        },
        {
          criterionId: "criterion-2",
          label: "Two",
          definition: "The artifact is effective and useful for marketers.",
          critical: true,
          verificationMethod: "binary",
        },
        {
          criterionId: "criterion-3",
          label: "Three",
          definition: "The output is good and actionable.",
          critical: true,
          verificationMethod: "binary",
        },
      ]),
      buildPacket(),
    );

    expect(reasons).toContain("success_criteria_subjective_language");
    expect(reasons).not.toContain("too_few_success_criteria");
  });

  it("labels missing observable condition separately", () => {
    const reasons = __testing.getDeterministicRejectReasons(
      buildBrief([
        {
          criterionId: "criterion-1",
          label: "One",
          definition: "The brief explains prompt patterns for marketers.",
          critical: true,
          verificationMethod: "binary",
        },
        {
          criterionId: "criterion-2",
          label: "Two",
          definition: "The artifact covers message ideas for the audience.",
          critical: true,
          verificationMethod: "binary",
        },
        {
          criterionId: "criterion-3",
          label: "Three",
          definition: "The output documents useful ideas for the workflow.",
          critical: true,
          verificationMethod: "binary",
        },
      ]),
      buildPacket(),
    );

    expect(reasons).toContain("success_criteria_missing_observable_condition");
  });

  it("labels missing required artifact structure separately", () => {
    const reasons = __testing.getDeterministicRejectReasons(
      buildBrief([
        {
          criterionId: "criterion-1",
          label: "One",
          definition:
            "The final brief includes at least three items for marketers.",
          critical: true,
          verificationMethod: "binary",
        },
        {
          criterionId: "criterion-2",
          label: "Two",
          definition:
            "The brief contains at least two items for the audience.",
          critical: true,
          verificationMethod: "binary",
        },
        {
          criterionId: "criterion-3",
          label: "Three",
          definition:
            "The output names at least one decision for each item.",
          critical: true,
          verificationMethod: "binary",
        },
      ]),
      buildPacket(),
    );

    expect(reasons).toContain("success_criteria_missing_required_artifact_structure");
  });
});
