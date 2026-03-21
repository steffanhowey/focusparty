import { describe, expect, it } from "vitest";

import {
  getMissionLaunchDomain,
  getMissionLaunchDomainPriority,
  getMissionLaunchDomainShortLabel,
  getLaunchRoomPreferenceOrder,
} from "@/lib/launchTaxonomy";
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

describe("launch taxonomy", () => {
  it("resolves exact skill-tag overrides before legacy or keyword fallbacks", () => {
    const path = createPath({
      title: "Campaign research",
      skill_tags: [
        {
          skill_slug: "ai-workflow-design",
          skill_name: "AI Workflow Design",
          domain_name: "Strategy & Planning",
          relevance: "primary",
        },
      ],
    });

    expect(getMissionLaunchDomain(path)).toMatchObject({
      key: "workflow-design-operations",
      label: "Workflow Design & Operations",
      source: "skill-tag",
    });
  });

  it("uses the legacy-domain compatibility mapping before keyword inference", () => {
    const path = createPath({
      title: "Campaign launch planning",
      skill_tags: [
        {
          skill_slug: "unknown-skill",
          skill_name: "Unknown Skill",
          domain_name: "Writing & Communication",
          relevance: "primary",
        },
      ],
    });

    expect(getMissionLaunchDomain(path)).toMatchObject({
      key: "positioning-messaging",
      source: "legacy-domain",
    });
  });

  it("uses lightweight keyword fallback only when stronger signals do not exist", () => {
    const path = createPath({
      title: "Newsletter calendar sprint",
      goal: "Ship the editorial plan",
      query: "newsletter calendar",
    });

    expect(getMissionLaunchDomain(path)).toMatchObject({
      key: "content-systems",
      source: "keyword",
    });
  });

  it("falls back to Research & Insight when no stronger signal exists", () => {
    const path = createPath({
      title: "Make the work clearer",
      goal: undefined,
      query: "clear next steps",
      topics: [],
    });

    expect(getMissionLaunchDomain(path)).toMatchObject({
      key: "research-insight",
      label: "Research & Insight",
      source: "fallback",
    });
  });

  it("keeps the temporary brand-design mapping covered explicitly", () => {
    const path = createPath({
      skill_tags: [
        {
          skill_slug: "ai-brand-design",
          skill_name: "AI Brand Design",
          domain_name: "Visual & Design",
          relevance: "primary",
        },
      ],
    });

    expect(getMissionLaunchDomain(path)).toMatchObject({
      key: "positioning-messaging",
      source: "skill-tag",
    });
  });

  it("returns short labels and room preference order for launch surfaces", () => {
    const path = createPath({
      skill_tags: [
        {
          skill_slug: "research-synthesis",
          skill_name: "Research Synthesis",
          domain_name: "Strategy & Planning",
          relevance: "primary",
        },
      ],
    });

    expect(getMissionLaunchDomainShortLabel(path)).toBe("Research");
    expect(getLaunchRoomPreferenceOrder("campaigns-experiments")).toEqual([
      "campaign-sprint",
      "messaging-lab",
      "open-studio",
    ]);
    expect(getMissionLaunchDomainPriority(path)).toBeGreaterThan(
      getMissionLaunchDomainPriority(createPath({ title: "Plain work" })),
    );
  });
});
