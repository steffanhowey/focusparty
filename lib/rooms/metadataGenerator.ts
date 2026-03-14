// ─── Room Metadata Generator ─────────────────────────────────
// Uses GPT-4o-mini to generate room name, description, visual
// identity, and discovery metadata for auto-generated rooms.
// Output is compatible with BlueprintResult.world_config + discovery_config.

import OpenAI from "openai";
import { SAFETY_PROMPT } from "@/lib/breaks/contentSafety";
import type { CurriculumSequence } from "./contentSelector";

// ─── OpenAI singleton ───────────────────────────────────────

let _openai: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

// ─── Types ──────────────────────────────────────────────────

export interface RoomMetadata {
  world_config: {
    label: string;
    description: string;
    defaultSprintLength: number;
    targetRoomSize: number;
    accentColor: string;
    vibeKey: string;
    placeholderGradient: string;
    environmentOverlay: string;
  };
  discovery_config: {
    tags: string[];
    category: string;
    lobbyDescription: string;
  };
}

export interface MetadataInput {
  topicSlug: string;
  topicName: string;
  topicCategory: string;
  curriculum: CurriculumSequence;
  creators: string[];
}

// ─── Color pool for auto rooms ──────────────────────────────

const ACCENT_COLORS = [
  "#3B82F6", // blue
  "#10B981", // emerald
  "#8B5CF6", // violet
  "#F59E0B", // amber
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#F97316", // orange
  "#14B8A6", // teal
] as const;

// ─── Core ───────────────────────────────────────────────────

/**
 * Generate room metadata (name, description, visual identity, tags)
 * using GPT-4o-mini with Structured Outputs.
 */
export async function generateRoomMetadata(
  input: MetadataInput
): Promise<RoomMetadata> {
  try {
    const openai = getClient();

    const contentSummary = input.curriculum.items
      .slice(0, 8)
      .map((item) => `- "${item.title}" by ${item.creator} (${Math.round(item.durationSeconds / 60)}min)`)
      .join("\n");

    const systemPrompt = `You are the SkillGap Room Designer. You generate room identity and metadata for auto-generated learning rooms.

A room is a persistent learning environment where professionals do timed focus sprints and take breaks with curated video content. Each room has a name, description, visual identity, and discovery tags.

Design rules:
- Room name: catchy, 2-4 words, evokes the topic. Examples: "Cursor Lab", "Prompt Engineering Studio", "AI Agents Workshop"
- Description: 1-2 sentences explaining what learners will explore
- Sprint length: 25 for beginner topics, 50 for deep/advanced topics
- Room size: 8-12 people
- Accent color: pick a hex color that evokes the topic's domain
- Vibe key: one of "calm-focus", "energizing-flow", "deep-concentration", "ambient-chill"
- Tags: 3-6 lowercase hyphenated tags for discovery
- Category: one of "coding", "writing", "building", "focus", "learning"
- Lobby description: 1-2 sentences for the room listing

${SAFETY_PROMPT}`;

    const userPrompt = `Topic: ${input.topicName} (category: ${input.topicCategory})

Curated content (${input.curriculum.items.length} videos, ${input.curriculum.totalDurationMinutes} total minutes):
${contentSummary}

Featured creators: ${input.creators.join(", ")}

Difficulty progression: ${input.curriculum.difficultyProgression}

Generate the room identity and metadata.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "room_metadata",
          strict: true,
          schema: {
            type: "object",
            properties: {
              label: { type: "string" },
              description: { type: "string" },
              defaultSprintLength: { type: "number" },
              targetRoomSize: { type: "number" },
              accentColor: { type: "string" },
              vibeKey: {
                type: "string",
                enum: ["calm-focus", "energizing-flow", "deep-concentration", "ambient-chill"],
              },
              tags: {
                type: "array",
                items: { type: "string" },
              },
              category: {
                type: "string",
                enum: ["coding", "writing", "building", "focus", "learning"],
              },
              lobbyDescription: { type: "string" },
            },
            required: [
              "label", "description", "defaultSprintLength", "targetRoomSize",
              "accentColor", "vibeKey", "tags", "category", "lobbyDescription",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Empty LLM response");

    const parsed = JSON.parse(content) as {
      label: string;
      description: string;
      defaultSprintLength: number;
      targetRoomSize: number;
      accentColor: string;
      vibeKey: string;
      tags: string[];
      category: string;
      lobbyDescription: string;
    };

    return {
      world_config: {
        label: parsed.label,
        description: parsed.description,
        defaultSprintLength: parsed.defaultSprintLength,
        targetRoomSize: Math.min(parsed.targetRoomSize, 15),
        accentColor: parsed.accentColor,
        vibeKey: parsed.vibeKey,
        placeholderGradient: buildGradient(parsed.accentColor),
        environmentOverlay: buildOverlay(parsed.accentColor),
      },
      discovery_config: {
        tags: parsed.tags.slice(0, 6),
        category: parsed.category,
        lobbyDescription: parsed.lobbyDescription,
      },
    };
  } catch (err) {
    console.error("[rooms/metadataGenerator] LLM call failed, using defaults:", err);
    return buildDefaultMetadata(input);
  }
}

// ─── Helpers ────────────────────────────────────────────────

/** Build a dark CSS gradient from an accent color. */
function buildGradient(accentColor: string): string {
  return `linear-gradient(135deg, ${accentColor}22 0%, #0a0a0a 50%, ${accentColor}11 100%)`;
}

/** Build an environment overlay from an accent color. */
function buildOverlay(accentColor: string): string {
  return `linear-gradient(to bottom, ${accentColor}08 0%, transparent 40%, ${accentColor}05 100%)`;
}

/** Deterministic fallback metadata when LLM fails. */
function buildDefaultMetadata(input: MetadataInput): RoomMetadata {
  const colorIndex = Math.abs(hashCode(input.topicSlug)) % ACCENT_COLORS.length;
  const accentColor = ACCENT_COLORS[colorIndex];

  const categoryMap: Record<string, string> = {
    tool: "coding",
    platform: "coding",
    technique: "learning",
    concept: "learning",
    role: "building",
  };

  return {
    world_config: {
      label: `${input.topicName} Lab`,
      description: `Explore ${input.topicName} through curated video content and guided exercises.`,
      defaultSprintLength: 25,
      targetRoomSize: 10,
      accentColor,
      vibeKey: "calm-focus",
      placeholderGradient: buildGradient(accentColor),
      environmentOverlay: buildOverlay(accentColor),
    },
    discovery_config: {
      tags: [input.topicSlug, input.topicCategory, "auto-generated"],
      category: categoryMap[input.topicCategory] ?? "learning",
      lobbyDescription: `A curated learning room about ${input.topicName} with ${input.curriculum.items.length} videos from top creators.`,
    },
  };
}

/** Simple string hash for deterministic color selection. */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash;
}
