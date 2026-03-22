import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findTopicMatchMock,
  getLatestPassingMissionBriefForStableKeyMock,
  projectMissionBriefToHiddenLearningPathMock,
} = vi.hoisted(() => ({
  findTopicMatchMock: vi.fn(),
  getLatestPassingMissionBriefForStableKeyMock: vi.fn(),
  projectMissionBriefToHiddenLearningPathMock: vi.fn(),
}));

vi.mock("@/lib/topics/taxonomy", () => ({
  findTopicMatch: findTopicMatchMock,
}));

vi.mock("@/lib/missions/services/missionCacheService", () => ({
  getLatestPassingMissionBriefForStableKey:
    getLatestPassingMissionBriefForStableKeyMock,
}));

vi.mock("@/lib/missions/services/legacyPathProjector", () => ({
  projectMissionBriefToHiddenLearningPath:
    projectMissionBriefToHiddenLearningPathMock,
}));

import {
  __testing,
  maybeResolveControlLanePath,
} from "./controlLanePathResolver";

describe("controlLanePathResolver", () => {
  beforeEach(() => {
    findTopicMatchMock.mockReset();
    getLatestPassingMissionBriefForStableKeyMock.mockReset();
    projectMissionBriefToHiddenLearningPathMock.mockReset();
  });

  it("defaults to research unless messaging intent is explicit", () => {
    expect(__testing.resolveControlLaneFamily("prompt engineering")).toBe(
      "research-synthesis",
    );
    expect(
      __testing.resolveControlLaneFamily("prompt engineering message matrix"),
    ).toBe("messaging-translation");
    expect(
      __testing.resolveControlLaneFamily("prompt engineering positioning"),
    ).toBe("messaging-translation");
    expect(
      __testing.resolveControlLaneFamily("prompt engineering frameworks"),
    ).toBe("research-synthesis");
  });

  it("resolves exact allowlisted topic phrases before broader taxonomy matching", () => {
    expect(
      __testing.resolveAllowlistedTopicSlug("claude code message matrix"),
    ).toBe("claude-code");
    expect(__testing.resolveAllowlistedTopicSlug("github copilot")).toBe(
      "github-copilot",
    );
    expect(__testing.resolveAllowlistedTopicSlug("prompt engineering")).toBe(
      "prompt-engineering",
    );
    expect(__testing.resolveAllowlistedTopicSlug("claude")).toBeNull();
  });

  it("falls back when the profile is outside the allowlisted lane", async () => {
    const result = await maybeResolveControlLanePath({
      query: "prompt engineering",
      userFunction: "marketing",
      userFluency: "exploring",
    });

    expect(result.learningPath).toBeNull();
    expect(result.diagnostics.fallbackReason).toBe("fluency_not_allowlisted");
  });

  it("resolves the allowlisted control lane and reports projection reuse", async () => {
    findTopicMatchMock.mockResolvedValue({
      id: "topic-1",
      slug: "prompt-engineering",
      name: "Prompt Engineering",
      parentId: null,
      category: "technique",
      description: null,
      aliases: [],
      status: "active",
    });
    getLatestPassingMissionBriefForStableKeyMock.mockResolvedValue({
      missionId: "brief-1",
    });
    projectMissionBriefToHiddenLearningPathMock.mockResolvedValue({
      learningPath: { id: "path-1" },
      projection: { id: "projection-1" },
      created: false,
    });

    const result = await maybeResolveControlLanePath({
      query: "prompt engineering copy",
      userFunction: "marketing",
      userFluency: "practicing",
    });

    expect(result.learningPath?.id).toBe("path-1");
    expect(result.diagnostics.resolvedTopicSlug).toBe("prompt-engineering");
    expect(result.diagnostics.resolvedFamily).toBe("messaging-translation");
    expect(result.diagnostics.projectionBranchMatched).toBe(true);
    expect(result.diagnostics.projectionAction).toBe("reused");
    expect(result.diagnostics.fallbackReason).toBeNull();
  });

  it("keeps claude-code messaging queries on the claude-code control lane", async () => {
    getLatestPassingMissionBriefForStableKeyMock.mockResolvedValue({
      missionId: "brief-2",
    });
    projectMissionBriefToHiddenLearningPathMock.mockResolvedValue({
      learningPath: { id: "path-2" },
      projection: { id: "projection-2" },
      created: false,
    });

    const result = await maybeResolveControlLanePath({
      query: "claude code message matrix",
      userFunction: "marketing",
      userFluency: "practicing",
    });

    expect(result.learningPath?.id).toBe("path-2");
    expect(result.diagnostics.resolvedTopicSlug).toBe("claude-code");
    expect(result.diagnostics.resolvedFamily).toBe("messaging-translation");
    expect(result.diagnostics.projectionBranchMatched).toBe(true);
    expect(result.diagnostics.fallbackReason).toBeNull();
    expect(findTopicMatchMock).not.toHaveBeenCalled();
  });

  it("keeps github-copilot queries on the github-copilot control lane", async () => {
    getLatestPassingMissionBriefForStableKeyMock.mockResolvedValue({
      missionId: "brief-3",
    });
    projectMissionBriefToHiddenLearningPathMock.mockResolvedValue({
      learningPath: { id: "path-3" },
      projection: { id: "projection-3" },
      created: false,
    });

    const result = await maybeResolveControlLanePath({
      query: "github copilot",
      userFunction: "marketing",
      userFluency: "practicing",
    });

    expect(result.learningPath?.id).toBe("path-3");
    expect(result.diagnostics.resolvedTopicSlug).toBe("github-copilot");
    expect(result.diagnostics.resolvedFamily).toBe("research-synthesis");
    expect(result.diagnostics.projectionBranchMatched).toBe(true);
    expect(result.diagnostics.fallbackReason).toBeNull();
    expect(findTopicMatchMock).not.toHaveBeenCalled();
  });

  it("blocks unsupported github-copilot messaging coverage before projection lookup", async () => {
    const result = await maybeResolveControlLanePath({
      query: "github copilot message matrix",
      userFunction: "marketing",
      userFluency: "practicing",
    });

    expect(result.learningPath).toBeNull();
    expect(result.diagnostics.resolvedTopicSlug).toBe("github-copilot");
    expect(result.diagnostics.resolvedFamily).toBe("messaging-translation");
    expect(result.diagnostics.fallbackReason).toBe(
      "family_coverage_unsupported",
    );
    expect(getLatestPassingMissionBriefForStableKeyMock).not.toHaveBeenCalled();
    expect(projectMissionBriefToHiddenLearningPathMock).not.toHaveBeenCalled();
    expect(findTopicMatchMock).not.toHaveBeenCalled();
  });
});
