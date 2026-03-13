// ─── AI Blueprint Generation ─────────────────────────────────
// Prompt construction and response schema for the Room Factory.
// Uses OpenAI Structured Outputs to guarantee type-safe blueprints.

import { WORLD_CONFIGS, type WorldKey } from "../worlds";
import { HOST_CONFIGS } from "../hosts";
import { WORLD_BREAK_PROFILES } from "../breaks/worldBreakProfiles";
import { ROOM_VISUAL_PROFILES } from "../roomVisualProfiles";

// ─── Input Type ─────────────────────────────────────────────

export type RoomArchetype = "coder" | "writer" | "founder" | "gentle" | "custom";

export interface BlueprintInput {
  archetype: RoomArchetype;
  name: string;
  description: string;
  topic: string;
  audience: string;
  partnerInfo?: {
    partnerName: string;
    partnerLogo?: string;
    partnerAccent?: string;
  };
}

// ─── Archetype → Reference World Mapping ────────────────────

const ARCHETYPE_TO_WORLD: Record<RoomArchetype, WorldKey> = {
  coder: "vibe-coding",
  writer: "writer-room",
  founder: "yc-build",
  gentle: "gentle-start",
  custom: "default",
};

// ─── Prompt Builders ────────────────────────────────────────

export function buildBlueprintSystemPrompt(archetype: RoomArchetype): string {
  const refWorldKey = ARCHETYPE_TO_WORLD[archetype];
  const refWorld = WORLD_CONFIGS[refWorldKey];
  const refHost = HOST_CONFIGS[refWorldKey];
  const refBreaks = WORLD_BREAK_PROFILES[refWorldKey];
  const refVisual = ROOM_VISUAL_PROFILES[refWorldKey];

  return `You are the FocusParty Room Designer. You generate complete room configurations for a live focus environment platform.

Each room needs five configuration domains. Below is a REFERENCE EXAMPLE from an existing room ("${refWorld.label}") so you understand the expected depth and quality. Generate configurations at the same level of detail, but tailored to the new room's topic and audience.

## Domain 1: World Config
Controls the room's identity, timing, and visual accents.

Reference:
- label: "${refWorld.label}"
- description: "${refWorld.description}"
- defaultSprintLength: ${refWorld.defaultSprintLength}
- targetRoomSize: ${refWorld.targetRoomSize}
- accentColor: "${refWorld.accentColor}"
- vibeKey: one of "calm-focus", "energizing-flow", "deep-concentration", "ambient-chill"
- placeholderGradient: a CSS linear-gradient with dark tones (this is a dark UI)
- environmentOverlay: a CSS linear-gradient for text readability over a background image

## Domain 2: Host Config
Defines the AI host personality that guides focus sessions.

Reference:
- hostName: "${refHost.hostName}" (a short, memorable single-word name)
- tone: "${refHost.tone}" (3-4 adjective description)
- toneInstruction: "${refHost.styleGuide.toneInstruction}"
- triggerHints: {
    session_started: "${refHost.styleGuide.triggerHints.session_started ?? ""}",
    sprint_midpoint: "${refHost.styleGuide.triggerHints.sprint_midpoint ?? ""}",
    sprint_near_end: "${refHost.styleGuide.triggerHints.sprint_near_end ?? ""}",
    review_entered: "${refHost.styleGuide.triggerHints.review_entered ?? ""}"
  }
- cooldownSeconds: ${refHost.cooldownSeconds} (480-720)

## Domain 3: Break Profile
Controls what educational/break content is curated for room users.

Reference:
- queries: ${JSON.stringify(refBreaks.queries)} (YouTube search terms, min 4)
- channels: ${JSON.stringify(refBreaks.channels.map(c => ({ channelId: c.channelId, label: c.label, query: c.query })))} (YouTube channels, min 3)
- publishedAfterMonths: ${refBreaks.publishedAfterMonths}
- persona: {
    name: "${refBreaks.persona.name}",
    voicePrompt: "${refBreaks.persona.voicePrompt.substring(0, 200)}...",
    rejectPatterns: ${JSON.stringify(refBreaks.persona.rejectPatterns.slice(0, 3))},
    preferPatterns: ${JSON.stringify(refBreaks.persona.preferPatterns.slice(0, 3))}
  }
- creatorBoosts: ${JSON.stringify(Object.entries(refBreaks.creatorBoosts).slice(0, 4).map(([k, v]) => ({ channelName: k, weight: v })))}

## Domain 4: Visual Profile
Art direction for AI-generated room backgrounds.

Reference:
- masterPrompt: "${refVisual.masterPrompt.substring(0, 200)}..."
- continuityAnchors: ${JSON.stringify(refVisual.continuityAnchors)}
- palette: ${JSON.stringify(refVisual.palette)}
- lighting: "${refVisual.lighting.substring(0, 150)}..."
- cameraRules: "${refVisual.cameraRules.substring(0, 150)}..."
- negativeRules: ${JSON.stringify(refVisual.negativeRules.slice(0, 4))}
- uiSafeZones: a description of where UI overlays will go (bottom 40% dark, center-right quiet)
- timeOverrides: morning, evening, late_night — each with lighting, mood, and optional paletteAdjust

## Domain 5: Synthetic Config
Controls the mix of ambient AI coworkers in the room.

Available archetypes: "coder", "writer", "founder", "gentle"
- archetypeMix: weights that sum to 1.0 (e.g. { coder: 0.6, founder: 0.3, gentle: 0.1 })
- targetCount: 4-8 synthetics

## Domain 6: Discovery Config
Metadata for room discovery in the lobby.

- tags: 3-6 lowercase tags for search/filtering
- category: one of "coding", "writing", "building", "focus", "learning"
- lobbyDescription: 1-2 sentence description for the room card

RULES:
- Generate configurations that feel coherent — the host, breaks, visuals, and synthetics should all serve the same audience and topic.
- The host name must be a single word, memorable, and distinct from existing hosts (Guide, Syntax, Quill, Atlas, Bloom).
- Break content queries must be specific to the topic, not generic.
- Channel sources must be real YouTube channels relevant to the topic. Use real channel IDs if you know them, otherwise use placeholder "UC" + 22 character IDs.
- Visual profiles must describe a real, photographable space — no fantasy or surreal elements.
- Keep the dark UI theme in mind — placeholderGradients and overlays use dark colors.
- accentColor should be a hex color distinct from existing rooms (#3B82F6 blue, #10B981 green, #8B5CF6 purple, #F59E0B amber, #EC4899 pink).`;
}

