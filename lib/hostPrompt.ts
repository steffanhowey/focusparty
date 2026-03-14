import OpenAI from "openai";
import { getHostConfig } from "./hosts";
import type { HostGenerationInput, HostGenerationResult } from "./types";

let _openai: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

/**
 * Generate a host prompt using OpenAI gpt-4o-mini with Structured Outputs.
 *
 * Returns a structured result — the caller decides whether to post based on `shouldPost`.
 * Fails gracefully: returns shouldPost=false on any error so the session is never blocked.
 */
export async function generateHostPrompt(
  input: HostGenerationInput
): Promise<HostGenerationResult> {
  const config = getHostConfig(input.hostPersonality);
  const triggerHint =
    config.styleGuide.triggerHints[input.triggerType] ?? "";

  const systemPrompt = `${config.styleGuide.toneInstruction}

You are the AI host for a focus room called "${input.partyName}".
Your host name is ${config.hostName}. Your tone is: ${config.tone}.

RULES:
- Write 1–2 sentences maximum.
- No filler, no fluff, no greetings like "Hey team" or "Welcome back".
- No emojis unless the tone truly calls for it.
- Never say "I am an AI" or reference yourself as artificial.
- Never repeat a message you recently posted.
- If this moment doesn't need a message, set shouldPost to false.
- Match the personality tone precisely.

Recent host messages in this room (avoid repeating these):
${input.recentHostMessages.length > 0 ? input.recentHostMessages.map((m) => `- "${m}"`).join("\n") : "(none)"}${input.blueprintHints?.triggerHint ? `

ROOM-SPECIFIC GUIDANCE (from the room's learning design):
${input.blueprintHints.triggerHint}${input.blueprintHints.curriculumContext ? `\n${input.blueprintHints.curriculumContext}` : ""}` : ""}`;

  const linkedLine = input.linkedResource
    ? `Linked work item: [${input.linkedResource.provider}] "${input.linkedResource.title}" (${input.linkedResource.resourceType})`
    : null;

  const userPrompt = `Trigger: ${input.triggerType}
${triggerHint ? `Style hint: ${triggerHint}` : ""}
Goal: ${input.goalSummary ?? "(no goal set)"}${linkedLine ? `\n${linkedLine}` : ""}
Sprint: ${input.sprintNumber != null ? `#${input.sprintNumber}` : "n/a"}, duration: ${input.sprintDurationSec != null ? `${Math.round(input.sprintDurationSec / 60)}min` : "n/a"}, elapsed: ${input.sprintElapsedSec != null ? `${Math.round(input.sprintElapsedSec / 60)}min` : "n/a"}
Participants: ${input.participantCount}
Room state: ${input.roomState ?? "unknown"}
Recent activity:
${input.recentActivity.length > 0 ? input.recentActivity.map((a) => `- ${a}`).join("\n") : "(none)"}`;

  try {
    const response = await getClient().chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 256,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "host_prompt_result",
          strict: true,
          schema: {
            type: "object",
            properties: {
              shouldPost: { type: "boolean" },
              messageType: {
                type: "string",
                enum: ["opening", "midpoint", "reflection", "transition"],
              },
              body: { type: "string" },
              reason: { type: "string" },
            },
            required: ["shouldPost", "messageType", "body", "reason"],
            additionalProperties: false,
          },
        },
      },
    });

    const text = response.choices[0]?.message?.content;
    if (!text) {
      console.error("[hostPrompt] Empty response from OpenAI");
      return fallback("empty_response");
    }

    const parsed = JSON.parse(text) as HostGenerationResult;

    // Validate required fields (belt-and-suspenders — structured outputs should guarantee this)
    if (typeof parsed.shouldPost !== "boolean" || typeof parsed.body !== "string") {
      console.error("[hostPrompt] Invalid response shape:", parsed);
      return fallback("invalid_shape");
    }

    return parsed;
  } catch (err) {
    console.error("[hostPrompt] Generation failed:", err);
    return fallback("generation_error");
  }
}

function fallback(reason: string): HostGenerationResult {
  return {
    shouldPost: false,
    messageType: "transition",
    body: "",
    reason,
  };
}
