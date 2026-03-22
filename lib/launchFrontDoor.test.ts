import { describe, expect, it } from "vitest";

import { buildLaunchFrontDoorBuckets } from "@/lib/launchFrontDoor";
import type { LearningPath } from "@/lib/types";

function createPath(overrides: Partial<LearningPath> = {}): LearningPath {
  return {
    id: "path-1",
    title: "Mission title",
    description: "Mission description",
    goal: "Mission goal",
    query: "mission query",
    topics: [],
    difficulty_level: "beginner",
    estimated_duration_seconds: 900,
    items: [],
    view_count: 0,
    start_count: 0,
    completion_count: 0,
    created_at: "2026-03-20T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildLaunchFrontDoorBuckets", () => {
  it("orders the approved launch set into core and extended sections", () => {
    const paths = [
      createPath({
        id: "gh-copilot",
        topics: ["github-copilot"],
        skill_tags: [
          {
            skill_slug: "research-synthesis",
            skill_name: "Research Synthesis",
            domain_name: "Strategy & Planning",
            relevance: "primary",
          },
        ],
      }),
      createPath({
        id: "claude-msg",
        topics: ["claude-code"],
        skill_tags: [
          {
            skill_slug: "tone-calibration",
            skill_name: "Tone Calibration",
            domain_name: "Writing & Communication",
            relevance: "primary",
          },
        ],
      }),
      createPath({
        id: "prompt-research",
        topics: ["prompt-engineering"],
        skill_tags: [
          {
            skill_slug: "research-synthesis",
            skill_name: "Research Synthesis",
            domain_name: "Strategy & Planning",
            relevance: "primary",
          },
        ],
      }),
      createPath({
        id: "claude-research",
        topics: ["claude-code"],
        skill_tags: [
          {
            skill_slug: "research-synthesis",
            skill_name: "Research Synthesis",
            domain_name: "Strategy & Planning",
            relevance: "primary",
          },
        ],
      }),
      createPath({
        id: "prompt-messaging",
        topics: ["prompt-engineering"],
        skill_tags: [
          {
            skill_slug: "tone-calibration",
            skill_name: "Tone Calibration",
            domain_name: "Writing & Communication",
            relevance: "primary",
          },
        ],
      }),
    ];

    const buckets = buildLaunchFrontDoorBuckets(paths);

    expect(buckets.corePaths.map((path) => path.id)).toEqual([
      "prompt-research",
      "prompt-messaging",
      "claude-research",
    ]);
    expect(buckets.extendedPaths.map((path) => path.id)).toEqual([
      "claude-msg",
      "gh-copilot",
    ]);
    expect(buckets.remainingPaths).toEqual([]);
  });
});
