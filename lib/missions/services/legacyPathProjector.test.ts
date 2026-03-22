import { describe, expect, it } from "vitest";
import { __testing } from "./legacyPathProjector";
import type { MissionBriefV2 } from "@/lib/missions/types/missionBriefV2";

function buildBrief(family: MissionBriefV2["identity"]["missionFamily"]): MissionBriefV2 {
  return {
    missionId: "33333333-3333-4333-8333-333333333333",
    stableKey: `prompt-engineering:marketing:practicing:${family}`,
    schemaVersion: "mission_brief_v2",
    status: "active",
    identity: {
      title: "Prompt Engineering Mission",
      shortTitle: "Prompt Mission",
      summary: "A prompt-engineering control lane mission.",
      professionalFunction: "marketing",
      fluencyLevel: "practicing",
      missionFamily: family,
      launchDomain:
        family === "messaging-translation"
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
      whyThisMattersNow: "AI-assisted marketing work depends on better prompt quality.",
      whyThisMattersForMarketing: "Marketers need repeatable prompt patterns they can reuse.",
      marketerUseCase: "Create a reusable prompt pack for campaign and content planning.",
    },
    artifact: {
      artifactType:
        family === "messaging-translation" ? "message-matrix" : "audience-brief",
      artifactName:
        family === "messaging-translation"
          ? "Prompt Messaging Matrix"
          : "Prompt Research Brief",
      outputDescription: "A source-backed artifact for AI-assisted marketing work.",
      audience: "A growth marketer improving AI-assisted campaign planning",
      format: "doc",
      completionDefinition: "The artifact includes the required sections and source-backed recommendations.",
      minimumSections: ["Goal", "Prompt pattern", "Recommendation", "Source-backed note"],
    },
    execution: {
      timeboxMinutes: 45,
      hardCapMinutes: 60,
      steps: [
        {
          stepId: "step-1",
          title: "Review claims",
          instruction: "Review the packet claims and note the strongest evidence.",
          expectedOutput: "A list of the packet claims to use in the artifact.",
          estimatedMinutes: 10,
        },
        {
          stepId: "step-2",
          title: "Draft artifact",
          instruction: "Draft the artifact with the required sections.",
          expectedOutput: "A first draft with the required sections present.",
          estimatedMinutes: 20,
        },
        {
          stepId: "step-3",
          title: "Finalize recommendations",
          instruction: "Finalize three source-backed recommendations for marketers.",
          expectedOutput: "A final artifact with three concrete recommendations.",
          estimatedMinutes: 15,
        },
      ],
    },
    successCriteria: [
      {
        criterionId: "criterion-1",
        label: "Required sections",
        definition: "The final artifact includes Goal, Prompt pattern, Recommendation, and Source-backed note sections.",
        critical: true,
        verificationMethod: "binary",
      },
      {
        criterionId: "criterion-2",
        label: "Source-backed claims",
        definition: "The final artifact includes at least two explicit source-backed claims tied to the prompt-engineering packet.",
        critical: true,
        verificationMethod: "binary",
      },
      {
        criterionId: "criterion-3",
        label: "Actionable output",
        definition: "The final artifact includes at least three explicit recommendations a marketer could reuse immediately.",
        critical: true,
        verificationMethod: "binary",
      },
    ],
    bestRoom: {
      roomKey:
        family === "messaging-translation" ? "messaging-lab" : "research-room",
      launchDomain:
        family === "messaging-translation"
          ? "positioning-messaging"
          : "research-insight",
      rationale: "Best fit for the selected mission family.",
    },
    sourceReferences: [
      {
        referenceId: "ref-1",
        sourceItemId: "src-1",
        claimIds: ["claim-1"],
        supportsSections: ["why_now", "why_marketing", "artifact"],
      },
      {
        referenceId: "ref-2",
        sourceItemId: "src-2",
        claimIds: ["claim-2"],
        supportsSections: ["steps", "success_criteria"],
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
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    tools: {
      primary: {
        toolKey: "chatgpt",
        displayName: "ChatGPT",
        resolutionType: "registry",
        capabilityTags: ["general-llm", "writing"],
        required: true,
        rationale: "Use a general LLM to build the artifact.",
      },
      supporting: [],
      disallowed: [],
    },
  };
}

describe("legacyPathProjector", () => {
  it("builds a minimal one-task compatibility path row", () => {
    const row = __testing.buildProjectedLearningPathRow(
      buildBrief("research-synthesis"),
    );

    expect(row.is_cached).toBe(false);
    expect(row.is_discoverable).toBe(false);
    expect(row.generation_engine).toBe("mission_projection");
    expect(row.items).toHaveLength(1);
    expect(row.items[0]?.task_type).toBe("do");
    expect(row.items[0]?.check).toBeNull();
    expect(row.items[0]?.reflection).toBeNull();
    expect(row.modules).toBeNull();
  });

  it("includes source-backed guidance in the tool prompt", () => {
    const prompt = __testing.buildProjectedToolPrompt(
      buildBrief("messaging-translation"),
    );

    expect(prompt).toContain("Source-backed requirements:");
    expect(prompt).toContain("Total source references attached: 2");
  });
});
