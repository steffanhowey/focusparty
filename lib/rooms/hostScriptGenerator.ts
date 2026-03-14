// ─── AI Host Script Generator ────────────────────────────────
// Uses GPT-4o-mini to generate a host personality for auto-generated
// rooms. Output is compatible with BlueprintResult.host_config.

import OpenAI from "openai";
import { SAFETY_PROMPT } from "@/lib/breaks/contentSafety";
import type { CurriculumSequence } from "./contentSelector";
import type { RoomMetadata } from "./metadataGenerator";

// ─── OpenAI singleton ───────────────────────────────────────

let _openai: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

// ─── Types ──────────────────────────────────────────────────

export interface HostScript {
  host_config: {
    hostName: string;
    tone: string;
    toneInstruction: string;
    triggerHints: {
      session_started: string;
      sprint_midpoint: string;
      sprint_near_end: string;
      review_entered: string;
    };
    cooldownSeconds: number;
  };
}

export interface HostScriptInput {
  topicName: string;
  topicCategory: string;
  curriculum: CurriculumSequence;
  roomMetadata: RoomMetadata;
}

// ─── Core ───────────────────────────────────────────────────

/**
 * Generate a host personality for an auto-generated room.
 * Uses GPT-4o-mini with Structured Outputs.
 */
export async function generateHostScript(
  input: HostScriptInput
): Promise<HostScript> {
  try {
    const openai = getClient();

    const contentTitles = input.curriculum.items
      .slice(0, 6)
      .map((item) => `- "${item.title}"`)
      .join("\n");

    const systemPrompt = `You are designing an AI host personality for a SkillGap.ai learning room.

The host is a friendly, knowledgeable facilitator who guides learners through timed focus sprints. They send short messages at key moments (session start, sprint midpoint, near end, review).

Existing host examples:
- "Syntax" (vibe-coding): concise, builder-focused, energetic. Says things like "Ship it."
- "Quill" (writer-room): calm, reflective, craft-oriented. Encourages deep thought.
- "Atlas" (yc-build): ambitious, founder-minded, execution-focused. High-energy.
- "Bloom" (gentle-start): supportive, low-pressure, momentum-first.

Design rules:
- hostName: a single memorable word that evokes the topic (NOT a human name)
- tone: 3-4 adjectives describing the personality
- toneInstruction: 2-3 sentence system prompt for the host LLM — how should it speak?
- triggerHints: guidance for EACH of these 4 moments (1-2 sentences each):
  * session_started: welcome the learner, set context for the topic
  * sprint_midpoint: gentle check-in, encourage momentum
  * sprint_near_end: motivate final push, preview what's next
  * review_entered: celebrate progress, suggest reflection
- cooldownSeconds: 480-720 (min time between host messages)

The host should be specific to the topic, not generic.

${SAFETY_PROMPT}`;

    const userPrompt = `Room: "${input.roomMetadata.world_config.label}"
Topic: ${input.topicName} (${input.topicCategory})
Vibe: ${input.roomMetadata.world_config.vibeKey}
Description: ${input.roomMetadata.world_config.description}

Curated content:
${contentTitles}

Difficulty: ${input.curriculum.difficultyProgression}

Generate the host personality.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "host_script",
          strict: true,
          schema: {
            type: "object",
            properties: {
              hostName: { type: "string" },
              tone: { type: "string" },
              toneInstruction: { type: "string" },
              triggerHints: {
                type: "object",
                properties: {
                  session_started: { type: "string" },
                  sprint_midpoint: { type: "string" },
                  sprint_near_end: { type: "string" },
                  review_entered: { type: "string" },
                },
                required: ["session_started", "sprint_midpoint", "sprint_near_end", "review_entered"],
                additionalProperties: false,
              },
              cooldownSeconds: { type: "number" },
            },
            required: ["hostName", "tone", "toneInstruction", "triggerHints", "cooldownSeconds"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Empty LLM response");

    const parsed = JSON.parse(content) as HostScript["host_config"];

    // Clamp cooldown to valid range
    parsed.cooldownSeconds = Math.max(480, Math.min(720, parsed.cooldownSeconds));

    return { host_config: parsed };
  } catch (err) {
    console.error("[rooms/hostScriptGenerator] LLM call failed, using defaults:", err);
    return buildDefaultHostScript(input);
  }
}

// ─── Helpers ────────────────────────────────────────────────

/** Deterministic fallback host when LLM fails. */
function buildDefaultHostScript(input: HostScriptInput): HostScript {
  // Derive host name from first word of topic name
  const firstWord = input.topicName.split(/\s+/)[0] ?? "Guide";
  const hostName = firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();

  return {
    host_config: {
      hostName,
      tone: "knowledgeable, encouraging, concise",
      toneInstruction: `You are ${hostName}, a friendly learning facilitator for ${input.topicName}. Keep messages short (1-2 sentences). Be specific about the topic, reference the curated content when relevant, and encourage hands-on practice.`,
      triggerHints: {
        session_started: `Welcome the learner and briefly frame what they'll explore about ${input.topicName} today.`,
        sprint_midpoint: "Gentle check-in. Acknowledge their focus and offer a quick tip related to the topic.",
        sprint_near_end: "Motivate the final push. Preview the break content they'll get to explore next.",
        review_entered: "Celebrate their progress. Suggest one specific thing they could reflect on or try.",
      },
      cooldownSeconds: 600,
    },
  };
}
