// ─── AI-Generated Synthetic Status Messages ─────────────────
// Uses gpt-4o-mini to generate realistic, archetype-aware
// status updates for synthetic participants. Falls back to
// a static pool on any error so sessions are never blocked.
//
// Realism pass: All messages should read as WORK TRACES —
// concrete artifacts, not feelings or moods.

import OpenAI from "openai";
import type { SyntheticArchetype } from "./pool";

// ─── OpenAI Client (singleton, same pattern as hostPrompt.ts) ──

let _openai: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

// ─── Types ──────────────────────────────────────────────────

export interface StatusMessageInput {
  archetype: SyntheticArchetype;
  displayName: string;
  worldKey: string;
  recentActivity: string[];
  recentSyntheticMessages: string[];
}

// ─── Archetype Descriptions (for prompt context) ────────────

const ARCHETYPE_CONTEXT: Record<SyntheticArchetype, string> = {
  coder:
    "a software developer — works on code, debugging, components, APIs, refactoring, tests, deploys",
  writer:
    "a writer — works on drafts, paragraphs, outlines, editing, chapters, copy",
  founder:
    "a startup founder — works on product, customers, metrics, pitches, features, growth",
  gentle:
    "someone doing calm, reflective work — works on journaling, studying, sketching, organizing, planning",
};

// ─── World Key Labels ───────────────────────────────────────

const WORLD_LABELS: Record<string, string> = {
  default: "general co-working",
  "vibe-coding": "coding and building",
  "writer-room": "writing and editing",
  "yc-build": "startup building",
  "gentle-start": "calm, low-pressure focus",
};

// ─── Static Fallback Pools (archetype-aware work traces) ─────
// Every message must read like a work trace — what the person
// is actually doing right now. No feelings, moods, or vibes.

const FALLBACK_MESSAGES: Record<SyntheticArchetype, string[]> = {
  coder: [
    "refactoring the auth middleware, almost clean",
    "tests are green on the new endpoint",
    "this edge case in the form validator is tricky",
    "debugging a weird state issue in the sidebar",
    "reviewing the diff from yesterday's PR",
    "wiring up the webhook handler now",
    "the migration script runs clean finally",
    "type errors",
    "fixing a flaky test",
    "almost done w/ the API refactor",
    "PR reviews",
    "stripping out deprecated config flags",
  ],
  writer: [
    "reworking the opening paragraph again",
    "outline for section three is solid now",
    "cutting the fluff from the second draft",
    "the transition between chapters needs work",
    "tightening the conclusion, almost there",
    "this metaphor in paragraph four finally lands",
    "trimming 200 words from the feature piece",
    "editing",
    "reading back yesterday's edits",
    "reserching for the next section",
    "ch. 3 revisions",
    "almost done w/ the blog post",
  ],
  founder: [
    "mapping out the onboarding flow changes",
    "reviewing customer interview notes from tuesday",
    "simplifying the pricing page copy",
    "the landing page A/B test data is in",
    "scoping the MVP down to three features",
    "updaing the pitch deck financials slide",
    "going through the NPS feedback batch",
    "sketching the new dashboard layout",
    "metrics review",
    "emails",
    "competitor research, almost done",
    "trying to finalize the feature spec",
  ],
  gentle: [
    "organizing notes from the morning reading",
    "filling in the weekly planner sections",
    "working through the study guide chapter by chapter",
    "sorting through the reference photos folder",
    "tidying up the project folders on my desktop",
    "mapping out the week ahead in the planner",
    "annotating the readings from yesterday",
    "journaling",
    "notes",
    "reading",
    "cleaning up my bookmarks folder",
    "catching up on highlights from last week",
  ],
};

// ─── Fallback Picker ────────────────────────────────────────

export function pickFallbackMessage(archetype: SyntheticArchetype): string {
  const pool = FALLBACK_MESSAGES[archetype];
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── AI Generation ──────────────────────────────────────────

export async function generateStatusMessage(
  input: StatusMessageInput
): Promise<string> {
  const worldLabel = WORLD_LABELS[input.worldKey] ?? "co-working";
  const archetypeDesc = ARCHETYPE_CONTEXT[input.archetype];

  const systemPrompt = `You are roleplaying as ${input.displayName}, ${archetypeDesc}. They are working in a "${worldLabel}" themed co-working room.

Generate a natural status update (3–25 words) that this person would type to share what they're working on right now. Vary the length — sometimes 3 words, sometimes 20.

Write like a WORK TRACE — mention the specific artifact, file, section, or task you're touching. Never write about feelings, moods, energy, or vague momentum.

BAD (too vague/chatty): "feeling productive today", "hit a groove, keeping going", "deep in flow right now", "making steady progress"
GOOD (specific work trace): "cleaning up type errors in the auth module", "reworking the intro paragraph, almost there", "the onboarding funnel data finally makes sense", "emails", "almost done w/ the redesign"

RULES:
- Sound like a real person — casual, lowercase, abbreviations ok (rn, tmrw, w/, ch.)
- Be specific to what this archetype actually does day-to-day
- Reference concrete things: files, components, sections, pages, metrics, drafts
- No exclamation marks, no emojis, don't start with "just"
- Vary the structure — fragments ok, don't always start with a verb
- Occasionally (~10% of the time) include a small natural typo like a missing letter or swapped letters
- Never repeat or closely paraphrase these recent messages:
${input.recentSyntheticMessages.length > 0 ? input.recentSyntheticMessages.map((m) => `  - "${m}"`).join("\n") : "  (none)"}`;

  const userPrompt =
    input.recentActivity.length > 0
      ? `Recent room activity:\n${input.recentActivity.map((a) => `- ${a}`).join("\n")}`
      : "The room is quiet right now.";

  try {
    const response = await getClient().chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 100,
      temperature: 0.9,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "synthetic_status",
          strict: true,
          schema: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
            required: ["message"],
            additionalProperties: false,
          },
        },
      },
    });

    const text = response.choices[0]?.message?.content;
    if (!text) {
      console.warn("[synthetic-status] Empty response from OpenAI, using fallback");
      return pickFallbackMessage(input.archetype);
    }

    const parsed = JSON.parse(text) as { message: string };
    if (!parsed.message || typeof parsed.message !== "string" || parsed.message.length < 3) {
      console.warn("[synthetic-status] Invalid message shape, using fallback");
      return pickFallbackMessage(input.archetype);
    }

    console.log(`[synthetic-status] AI generated for ${input.displayName}: "${parsed.message}"`);
    return parsed.message;
  } catch (err) {
    console.error("[synthetic-status] Generation failed, using fallback:", err);
    return pickFallbackMessage(input.archetype);
  }
}
