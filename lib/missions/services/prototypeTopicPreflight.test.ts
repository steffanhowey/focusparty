import { describe, expect, it } from "vitest";
import type { TopicCandidate } from "@/lib/missions/types/sourcePacket";
import type { ContentLakeRow, RankedContentCandidate } from "./sourcePacketAssembler";
import { __testing } from "./sourcePacketAssembler";
import { buildPrototypeTopicPreflightResult } from "./prototypeTopicPreflight";

function buildCandidate(
  id: string,
  overrides: Partial<ContentLakeRow> = {},
  topicSlug = "prompt-engineering",
  topicName = "Prompt Engineering",
): RankedContentCandidate {
  const row: ContentLakeRow = {
    id,
    content_type: "video",
    external_id: id,
    source: "youtube",
    source_url: `https://www.youtube.com/watch?v=${id}`,
    title: overrides.title ?? "Prompt engineering patterns",
    description: overrides.description ?? "Prompt engineering walkthrough.",
    creator_name: overrides.creator_name ?? "Community Creator",
    published_at: overrides.published_at ?? new Date().toISOString(),
    duration_seconds: overrides.duration_seconds ?? 600,
    article_word_count: null,
    article_text: null,
    quality_score: overrides.quality_score ?? 80,
    topics: overrides.topics ?? [topicSlug],
    editorial_note: overrides.editorial_note ?? null,
    indexed_at: overrides.indexed_at ?? new Date().toISOString(),
  };
  return __testing.buildRankedContentCandidates(
    [row],
    __testing.buildTopicProfile(topicSlug, topicName),
    21,
  )[0]!;
}

describe("prototype topic preflight", () => {
  it("passes a coherent topic with one authoritative source and two corroborating secondaries", () => {
    const candidate: TopicCandidate = {
      topicId: "11111111-1111-4111-8111-111111111111",
      topicSlug: "prompt-engineering",
      topicName: "Prompt Engineering",
      topicCategory: "technique",
      clusterId: null,
      discoveryReason: "manual_seed",
      signalIds: [],
      heatScoreSnapshot: null,
      signalCount7d: 0,
      sourceDiversity7d: 0,
    };
    const rankedCandidates = [
      buildCandidate("official", {
        creator_name: "Anthropic",
        title: "Prompt Engineering with Claude",
        quality_score: 91,
      }),
      buildCandidate("secondary-1", {
        title: "Prompt engineering workflow patterns",
        quality_score: 84,
      }),
      buildCandidate("secondary-2", {
        title: "Prompt engineering for marketers",
        quality_score: 83,
      }),
    ];

    const result = buildPrototypeTopicPreflightResult(candidate, {
      timelinessClass: "emerging-practice",
      lookbackDays: 21,
      rankedCandidates,
      selectedCandidates: rankedCandidates,
    });

    expect(result.passed).toBe(true);
    expect(result.authoritativeCandidateCount).toBe(1);
    expect(result.coherentSecondaryCount).toBe(2);
    expect(result.coherenceScore).toBeGreaterThanOrEqual(0.6);
  });

  it("rejects broad umbrella topics with low coherence across multiple workflow surfaces", () => {
    const candidate: TopicCandidate = {
      topicId: "22222222-2222-4222-8222-222222222222",
      topicSlug: "chatgpt",
      topicName: "ChatGPT",
      topicCategory: "tool",
      clusterId: null,
      discoveryReason: "manual_seed",
      signalIds: [],
      heatScoreSnapshot: null,
      signalCount7d: 0,
      sourceDiversity7d: 0,
    };
    const rankedCandidates = [
      buildCandidate(
        "coding",
        {
          title: "Build an app with AI",
          description: "Code and app workflows with LLMs.",
          topics: ["app-building"],
        },
        "chatgpt",
        "ChatGPT",
      ),
      buildCandidate(
        "prompting",
        {
          title: "Prompt engineering tutorial",
          description: "Prompt engineering for better outputs.",
          topics: ["prompt-engineering"],
        },
        "chatgpt",
        "ChatGPT",
      ),
      buildCandidate(
        "workflow",
        {
          title: "Productivity workflow hacks",
          description: "Workflow automation and productivity tips.",
          topics: ["workflow-automation"],
        },
        "chatgpt",
        "ChatGPT",
      ),
    ];

    const result = buildPrototypeTopicPreflightResult(candidate, {
      timelinessClass: "evergreen-foundation",
      lookbackDays: 90,
      rankedCandidates,
      selectedCandidates: rankedCandidates,
    });

    expect(result.passed).toBe(false);
    expect(result.failureReasons).toContain("low_candidate_coherence");
    expect(result.failureReasons).toContain("umbrella_topic_shape");
  });
});
