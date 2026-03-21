import { describe, expect, it } from "vitest";

import { buildMissionRecommendations } from "@/lib/missionRecommendations";
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

describe("buildMissionRecommendations", () => {
  it("transforms skill recommendations into mission-first view models", () => {
    const path = createPath({
      id: "mission-1",
      skill_tags: [
        {
          skill_slug: "content-strategy",
          skill_name: "Content Strategy",
          domain_name: "Writing & Communication",
          relevance: "primary",
        },
      ],
    });

    const recommendations = buildMissionRecommendations(
      [
        {
          reason: "function_gap",
          priority: 60,
          paths: [path],
          action: {
            type: "start_path",
            label: "Start mission",
            href: "/missions/mission-1",
            room_name: "Content Systems",
          },
        },
      ],
      { surface: "missions" },
    );

    expect(recommendations).toEqual([
      expect.objectContaining({
        path,
        explanation:
          "Content Systems still needs more reps. This helps strengthen it.",
        roomHint: "Good for repeatable content workflows",
        launchDomain: expect.objectContaining({
          key: "content-systems",
        }),
      }),
    ]);
  });

  it("uses momentum and gap phrasing on Progress", () => {
    const momentumPath = createPath({
      id: "momentum",
      skill_tags: [
        {
          skill_slug: "tone-calibration",
          skill_name: "Tone Calibration",
          domain_name: "Writing & Communication",
          relevance: "primary",
        },
      ],
    });
    const gapPath = createPath({
      id: "gap",
      skill_tags: [
        {
          skill_slug: "ai-workflow-design",
          skill_name: "AI Workflow Design",
          domain_name: "Workflow Automation",
          relevance: "primary",
        },
      ],
    });

    const recommendations = buildMissionRecommendations(
      [
        {
          reason: "continue_momentum",
          priority: 90,
          paths: [momentumPath],
          action: null,
        },
        {
          reason: "market_demand",
          priority: 50,
          paths: [gapPath],
          action: null,
        },
      ],
      { surface: "progress" },
    );

    expect(recommendations[0]?.explanation).toBe(
      "You've been making progress in Messaging. Keep going.",
    );
    expect(recommendations[1]?.explanation).toBe(
      "Workflow still needs more reps. This helps strengthen it.",
    );
  });

  it("uses home transition copy when an active mission is present", () => {
    const activePath = createPath({
      id: "active",
      skill_tags: [
        {
          skill_slug: "research-synthesis",
          skill_name: "Research Synthesis",
          domain_name: "Strategy & Planning",
          relevance: "primary",
        },
      ],
    });
    const nextPath = createPath({
      id: "next",
      skill_tags: [
        {
          skill_slug: "tone-calibration",
          skill_name: "Tone Calibration",
          domain_name: "Writing & Communication",
          relevance: "primary",
        },
      ],
    });

    const recommendations = buildMissionRecommendations(
      [
        {
          reason: "market_demand",
          priority: 75,
          paths: [nextPath],
          action: null,
        },
      ],
      {
        surface: "home",
        activePathId: activePath.id,
        activePath,
      },
    );

    expect(recommendations[0]?.explanation).toBe(
      "You gathered the insight. Next, sharpen the message.",
    );
  });

  it("filters the active mission and deduplicates by mission path", () => {
    const sharedPath = createPath({
      id: "shared",
      skill_tags: [
        {
          skill_slug: "research-synthesis",
          skill_name: "Research Synthesis",
          domain_name: "Strategy & Planning",
          relevance: "primary",
        },
      ],
    });

    const recommendations = buildMissionRecommendations(
      [
        {
          reason: "continue_momentum",
          priority: 90,
          paths: [sharedPath],
          action: null,
        },
        {
          reason: "level_up",
          priority: 80,
          paths: [sharedPath],
          action: null,
        },
      ],
      {
        surface: "home",
        activePathId: "active-mission",
      },
    );

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]?.path.id).toBe("shared");
  });
});
