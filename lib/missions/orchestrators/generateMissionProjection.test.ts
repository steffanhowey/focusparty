import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MissionBriefV2 } from "@/lib/missions/types/missionBriefV2";

const { resolveShadowProjectionCandidatesMock, projectMissionBriefToHiddenLearningPathMock } =
  vi.hoisted(() => ({
    resolveShadowProjectionCandidatesMock: vi.fn(),
    projectMissionBriefToHiddenLearningPathMock: vi.fn(),
  }));

vi.mock("@/lib/missions/services/missionCacheService", () => ({
  resolveShadowProjectionCandidates: resolveShadowProjectionCandidatesMock,
}));

vi.mock("@/lib/missions/services/legacyPathProjector", () => ({
  projectMissionBriefToHiddenLearningPath:
    projectMissionBriefToHiddenLearningPathMock,
}));

import {
  __testing,
  generateMissionProjection,
} from "./generateMissionProjection";

function buildBrief(
  stableKey: string,
  missionId: string,
): MissionBriefV2 {
  return {
    missionId,
    stableKey,
    schemaVersion: "mission_brief_v2",
    status: "active",
    identity: {
      title: "Prompt Engineering Mission",
      shortTitle: "Prompt Mission",
      summary: "Summary",
      professionalFunction: "marketing",
      fluencyLevel: "practicing",
      missionFamily: stableKey.endsWith("messaging-translation")
        ? "messaging-translation"
        : "research-synthesis",
      launchDomain: stableKey.endsWith("messaging-translation")
        ? "positioning-messaging"
        : "research-insight",
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
      marketerUseCase: "Use case.",
    },
    artifact: {
      artifactType: stableKey.endsWith("messaging-translation")
        ? "message-matrix"
        : "audience-brief",
      artifactName: "Artifact",
      outputDescription: "Output",
      audience: "A marketer",
      format: "doc",
      completionDefinition: "Done.",
      minimumSections: ["Goal"],
    },
    execution: {
      timeboxMinutes: 45,
      hardCapMinutes: 60,
      steps: [
        {
          stepId: "1",
          title: "One",
          instruction: "Do one",
          expectedOutput: "Done one",
          estimatedMinutes: 10,
        },
        {
          stepId: "2",
          title: "Two",
          instruction: "Do two",
          expectedOutput: "Done two",
          estimatedMinutes: 20,
        },
        {
          stepId: "3",
          title: "Three",
          instruction: "Do three",
          expectedOutput: "Done three",
          estimatedMinutes: 15,
        },
      ],
    },
    successCriteria: [
      {
        criterionId: "criterion-1",
        label: "Goal",
        definition: "Includes the goal section.",
        critical: true,
        verificationMethod: "binary",
      },
      {
        criterionId: "criterion-2",
        label: "Evidence",
        definition: "Includes source-backed evidence.",
        critical: true,
        verificationMethod: "binary",
      },
      {
        criterionId: "criterion-3",
        label: "Recommendation",
        definition: "Includes three explicit recommendations.",
        critical: true,
        verificationMethod: "binary",
      },
    ],
    bestRoom: {
      roomKey: stableKey.endsWith("messaging-translation")
        ? "messaging-lab"
        : "research-room",
      launchDomain: stableKey.endsWith("messaging-translation")
        ? "positioning-messaging"
        : "research-insight",
      rationale: "Fit",
    },
    sourceReferences: [
      {
        referenceId: "ref-1",
        sourceItemId: "src-1",
        claimIds: ["claim-1"],
        supportsSections: ["why_marketing"],
      },
      {
        referenceId: "ref-2",
        sourceItemId: "src-2",
        claimIds: ["claim-2"],
        supportsSections: ["success_criteria"],
      },
    ],
    quality: {
      score: 85,
      dimensionScores: {
        freshness: 3,
        trustworthiness: 4,
        marketer_relevance: 4,
        specificity: 4,
        one_session_fit: 4,
        scaffolding: 4,
        opinionatedness: 4,
        source_traceability: 4,
        novel_user_value: 4,
      },
      gateDecision: "pass",
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

describe("generateMissionProjection", () => {
  beforeEach(() => {
    resolveShadowProjectionCandidatesMock.mockReset();
    projectMissionBriefToHiddenLearningPathMock.mockReset();
  });

  it("rejects non-allowlisted topics", async () => {
    expect(() =>
      __testing.assertShadowProjectionAllowed({
        topicSlug: "model-context-protocol",
        professionalFunction: "marketing",
        fluencyLevel: "practicing",
        allowedFamilies: ["research-synthesis"],
      }),
    ).toThrow(/not allowlisted/);
  });

  it("projects the latest passing brief per stable key without inventing extra scope", async () => {
    const researchBrief = buildBrief(
      "prompt-engineering:marketing:practicing:research-synthesis",
      "11111111-1111-4111-8111-111111111111",
    );
    const messagingBrief = buildBrief(
      "prompt-engineering:marketing:practicing:messaging-translation",
      "22222222-2222-4222-8222-222222222222",
    );

    resolveShadowProjectionCandidatesMock.mockResolvedValue([
      {
        brief: researchBrief,
        existingProjection: null,
        existingLearningPathId: null,
      },
      {
        brief: messagingBrief,
        existingProjection: null,
        existingLearningPathId: null,
      },
    ]);

    projectMissionBriefToHiddenLearningPathMock
      .mockResolvedValueOnce({
        learningPath: { id: "path-1" },
        projection: { id: "proj-1" },
        created: true,
      })
      .mockResolvedValueOnce({
        learningPath: { id: "path-2" },
        projection: { id: "proj-2" },
        created: false,
      });

    const result = await generateMissionProjection({
      topicSlug: "prompt-engineering",
      professionalFunction: "marketing",
      fluencyLevel: "practicing",
      allowedFamilies: ["research-synthesis", "messaging-translation"],
    });

    expect(result.projected).toHaveLength(2);
    expect(result.createdCount).toBe(1);
    expect(result.reusedCount).toBe(1);
    expect(result.projected.map((item) => item.stableKey)).toEqual([
      researchBrief.stableKey,
      messagingBrief.stableKey,
    ]);
  });

  it("filters unsupported families out of projection eligibility", async () => {
    const researchBrief = buildBrief(
      "github-copilot:marketing:practicing:research-synthesis",
      "33333333-3333-4333-8333-333333333333",
    );

    resolveShadowProjectionCandidatesMock.mockResolvedValue([
      {
        brief: researchBrief,
        existingProjection: null,
        existingLearningPathId: null,
      },
    ]);
    projectMissionBriefToHiddenLearningPathMock.mockResolvedValue({
      learningPath: { id: "path-3" },
      projection: { id: "proj-3" },
      created: false,
    });

    const result = await generateMissionProjection({
      topicSlug: "github-copilot",
      professionalFunction: "marketing",
      fluencyLevel: "practicing",
      allowedFamilies: ["research-synthesis", "messaging-translation"],
    });

    expect(resolveShadowProjectionCandidatesMock).toHaveBeenCalledWith({
      topicSlug: "github-copilot",
      professionalFunction: "marketing",
      fluencyLevel: "practicing",
      allowedFamilies: ["research-synthesis"],
    });
    expect(result.projected).toHaveLength(1);
    expect(result.projected[0]?.stableKey).toBe(researchBrief.stableKey);
  });
});
