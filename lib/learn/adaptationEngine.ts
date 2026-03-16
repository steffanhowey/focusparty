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
  secondaryFunctions?: ProfessionalFunction[],
  userSkills?: Array<{ slug: string; name: string; fluency_level: string; paths_completed: number }>,
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

  // Build skill context if user has demonstrated skills
  let skillContextBlock = "";
  if (userSkills && userSkills.length > 0) {
    const fluencyOrder: Record<string, number> = { advanced: 3, proficient: 2, practicing: 1, exploring: 0 };
    const sorted = [...userSkills]
      .sort((a, b) => (fluencyOrder[b.fluency_level] ?? 0) - (fluencyOrder[a.fluency_level] ?? 0))
      .slice(0, 10);

    const skillLines = sorted
      .map(s => `- ${s.name}: ${s.fluency_level} (${s.paths_completed} path${s.paths_completed !== 1 ? "s" : ""} completed)`)
      .join("\n");

    const strongSkills = sorted.filter(s => s.fluency_level !== "exploring");
    const developingSkills = sorted.filter(s => s.fluency_level === "exploring");

    const guidanceLines: string[] = [];
    if (strongSkills.length > 0) {
      guidanceLines.push(
        `- BUILD ON existing ${strongSkills.map(s => s.name).join(", ")} skills — reference concepts they already know, skip introductory explanations for these`
      );
    }
    if (developingSkills.length > 0) {
      guidanceLines.push(
        `- FOCUS missions on developing ${developingSkills.map(s => s.name).join(", ")} — these are growth areas`
      );
    }
    guidanceLines.push(
      "- CONNECT new concepts to skills they've already demonstrated when possible",
      "- DO NOT re-teach fundamentals of skills they're Practicing or above",
      "- CALIBRATE difficulty: missions should stretch their current level, not repeat it"
    );

    skillContextBlock = `

SKILL CONTEXT — THE LEARNER'S CURRENT CAPABILITIES:
${skillLines}

When designing this path:
${guidanceLines.join("\n")}`;
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
${skillContextBlock}

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
