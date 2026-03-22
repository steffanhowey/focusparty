import { describe, expect, it } from "vitest";
import { __testing } from "./successCriteria";

const researchContext = {
  artifactType: "audience-brief" as const,
  format: "doc" as const,
  minimumSections: [
    "working thesis",
    "source-backed prompt patterns",
    "marketing implications",
    "recommended next move",
  ],
  missionFamily: "research-synthesis" as const,
};

describe("successCriteria helpers", () => {
  it("builds observable fallback criteria for research briefs", () => {
    const criteria = __testing.buildObservableSuccessCriteria(researchContext);

    expect(criteria).toHaveLength(3);
    expect(criteria[0]?.definition).toContain('"working thesis"');
    expect(criteria[1]?.definition).toContain("at least three");
    expect(criteria[2]?.definition).toContain("cited packet-backed claim");
  });

  it("treats subjective-only language as invalid", () => {
    const analysis = __testing.analyzeSuccessCriterionDefinition(
      "The brief is formatted professionally and easy to read for marketers.",
      researchContext,
    );

    expect(analysis.valid).toBe(false);
    expect(analysis.issues).toContain("subjective_language");
  });

  it("accepts structure-backed observable criteria", () => {
    const analysis = __testing.analyzeSuccessCriterionDefinition(
      'The final brief includes the sections "working thesis", "source-backed prompt patterns", and "marketing implications".',
      researchContext,
    );

    expect(analysis.valid).toBe(true);
  });

  it("accepts observable criteria that use plural verb forms", () => {
    const analysis = __testing.analyzeSuccessCriterionDefinition(
      "At least two sections in the final brief include a cited packet-backed claim or source-backed recommendation.",
      researchContext,
    );

    expect(analysis.valid).toBe(true);
  });

  it("fills missing matrix fields with the default observable structure", () => {
    const sections = __testing.normalizeObservableMinimumSections({
      artifactType: "message-matrix",
      format: "table",
      minimumSections: ["Key Concept", "Example Prompt", "Actionable Insight"],
      missionFamily: "messaging-translation",
    });

    expect(sections).toEqual([
      "audience/problem",
      "prompt principle",
      "marketer benefit",
      "example phrasing",
    ]);
  });

  it("preserves expanded matrix sections for launch-quality technical translation missions", () => {
    const sections = __testing.normalizeObservableMinimumSections({
      artifactType: "message-matrix",
      format: "table",
      minimumSections: [
        "audience",
        "pain point",
        "value claim",
        "proof set",
        "objection",
        "non-fit boundary",
      ],
      missionFamily: "messaging-translation",
    });

    expect(sections).toEqual([
      "audience",
      "pain point",
      "value claim",
      "proof set",
      "objection",
      "non-fit boundary",
    ]);
  });
});
