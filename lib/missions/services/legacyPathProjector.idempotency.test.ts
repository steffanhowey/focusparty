import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MissionBriefV2 } from "@/lib/missions/types/missionBriefV2";

const {
  createAdminClientMock,
  getMissionPathProjectionByMissionBriefIdMock,
  getExistingLearningPathForMissionBriefMock,
  createMissionPathProjectionMock,
  resolveMissionProjectionToolMock,
  mapPathRowMock,
} = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  getMissionPathProjectionByMissionBriefIdMock: vi.fn(),
  getExistingLearningPathForMissionBriefMock: vi.fn(),
  createMissionPathProjectionMock: vi.fn(),
  resolveMissionProjectionToolMock: vi.fn(),
  mapPathRowMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createClient: createAdminClientMock,
}));

vi.mock("@/lib/missions/repositories/missionPathProjectionRepo", () => ({
  createMissionPathProjection: createMissionPathProjectionMock,
  getMissionPathProjectionByMissionBriefId:
    getMissionPathProjectionByMissionBriefIdMock,
}));

vi.mock("@/lib/missions/services/missionCacheService", () => ({
  getExistingLearningPathForMissionBrief:
    getExistingLearningPathForMissionBriefMock,
}));

vi.mock("@/lib/missions/services/toolCapabilityResolver", () => ({
  resolveMissionProjectionTool: resolveMissionProjectionToolMock,
}));

vi.mock("@/lib/learn/pathGenerator", () => ({
  mapPathRow: mapPathRowMock,
}));

import { projectMissionBriefToHiddenLearningPath } from "./legacyPathProjector";

function buildBrief(): MissionBriefV2 {
  return {
    missionId: "33333333-3333-4333-8333-333333333333",
    stableKey: "prompt-engineering:marketing:practicing:research-synthesis",
    schemaVersion: "mission_brief_v2",
    status: "active",
    identity: {
      title: "Prompt Engineering Mission",
      shortTitle: "Prompt Mission",
      summary: "Summary",
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
      marketerUseCase: "Use case.",
    },
    artifact: {
      artifactType: "audience-brief",
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
      roomKey: "research-room",
      launchDomain: "research-insight",
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
    tools: {
      primary: {
        toolKey: "chatgpt",
        displayName: "ChatGPT",
        resolutionType: "registry",
        capabilityTags: ["general-llm"],
        required: true,
        rationale: "Use a general LLM.",
      },
      supporting: [],
      disallowed: [],
    },
  };
}

describe("legacyPathProjector duplicate protection", () => {
  beforeEach(() => {
    createAdminClientMock.mockReset();
    getMissionPathProjectionByMissionBriefIdMock.mockReset();
    getExistingLearningPathForMissionBriefMock.mockReset();
    createMissionPathProjectionMock.mockReset();
    resolveMissionProjectionToolMock.mockReset();
    mapPathRowMock.mockReset();
  });

  it("reuses an existing projection without inserting a duplicate path row", async () => {
    const brief = buildBrief();
    const adminFixture = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "path-1",
                title: "Path",
                description: "Desc",
                query: "prompt engineering",
                topics: ["prompt-engineering"],
                difficulty_level: "intermediate",
                estimated_duration_seconds: 2700,
                items: [],
                view_count: 0,
                start_count: 0,
                completion_count: 0,
                created_at: new Date().toISOString(),
              },
              error: null,
            }),
          })),
        })),
      })),
    };
    createAdminClientMock.mockReturnValue(adminFixture);
    getMissionPathProjectionByMissionBriefIdMock.mockResolvedValue({
      id: "projection-1",
      missionBriefId: brief.missionId,
      learningPathId: "path-1",
      projectorVersion: "shadow_projection_v1",
      projectionStatus: "active",
      projectedAt: new Date().toISOString(),
      supersededAt: null,
      createdAt: new Date().toISOString(),
    });
    getExistingLearningPathForMissionBriefMock.mockResolvedValue(null);
    mapPathRowMock.mockReturnValue({ id: "path-1" });

    const result = await projectMissionBriefToHiddenLearningPath(brief);

    expect(result.created).toBe(false);
    expect(result.learningPath.id).toBe("path-1");
    expect(createMissionPathProjectionMock).not.toHaveBeenCalled();
    expect(adminFixture.from).toHaveBeenCalledWith("fp_learning_paths");
  });

  it("re-links an existing hidden path without inserting a second path row", async () => {
    const brief = buildBrief();
    const insertMock = vi.fn();
    createAdminClientMock.mockReturnValue({
      from: vi.fn(() => ({
        insert: insertMock,
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "path-2",
                title: "Path",
                description: "Desc",
                query: "prompt engineering",
                topics: ["prompt-engineering"],
                difficulty_level: "intermediate",
                estimated_duration_seconds: 2700,
                items: [],
                view_count: 0,
                start_count: 0,
                completion_count: 0,
                created_at: new Date().toISOString(),
              },
              error: null,
            }),
          })),
        })),
      })),
    });
    getMissionPathProjectionByMissionBriefIdMock.mockResolvedValue(null);
    getExistingLearningPathForMissionBriefMock.mockResolvedValue({
      id: "path-2",
      source_mission_brief_id: brief.missionId,
      canonical_stable_key: brief.stableKey,
      is_cached: false,
      generation_engine: "mission_projection",
    });
    createMissionPathProjectionMock.mockResolvedValue({
      id: "projection-2",
      missionBriefId: brief.missionId,
      learningPathId: "path-2",
      projectorVersion: "shadow_projection_v1",
      projectionStatus: "active",
      projectedAt: new Date().toISOString(),
      supersededAt: null,
      createdAt: new Date().toISOString(),
    });
    mapPathRowMock.mockReturnValue({ id: "path-2" });

    const result = await projectMissionBriefToHiddenLearningPath(brief);

    expect(result.created).toBe(false);
    expect(result.learningPath.id).toBe("path-2");
    expect(createMissionPathProjectionMock).toHaveBeenCalledTimes(1);
    expect(insertMock).not.toHaveBeenCalled();
  });
});
