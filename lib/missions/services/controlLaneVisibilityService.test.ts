import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createAdminClientMock,
  resolveShadowProjectionCandidatesMock,
  projectMissionBriefToHiddenLearningPathMock,
} = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  resolveShadowProjectionCandidatesMock: vi.fn(),
  projectMissionBriefToHiddenLearningPathMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createClient: createAdminClientMock,
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
  promoteVisibleControlLanePaths,
} from "./controlLaneVisibilityService";

describe("controlLaneVisibilityService", () => {
  beforeEach(() => {
    createAdminClientMock.mockReset();
    resolveShadowProjectionCandidatesMock.mockReset();
    projectMissionBriefToHiddenLearningPathMock.mockReset();
  });

  it("promotes the latest control-lane path and hides older projected rows for the same stable key", async () => {
    const eqStableKeyMock = vi.fn(() => ({
      order: vi.fn().mockResolvedValue({
        data: [
          { id: "path-active", is_cached: false, is_discoverable: false, view_count: 0 },
          { id: "path-old", is_cached: true, is_discoverable: false, view_count: 8 },
        ],
        error: null,
      }),
    }));
    const updateEqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn(() => ({ eq: updateEqMock }));
    const fromMock = vi.fn((table: string) => {
      if (table === "fp_learning_paths") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: eqStableKeyMock,
            })),
          })),
          update: updateMock,
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    createAdminClientMock.mockReturnValue({
      from: fromMock,
    });
    resolveShadowProjectionCandidatesMock.mockResolvedValue([
      {
        brief: {
          missionId: "brief-1",
          stableKey: "prompt-engineering:marketing:practicing:research-synthesis",
        },
      },
    ]);
    projectMissionBriefToHiddenLearningPathMock.mockResolvedValue({
      learningPath: { id: "path-active" },
      projection: { missionBriefId: "brief-1" },
      created: false,
    });

    const result = await promoteVisibleControlLanePaths({
      topicSlug: "prompt-engineering",
      professionalFunction: "marketing",
      fluencyLevel: "practicing",
      allowedFamilies: ["research-synthesis"],
    });

    expect(result.promotedCount).toBe(1);
    expect(result.hiddenCount).toBe(1);
    expect(result.promoted[0]).toMatchObject({
      stableKey:
        "prompt-engineering:marketing:practicing:research-synthesis",
      learningPathId: "path-active",
      projectionAction: "reused",
      visibilityAction: "promoted",
      hiddenPathIds: ["path-old"],
    });
    expect(updateMock).toHaveBeenCalledTimes(2);
    expect(updateMock).toHaveBeenNthCalledWith(1, {
      is_cached: false,
      is_discoverable: false,
    });
    expect(updateEqMock).toHaveBeenNthCalledWith(1, "id", "path-old");
    expect(updateMock).toHaveBeenNthCalledWith(2, {
      is_cached: true,
      is_discoverable: false,
      view_count: 2,
    });
    expect(updateEqMock).toHaveBeenNthCalledWith(2, "id", "path-active");
  });

  it("is idempotent when the latest projected path is already visible", async () => {
    const eqStableKeyMock = vi.fn(() => ({
      order: vi.fn().mockResolvedValue({
        data: [{ id: "path-active", is_cached: true, is_discoverable: false, view_count: 2 }],
        error: null,
      }),
    }));
    const updateMock = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }));
    createAdminClientMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: eqStableKeyMock,
          })),
        })),
        update: updateMock,
      })),
    });
    resolveShadowProjectionCandidatesMock.mockResolvedValue([
      {
        brief: {
          missionId: "brief-2",
          stableKey: "prompt-engineering:marketing:practicing:messaging-translation",
        },
      },
    ]);
    projectMissionBriefToHiddenLearningPathMock.mockResolvedValue({
      learningPath: { id: "path-active" },
      projection: { missionBriefId: "brief-2" },
      created: false,
    });

    const result = await promoteVisibleControlLanePaths({
      topicSlug: "prompt-engineering",
      professionalFunction: "marketing",
      fluencyLevel: "practicing",
      allowedFamilies: ["messaging-translation"],
    });

    expect(result.promotedCount).toBe(0);
    expect(result.alreadyVisibleCount).toBe(1);
    expect(result.promoted[0]?.visibilityAction).toBe("already_visible");
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("raises already-visible rows to the minimum search visibility floor when needed", async () => {
    const updateEqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn(() => ({ eq: updateEqMock }));
    const eqStableKeyMock = vi.fn(() => ({
      order: vi.fn().mockResolvedValue({
        data: [{ id: "path-active", is_cached: true, is_discoverable: false, view_count: 0 }],
        error: null,
      }),
    }));
    createAdminClientMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: eqStableKeyMock,
          })),
        })),
        update: updateMock,
      })),
    });
    resolveShadowProjectionCandidatesMock.mockResolvedValue([
      {
        brief: {
          missionId: "brief-3",
          stableKey: "claude-code:marketing:practicing:research-synthesis",
        },
      },
    ]);
    projectMissionBriefToHiddenLearningPathMock.mockResolvedValue({
      learningPath: { id: "path-active" },
      projection: { missionBriefId: "brief-3" },
      created: false,
    });

    const result = await promoteVisibleControlLanePaths({
      topicSlug: "claude-code",
      professionalFunction: "marketing",
      fluencyLevel: "practicing",
      allowedFamilies: ["research-synthesis"],
    });

    expect(result.promotedCount).toBe(0);
    expect(result.alreadyVisibleCount).toBe(1);
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith({
      is_cached: true,
      is_discoverable: false,
      view_count: 2,
    });
    expect(updateEqMock).toHaveBeenCalledWith("id", "path-active");
  });

  it("re-applies non-discoverable state when a visible projected row is incorrectly discoverable", async () => {
    const updateEqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn(() => ({ eq: updateEqMock }));
    const eqStableKeyMock = vi.fn(() => ({
      order: vi.fn().mockResolvedValue({
        data: [{ id: "path-active", is_cached: true, is_discoverable: true, view_count: 2 }],
        error: null,
      }),
    }));
    createAdminClientMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: eqStableKeyMock,
          })),
        })),
        update: updateMock,
      })),
    });
    resolveShadowProjectionCandidatesMock.mockResolvedValue([
      {
        brief: {
          missionId: "brief-4",
          stableKey: "claude-code:marketing:practicing:messaging-translation",
        },
      },
    ]);
    projectMissionBriefToHiddenLearningPathMock.mockResolvedValue({
      learningPath: { id: "path-active" },
      projection: { missionBriefId: "brief-4" },
      created: false,
    });

    const result = await promoteVisibleControlLanePaths({
      topicSlug: "claude-code",
      professionalFunction: "marketing",
      fluencyLevel: "practicing",
      allowedFamilies: ["messaging-translation"],
    });

    expect(result.promotedCount).toBe(1);
    expect(updateMock).toHaveBeenCalledWith({
      is_cached: true,
      is_discoverable: false,
      view_count: 2,
    });
    expect(updateEqMock).toHaveBeenCalledWith("id", "path-active");
  });

  it("rejects non-allowlisted topics before touching visibility", () => {
    expect(() =>
      __testing.assertVisibleProjectionAllowed({
        topicSlug: "model-context-protocol",
        professionalFunction: "marketing",
        fluencyLevel: "practicing",
        allowedFamilies: ["research-synthesis"],
      }),
    ).toThrow('topic "model-context-protocol" is not allowlisted for visible projection');
  });

  it("filters unsupported families out of visibility promotion eligibility", async () => {
    const updateMock = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }));
    const eqStableKeyMock = vi.fn(() => ({
      order: vi.fn().mockResolvedValue({
        data: [{ id: "path-active", is_cached: true, is_discoverable: false, view_count: 2 }],
        error: null,
      }),
    }));
    createAdminClientMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: eqStableKeyMock,
          })),
        })),
        update: updateMock,
      })),
    });
    resolveShadowProjectionCandidatesMock.mockResolvedValue([
      {
        brief: {
          missionId: "brief-5",
          stableKey: "github-copilot:marketing:practicing:research-synthesis",
        },
      },
    ]);
    projectMissionBriefToHiddenLearningPathMock.mockResolvedValue({
      learningPath: { id: "path-active" },
      projection: { missionBriefId: "brief-5" },
      created: false,
    });

    await promoteVisibleControlLanePaths({
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
  });
});
