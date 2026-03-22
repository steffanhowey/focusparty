import { describe, expect, it } from "vitest";
import { selectMissionFamily } from "./missionFamilySelector";
import type { MarketerTranslation } from "@/lib/missions/types/marketerTranslation";

function buildTranslation(topicSlug = "prompt-engineering"): MarketerTranslation {
  return {
    translationId: "translation-1",
    topicSlug,
    professionalFunction: "marketing",
    whyThisMattersForFunction: "Prompt engineering improves output quality.",
    marketerUseCase:
      "Translate prompt engineering into a message matrix marketers can use for AI-assisted content workflows.",
    affectedLaunchDomains: [
      {
        launchDomain: "workflow-design-operations",
        score: 0.9,
        rationale: "Generic workflow hint.",
      },
      {
        launchDomain: "positioning-messaging",
        score: 0.82,
        rationale: "Messaging-aligned domain.",
      },
      {
        launchDomain: "research-insight",
        score: 0.8,
        rationale: "Research-aligned domain.",
      },
    ],
    missionFamilyCandidates: [
      {
        family: "research-synthesis",
        score: 0.8,
        rationale: "Research fit.",
        recommendedArtifactType: "audience-brief",
      },
      {
        family: "messaging-translation",
        score: 0.75,
        rationale: "Messaging fit.",
        recommendedArtifactType: "message-matrix",
      },
    ],
    recommendedUseCases: ["Translate prompts into better marketing language."],
    nonUseCases: ["Do not do a full technical deep-dive."],
    requiredInputHints: ["Brand context"],
    opinionatedStance: "Start with a concrete rep.",
    whatToIgnore: [],
  };
}

describe("missionFamilySelector", () => {
  it("labels no allowed family candidates explicitly", () => {
    const result = selectMissionFamily(buildTranslation(), "marketing", "practicing", {
      allowedFamilies: ["campaign-design"],
    });

    expect(result.missionPlan).toBeNull();
    expect(result.failureReason).toBe("no_allowed_family_candidates");
  });

  it("prefers the family-aligned launch domain over a generic top-scoring domain", () => {
    const result = selectMissionFamily(buildTranslation(), "marketing", "practicing", {
      allowedFamilies: ["messaging-translation"],
    });

    expect(result.failureReason).toBeNull();
    expect(result.missionPlan?.missionFamily).toBe("messaging-translation");
    expect(result.missionPlan?.launchDomain).toBe("positioning-messaging");
  });

  it("blocks unsupported family coverage for github-copilot messaging", () => {
    const result = selectMissionFamily(
      buildTranslation("github-copilot"),
      "marketing",
      "practicing",
      {
        allowedFamilies: ["messaging-translation"],
      },
    );

    expect(result.missionPlan).toBeNull();
    expect(result.failureReason).toBe("no_allowed_family_candidates");
  });
});