export function buildBlueprintUserPrompt(input: BlueprintInput): string {
  let prompt = `Generate a complete room configuration for:

Room Name: ${input.name}
Description: ${input.description}
Primary Topic: ${input.topic}
Target Audience: ${input.audience}
Archetype: ${input.archetype}`;

  if (input.partnerInfo) {
    prompt += `\n\nPartner Integration:
Partner: ${input.partnerInfo.partnerName}${input.partnerInfo.partnerAccent ? `\nBrand Accent: ${input.partnerInfo.partnerAccent}` : ""}`;
  }

  prompt += `\n\nGenerate the full blueprint with all six domains. Be specific and detailed — this configuration will directly drive a live room.`;

  return prompt;
}

// ─── JSON Schema for Structured Outputs ─────────────────────

export const BLUEPRINT_RESPONSE_SCHEMA = {
  name: "room_blueprint",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      world_config: {
        type: "object" as const,
        properties: {
          label: { type: "string" as const },
          description: { type: "string" as const },
          defaultSprintLength: { type: "number" as const },
          targetRoomSize: { type: "number" as const },
          accentColor: { type: "string" as const },
          vibeKey: {
            type: "string" as const,
            enum: ["calm-focus", "energizing-flow", "deep-concentration", "ambient-chill"],
          },
          placeholderGradient: { type: "string" as const },
          environmentOverlay: { type: "string" as const },
        },
        required: [
          "label",
          "description",
          "defaultSprintLength",
          "targetRoomSize",
          "accentColor",
          "vibeKey",
          "placeholderGradient",
          "environmentOverlay",
        ],
        additionalProperties: false,
      },
      host_config: {
        type: "object" as const,
        properties: {
          hostName: { type: "string" as const },
          tone: { type: "string" as const },
          toneInstruction: { type: "string" as const },
          triggerHints: {
            type: "object" as const,
            properties: {
              session_started: { type: "string" as const },
              sprint_midpoint: { type: "string" as const },
              sprint_near_end: { type: "string" as const },
              review_entered: { type: "string" as const },
            },
            required: [
              "session_started",
              "sprint_midpoint",
              "sprint_near_end",
              "review_entered",
            ],
            additionalProperties: false,
          },
          cooldownSeconds: { type: "number" as const },
        },
        required: [
          "hostName",
          "tone",
          "toneInstruction",
          "triggerHints",
          "cooldownSeconds",
        ],
        additionalProperties: false,
      },
      synthetic_config: {
        type: "object" as const,
        properties: {
          archetypeMix: {
            type: "object" as const,
            properties: {
              coder: { type: "number" as const },
              writer: { type: "number" as const },
              founder: { type: "number" as const },
              gentle: { type: "number" as const },
            },
            required: ["coder", "writer", "founder", "gentle"],
            additionalProperties: false,
          },
          targetCount: { type: "number" as const },
        },
        required: ["archetypeMix", "targetCount"],
        additionalProperties: false,
      },
      break_profile: {
        type: "object" as const,
        properties: {
          queries: {
            type: "array" as const,
            items: { type: "string" as const },
          },
          channels: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                channelId: { type: "string" as const },
                label: { type: "string" as const },
                query: { type: "string" as const },
              },
              required: ["channelId", "label", "query"],
              additionalProperties: false,
            },
          },
          publishedAfterMonths: { type: "number" as const },
          persona: {
            type: "object" as const,
            properties: {
              name: { type: "string" as const },
              voicePrompt: { type: "string" as const },
              rejectPatterns: {
                type: "array" as const,
                items: { type: "string" as const },
              },
              preferPatterns: {
                type: "array" as const,
                items: { type: "string" as const },
              },
            },
            required: ["name", "voicePrompt", "rejectPatterns", "preferPatterns"],
            additionalProperties: false,
          },
          creatorBoosts: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                channelName: { type: "string" as const },
                weight: { type: "number" as const },
              },
              required: ["channelName", "weight"],
              additionalProperties: false,
            },
          },
        },
        required: [
          "queries",
          "channels",
          "publishedAfterMonths",
          "persona",
          "creatorBoosts",
        ],
        additionalProperties: false,
      },
      visual_profile: {
        type: "object" as const,
        properties: {
          masterPrompt: { type: "string" as const },
          continuityAnchors: {
            type: "array" as const,
            items: { type: "string" as const },
          },
          palette: {
            type: "object" as const,
            properties: {
              dominant: {
                type: "array" as const,
                items: { type: "string" as const },
              },
              accent: {
                type: "array" as const,
                items: { type: "string" as const },
              },
              avoid: {
                type: "array" as const,
                items: { type: "string" as const },
              },
            },
            required: ["dominant", "accent", "avoid"],
            additionalProperties: false,
          },
          lighting: { type: "string" as const },
          cameraRules: { type: "string" as const },
          negativeRules: {
            type: "array" as const,
            items: { type: "string" as const },
          },
          uiSafeZones: { type: "string" as const },
          timeOverrides: {
            type: "object" as const,
            properties: {
              morning: {
                type: "object" as const,
                properties: {
                  lighting: { type: "string" as const },
                  mood: { type: "string" as const },
                },
                required: ["lighting", "mood"],
                additionalProperties: false,
              },
              evening: {
                type: "object" as const,
                properties: {
                  lighting: { type: "string" as const },
                  mood: { type: "string" as const },
                },
                required: ["lighting", "mood"],
                additionalProperties: false,
              },
              late_night: {
                type: "object" as const,
                properties: {
                  lighting: { type: "string" as const },
                  mood: { type: "string" as const },
                },
                required: ["lighting", "mood"],
                additionalProperties: false,
              },
            },
            required: ["morning", "evening", "late_night"],
            additionalProperties: false,
          },
        },
        required: [
          "masterPrompt",
          "continuityAnchors",
          "palette",
          "lighting",
          "cameraRules",
          "negativeRules",
          "uiSafeZones",
          "timeOverrides",
        ],
        additionalProperties: false,
      },
      discovery_config: {
        type: "object" as const,
        properties: {
          tags: {
            type: "array" as const,
            items: { type: "string" as const },
          },
          category: {
            type: "string" as const,
            enum: ["coding", "writing", "building", "focus", "learning"],
          },
          lobbyDescription: { type: "string" as const },
        },
        required: ["tags", "category", "lobbyDescription"],
        additionalProperties: false,
      },
    },
    required: [
      "world_config",
      "host_config",
      "synthetic_config",
      "break_profile",
      "visual_profile",
      "discovery_config",
    ],
    additionalProperties: false,
  },
};

