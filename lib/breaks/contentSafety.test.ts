import { describe, it, expect } from "vitest";
import { screenContent, BLOCKED_CATEGORY_IDS, SAFETY_PROMPT } from "./contentSafety";

describe("screenContent", () => {
  it("passes safe educational content", () => {
    const result = screenContent(
      "How to Use AI for Product Management",
      "Learn the top 5 AI tools every PM should know."
    );
    expect(result.safe).toBe(true);
  });

  it("passes edgy but safe tech content", () => {
    const result = screenContent(
      "ThePrimeagen DESTROYS JavaScript Frameworks",
      "A no-holds-barred rant about why your framework sucks."
    );
    expect(result.safe).toBe(true);
  });

  it("blocks drug-related content", () => {
    const result = screenContent(
      "Microdosing for Productivity",
      "How LSD changed my coding sessions."
    );
    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.reason).toContain("Blocked keyword");
    }
  });

  it("blocks hate speech", () => {
    const result = screenContent(
      "White Supremacy in Tech",
      "Why the industry is doomed."
    );
    expect(result.safe).toBe(false);
  });

  it("blocks conspiracy content", () => {
    const result = screenContent(
      "The QAnon Connection to Big Tech",
      "What they don't want you to know."
    );
    expect(result.safe).toBe(false);
  });

  it("blocks NSFW content", () => {
    const result = screenContent(
      "NSFW AI Art Generation",
      "How to generate explicit content with Stable Diffusion."
    );
    expect(result.safe).toBe(false);
  });

  it("blocks off-topic entertainment content", () => {
    const result = screenContent(
      "Celebrity Gossip Weekly Roundup",
      "Who wore what to the Met Gala."
    );
    expect(result.safe).toBe(false);
  });

  it("blocks self-harm content", () => {
    const result = screenContent(
      "Dealing with Burnout",
      "Self-harm and developer mental health."
    );
    expect(result.safe).toBe(false);
  });

  it("handles null description", () => {
    const result = screenContent("Learn TypeScript in 10 Minutes", null);
    expect(result.safe).toBe(true);
  });

  it("handles empty strings", () => {
    const result = screenContent("", "");
    expect(result.safe).toBe(true);
  });

  it("is case-insensitive", () => {
    const result = screenContent("MICRODOSING FOR FOCUS", "try it today");
    expect(result.safe).toBe(false);
  });

  it("uses word boundaries to avoid false positives", () => {
    // "therapist" should NOT match a drug pattern
    const result = screenContent(
      "Finding a Therapist for Startup Founders",
      "Mental health resources for entrepreneurs."
    );
    expect(result.safe).toBe(true);
  });
});

describe("BLOCKED_CATEGORY_IDS", () => {
  it("blocks music category", () => {
    expect(BLOCKED_CATEGORY_IDS.has("10")).toBe(true);
  });

  it("blocks gaming category", () => {
    expect(BLOCKED_CATEGORY_IDS.has("20")).toBe(true);
  });

  it("does not block education category", () => {
    expect(BLOCKED_CATEGORY_IDS.has("27")).toBe(false);
  });
});

describe("SAFETY_PROMPT", () => {
  it("contains mandatory safety rules", () => {
    expect(SAFETY_PROMPT).toContain("CONTENT SAFETY");
    expect(SAFETY_PROMPT).toContain("reject=true");
  });

  it("contains audience fit criteria", () => {
    expect(SAFETY_PROMPT).toContain("AUDIENCE FIT");
    expect(SAFETY_PROMPT).toContain("28-year-old startup engineer");
  });

  it("contains exceptions for edgy-but-safe content", () => {
    expect(SAFETY_PROMPT).toContain("NOT reasons to reject");
    expect(SAFETY_PROMPT).toContain("Casual profanity");
  });
});
