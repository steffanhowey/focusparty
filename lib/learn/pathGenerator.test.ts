import { beforeEach, describe, expect, it, vi } from "vitest";

const { maybeResolveControlLanePathMock, generateAndCacheCurriculumMock } =
  vi.hoisted(() => ({
    maybeResolveControlLanePathMock: vi.fn(),
    generateAndCacheCurriculumMock: vi.fn(),
  }));

vi.mock("@/lib/missions/services/controlLanePathResolver", () => ({
  maybeResolveControlLanePath: maybeResolveControlLanePathMock,
}));

vi.mock("@/lib/learn/curriculumGenerator", () => ({
  generateAndCacheCurriculum: generateAndCacheCurriculumMock,
}));

import { generateAndCachePath } from "./pathGenerator";

describe("pathGenerator control lane seam", () => {
  beforeEach(() => {
    maybeResolveControlLanePathMock.mockReset();
    generateAndCacheCurriculumMock.mockReset();
  });

  it("returns the projected control-lane path when the seam matches", async () => {
    maybeResolveControlLanePathMock.mockResolvedValue({
      learningPath: { id: "projected-path-1" },
      diagnostics: {
        flagState: {
          enablePathGeneratorSwitch: true,
          enableShadowProjection: true,
        },
        resolvedTopicSlug: "prompt-engineering",
        resolvedFamily: "research-synthesis",
        projectionBranchMatched: true,
        projectionAction: "reused",
        fallbackReason: null,
        stableKey: "prompt-engineering:marketing:practicing:research-synthesis",
      },
    });

    const result = await generateAndCachePath("prompt engineering", {
      userFunction: "marketing",
      userFluency: "practicing",
    });

    expect(result?.id).toBe("projected-path-1");
    expect(generateAndCacheCurriculumMock).not.toHaveBeenCalled();
  });

  it("falls back to the legacy curriculum generator when the seam does not match", async () => {
    maybeResolveControlLanePathMock.mockResolvedValue({
      learningPath: null,
      diagnostics: {
        flagState: {
          enablePathGeneratorSwitch: true,
          enableShadowProjection: true,
        },
        resolvedTopicSlug: null,
        resolvedFamily: null,
        projectionBranchMatched: false,
        projectionAction: null,
        fallbackReason: "function_not_allowlisted",
        stableKey: null,
      },
    });
    generateAndCacheCurriculumMock.mockResolvedValue({ id: "legacy-path-1" });

    const result = await generateAndCachePath("prompt engineering", {
      userFunction: "design",
      userFluency: "practicing",
    });

    expect(result?.id).toBe("legacy-path-1");
    expect(generateAndCacheCurriculumMock).toHaveBeenCalledOnce();
  });
});