// ─── Validation ─────────────────────────────────────────────

export interface BlueprintResult {
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
  synthetic_config: {
    archetypeMix: Record<string, number>;
    targetCount: number;
  };
  break_profile: {
    queries: string[];
    channels: { channelId: string; label: string; query: string }[];
    publishedAfterMonths: number;
    persona: {
      name: string;
      voicePrompt: string;
      rejectPatterns: string[];
      preferPatterns: string[];
    };
    creatorBoosts: { channelName: string; weight: number }[];
  };
  visual_profile: {
    masterPrompt: string;
    continuityAnchors: string[];
    palette: { dominant: string[]; accent: string[]; avoid: string[] };
    lighting: string;
    cameraRules: string;
    negativeRules: string[];
    uiSafeZones: string;
    timeOverrides: {
      morning: { lighting: string; mood: string };
      evening: { lighting: string; mood: string };
      late_night: { lighting: string; mood: string };
    };
  };
  discovery_config: {
    tags: string[];
    category: string;
    lobbyDescription: string;
  };
}

/** Basic runtime validation of a blueprint result. */
export function validateBlueprint(raw: unknown): raw is BlueprintResult {
  if (!raw || typeof raw !== "object") return false;
  const bp = raw as Record<string, unknown>;

  const domains = [
    "world_config",
    "host_config",
    "synthetic_config",
    "break_profile",
    "visual_profile",
    "discovery_config",
  ];

  for (const d of domains) {
    if (!bp[d] || typeof bp[d] !== "object") return false;
  }

  const wc = bp.world_config as Record<string, unknown>;
  if (!wc.label || !wc.accentColor) return false;

  const hc = bp.host_config as Record<string, unknown>;
  if (!hc.hostName || !hc.toneInstruction) return false;

  return true;
}
