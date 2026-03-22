import { describe, expect, it } from "vitest";
import type { SourcePacketSourceItem } from "@/lib/missions/types/sourcePacket";
import {
  __testing,
  type ContentLakeRow,
  type RankedContentCandidate,
} from "./sourcePacketAssembler";

function buildContentRow(
  overrides: Partial<ContentLakeRow> = {},
): ContentLakeRow {
  return {
    id: overrides.id ?? "row-1",
    content_type: overrides.content_type ?? "video",
    external_id: overrides.external_id ?? "video-1",
    source: overrides.source ?? "youtube",
    source_url: overrides.source_url ?? "https://www.youtube.com/watch?v=1",
    title: overrides.title ?? "Prompt engineering walkthrough",
    description: overrides.description ?? "A coherent prompt engineering source.",
    creator_name: overrides.creator_name ?? "Community Creator",
    published_at: overrides.published_at ?? new Date().toISOString(),
    duration_seconds: overrides.duration_seconds ?? 600,
    article_word_count: overrides.article_word_count ?? null,
    article_text: overrides.article_text ?? null,
    quality_score: overrides.quality_score ?? 80,
    topics: overrides.topics ?? ["prompt-engineering"],
    editorial_note: overrides.editorial_note ?? null,
    indexed_at: overrides.indexed_at ?? new Date().toISOString(),
  };
}

function buildSourceItemFromCandidate(
  candidate: RankedContentCandidate,
  sourceItemId: string,
): SourcePacketSourceItem {
  const credibility = __testing.buildSourceCredibility(
    new URL(candidate.row.source_url).hostname.replace(/^www\./, ""),
    candidate.row.quality_score,
    candidate.evidenceTier,
    candidate.authority,
  );

  return {
    sourceItemId,
    sourceKind: candidate.sourceKind,
    evidenceTier: candidate.evidenceTier,
    stance: "supports",
    url: candidate.row.source_url,
    externalId: candidate.row.external_id,
    title: candidate.row.title,
    creatorOrPublication: candidate.row.creator_name,
    domain: new URL(candidate.row.source_url).hostname.replace(/^www\./, ""),
    publishedAt: candidate.row.published_at,
    discoveredAt: candidate.row.indexed_at,
    indexedAt: candidate.row.indexed_at,
    contentFormat: candidate.row.content_type === "video" ? "video" : "article",
    durationSeconds: candidate.row.duration_seconds,
    wordCount: candidate.row.article_word_count,
    summary: candidate.row.description ?? candidate.row.title,
    topics: candidate.row.topics,
    freshness: candidate.freshness,
    credibility,
    excerpts: [],
    claims: [],
  };
}

