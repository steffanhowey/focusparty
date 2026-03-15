/**
 * Adaptation Engine — composes function + fluency contexts into
 * a single prompt block for the curriculum generator.
 *
 * Usage:
 *   const adaptation = buildAdaptedPromptContext("engineering", "exploring");
 *   // Append adaptation.adaptationBlock to the system prompt
 *   // Use adaptation.toolNames in the user prompt's "available tools" section
 */

import type { ProfessionalFunction } from "@/lib/onboarding/types";
import type { FluencyLevel } from "@/lib/onboarding/types";
import { FUNCTION_CONTEXTS, type FunctionContext } from "./functionContexts";
import { FLUENCY_CONTEXTS, type FluencyContext } from "./fluencyContexts";
import { getToolsForFunction, getPreferredToolSlugs } from "./functionToolPreferences";

/** The composed adaptation context returned to the generator. */
export interface AdaptationContext {
  /** The function context used */
  functionContext: FunctionContext;
  /** The fluency context used */
  fluencyContext: FluencyContext;
  /** Preferred tool slugs for this function (ordered by relevance) */
  preferredToolSlugs: string[];
  /** All tool names for this function (preferred + secondary, resolved) */
  toolNames: string[];
  /** The composed text block to append to the system prompt */
  adaptationBlock: string;
}

/**
 * Build the full adaptation context for a given function + fluency combination.
 * Returns a composed prompt block and supporting metadata.
 */
export function buildAdaptedPromptContext(
  fn: ProfessionalFunction,
  fluency: FluencyLevel,
  secondaryFunctions?: ProfessionalFunction[]
): AdaptationContext {
  const functionCtx = FUNCTION_CONTEXTS[fn];
  const fluencyCtx = FLUENCY_CONTEXTS[fluency];
  const tools = getToolsForFunction(fn);
  const preferredSlugs = getPreferredToolSlugs(fn);
  const toolNames = tools.map((t) => t.name);

  // Build secondary functions note if applicable
  let secondaryNote = "";
  if (secondaryFunctions && secondaryFunctions.length > 0) {
    const labels = secondaryFunctions
      .map((sf) => FUNCTION_CONTEXTS[sf]?.label)
      .filter(Boolean);
    if (labels.length > 0) {
      secondaryNote = `\nThe learner also works in: ${labels.join(", ")}. When relevant, draw connections to these domains, but keep the primary focus on ${functionCtx.label}.`;
    }
  }

  const adaptationBlock = `
───────────────────────────────────────────
ADAPTATION CONTEXT — FOLLOW THESE INSTRUCTIONS
───────────────────────────────────────────

TARGET LEARNER: ${functionCtx.label} professional at the "${fluencyCtx.label}" fluency level.
${secondaryNote}

FUNCTION PERSPECTIVE:
${functionCtx.perspective}

MISSION FRAMING:
${functionCtx.missionFraming}

SUCCESS CRITERIA:
${functionCtx.successCriteriaGuidance}

SCAFFOLDING DEPTH (${fluencyCtx.scaffoldingDepth}):
${fluencyCtx.promptGuidance}

LEARNER BACKGROUND:
${fluencyCtx.expectedPriorKnowledge}

PREFERRED TOOLS (use these in missions when possible):
${toolNames.length > 0 ? toolNames.map((n, i) => `${i + 1}. ${n}`).join("\n") : "Use any appropriate AI tool."}

TOPICS TO DE-PRIORITIZE:
${functionCtx.avoidTopics.length > 0 ? functionCtx.avoidTopics.join(", ") : "None"}

IMPORTANT: Every aspect of this path — tool selection, mission framing, success criteria, scaffolding depth, and content emphasis — must be adapted for a ${functionCtx.label} professional at the ${fluencyCtx.label} level. Do NOT produce generic content.
───────────────────────────────────────────`;

  return {
    functionContext: functionCtx,
    fluencyContext: fluencyCtx,
    preferredToolSlugs: preferredSlugs,
    toolNames,
    adaptationBlock,
  };
}