describe("sourcePacketAssembler authority + ranking", () => {
  it("matches official creators only on exact normalized aliases", () => {
    const topicProfile = __testing.buildTopicProfile("prompt-engineering", "Prompt Engineering");
    const exactMatch = __testing.assessAuthority(
      buildContentRow({
        creator_name: "Anthropic",
        title: "Prompt Engineering with Claude",
      }),
      topicProfile,
    );
    const fuzzyMatch = __testing.assessAuthority(
      buildContentRow({
        creator_name: "Anthropic Tutorials",
        title: "Prompt Engineering with Claude",
      }),
      topicProfile,
    );

    expect(exactMatch.authoritySourceType).toBe("official_creator");
    expect(exactMatch.matchedAuthorityKey).toBe("anthropic");
    expect(fuzzyMatch.authoritySourceType).toBe("community");
  });

  it("recognizes GitHub and Visual Studio Code as exact official creators for github-copilot only", () => {
    const topicProfile = __testing.buildTopicProfile("github-copilot", "GitHub Copilot");

    const githubAuthority = __testing.assessAuthority(
      buildContentRow({
        creator_name: "GitHub",
        title: "Getting started with GitHub Copilot | Tutorial",
        topics: ["github-copilot"],
      }),
      topicProfile,
    );
    const vscodeAuthority = __testing.assessAuthority(
      buildContentRow({
        creator_name: "Visual Studio Code",
        title: "Get to know GitHub Copilot in VS Code",
        topics: ["github-copilot"],
      }),
      topicProfile,
    );
    const falsePositiveAuthority = __testing.assessAuthority(
      buildContentRow({
        creator_name: "GitHub Tutorials",
        title: "Getting started with GitHub Copilot | Tutorial",
        topics: ["github-copilot"],
      }),
      topicProfile,
    );

    expect(githubAuthority.authoritySourceType).toBe("official_creator");
    expect(githubAuthority.matchedAuthorityKey).toBe("github");
    expect(vscodeAuthority.authoritySourceType).toBe("official_creator");
    expect(vscodeAuthority.matchedAuthorityKey).toBe("visual-studio-code");
    expect(falsePositiveAuthority.authoritySourceType).toBe("community");
  });

  it("lets strong official creator videos cross into high credibility via the floor", () => {
    const topicProfile = __testing.buildTopicProfile("prompt-engineering", "Prompt Engineering");
    const authority = __testing.assessAuthority(
      buildContentRow({
        creator_name: "Anthropic",
        quality_score: 91,
      }),
      topicProfile,
    );

    const credibility = __testing.buildSourceCredibility(
      "youtube.com",
      91,
      "secondary",
      authority,
    );

    expect(credibility.baseTier).toBe("low");
    expect(credibility.tier).toBe("high");
    expect(credibility.floorApplied).toBe(true);
  });

  it("treats code.claude.com docs as an official domain for claude-code", () => {
    const topicProfile = __testing.buildTopicProfile("claude-code", "Claude Code");
    const authority = __testing.assessAuthority(
      buildContentRow({
        content_type: "article",
        source_url: "https://code.claude.com/docs/en/overview",
        title: "Claude Code overview - Claude Code Docs",
        creator_name: "Anthropic",
        topics: ["claude-code"],
      }),
      topicProfile,
    );

    expect(authority.authoritySourceType).toBe("official_domain");
    expect(authority.matchedAuthorityKey).toBe("code.claude.com");
  });

  it("ranks coherent official creator sources ahead of generic tutorials", () => {
    const topicProfile = __testing.buildTopicProfile("prompt-engineering", "Prompt Engineering");
    const ranked = __testing.buildRankedContentCandidates(
      [
        buildContentRow({
          id: "official",
          creator_name: "Anthropic",
          title: "Prompt Engineering with Claude",
          description: "Prompt engineering patterns for better outputs.",
          quality_score: 88,
        }),
        buildContentRow({
          id: "generic",
          creator_name: "Community Creator",
          title: "21 Hacks 99% Of Users Don't Know",
          description: "A beginner full guide to build anything with AI.",
          quality_score: 96,
        }),
      ],
      topicProfile,
      21,
    );

    expect(ranked[0]?.row.id).toBe("official");
    expect(ranked[0]?.authority.authoritySourceType).toBe("official_creator");
    expect(ranked[1]?.genericTutorial).toBe(true);
  });

  it("records before-vs-after scoring audit for authoritative matches", () => {
    const topicProfile = __testing.buildTopicProfile("prompt-engineering", "Prompt Engineering");
    const ranked = __testing.buildRankedContentCandidates(
      [
        buildContentRow({
          id: "official",
          creator_name: "Anthropic",
          title: "Prompt Engineering with Claude",
          quality_score: 91,
        }),
      ],
      topicProfile,
      21,
    );
    const selected = ranked[0] ? [ranked[0]] : [];
    const sourceItems = selected.map((candidate, index) =>
      buildSourceItemFromCandidate(candidate, `src-${index + 1}-${candidate.row.id}`),
    );

    const diagnostics = __testing.buildPacketDiagnostics(sourceItems, selected, "llm");

    expect(diagnostics.authorityScoringAudit).toHaveLength(1);
    expect(diagnostics.authorityScoringAudit[0]?.baseTier).toBe("low");
    expect(diagnostics.authorityScoringAudit[0]?.adjustedTier).toBe("high");
    expect(diagnostics.authorityScoringAudit[0]?.floorApplied).toBe(true);
  });
});
