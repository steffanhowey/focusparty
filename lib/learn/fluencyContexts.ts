/**
 * Fluency-level context for curriculum adaptation.
 *
 * Each fluency level defines scaffolding depth, mission complexity,
 * and prompt guidance that shapes how the curriculum generator produces
 * learning paths. These contexts are injected into the LLM system prompt
 * by the adaptation engine.
 */

import type { FluencyLevel } from "@/lib/onboarding/types";

/** Scaffolding depth — how much hand-holding the learner gets. */
export type ScaffoldingDepth = "guided" | "scaffolded" | "independent" | "solo";

/** Mission complexity tier. */
export type MissionComplexity = "basic" | "moderate" | "advanced" | "expert";

/** Context definition for a single fluency level. */
export interface FluencyContext {
  /** Display name */
  label: string;
  /** How much hand-holding to provide */
  scaffoldingDepth: ScaffoldingDepth;
  /** Instructions for the LLM on scaffolding depth */
  promptGuidance: string;
  /** Mission complexity tier */
  missionComplexity: MissionComplexity;
  /** What the learner already knows — helps LLM skip basics */
  expectedPriorKnowledge: string;
}

/** Fluency-level contexts keyed by FluencyLevel. */
export const FLUENCY_CONTEXTS: Record<FluencyLevel, FluencyContext> = {
  exploring: {
    label: "Exploring",
    scaffoldingDepth: "guided",
    promptGuidance: `The learner is brand new to AI tools. Provide MAXIMUM guidance:
- Every mission MUST include a complete, ready-to-paste prompt
- Include step-by-step instructions with screenshots-style detail ("Click the chat box, paste this prompt, press Enter")
- Explain what the AI output means and what to look for
- Pre-build all prompts — the learner should never need to write one from scratch
- Use simple, jargon-free language
- Include "What just happened?" explanations after each step
- The first module should be pure orientation: what the tool is, why it matters, what you'll build today`,
    missionComplexity: "basic",
    expectedPriorKnowledge:
      "The learner has heard about AI tools but has not used them meaningfully for work. They may have tried ChatGPT once or twice casually. Assume zero familiarity with prompting, tool interfaces, or AI capabilities.",
  },

  practicing: {
    label: "Practicing",
    scaffoldingDepth: "scaffolded",
    promptGuidance: `The learner has basic AI tool experience but isn't confident. Provide MODERATE guidance:
- First mission: provide a complete prompt with explanation of why it works
- Second mission: provide a prompt skeleton with blanks for the learner to fill in
- Third mission: describe the goal and suggest an approach, but let the learner write the prompt
- Explain key concepts briefly but don't over-explain basics
- Include tips on what makes a good prompt vs. a mediocre one
- Offer "Try this variation" suggestions to build experimentation skills
- Modules should progress from guided to semi-independent within the same path`,
    missionComplexity: "moderate",
    expectedPriorKnowledge:
      "The learner has tried AI tools a few times. They can use ChatGPT for simple questions but struggle with complex prompts, multi-step workflows, or getting consistent quality. They understand the basic concept of prompting but lack technique.",
  },

  proficient: {
    label: "Proficient",
    scaffoldingDepth: "independent",
    promptGuidance: `The learner uses AI tools regularly and wants to get better. Provide MINIMAL guidance:
- Describe the mission objective and success criteria — let them figure out the approach
- Focus on advanced techniques: chaining prompts, system prompts, structured outputs, iterative refinement
- Include edge cases and failure modes ("What happens when the AI gets this wrong? How do you recover?")
- Missions should involve real-world complexity: messy inputs, ambiguous requirements, multi-tool workflows
- Don't provide pre-built prompts — describe what the prompt should accomplish
- Include professional-grade evaluation criteria
- Challenge them to optimize for quality AND efficiency`,
    missionComplexity: "advanced",
    expectedPriorKnowledge:
      "The learner uses AI tools regularly in their workflow. They can write decent prompts, know multiple tools, and have a working mental model of AI capabilities and limitations. They want to move from 'functional' to 'expert'.",
  },

  advanced: {
    label: "Advanced",
    scaffoldingDepth: "solo",
    promptGuidance: `The learner is already fluent and wants to push boundaries. Provide ZERO hand-holding:
- State the challenge and constraints — nothing else
- Focus on frontier techniques: custom agents, multi-step automation, API integration, tool composition
- Missions should be open-ended with multiple valid approaches
- Include "Build something novel" challenges where the learner defines the problem
- Evaluation criteria should be professional production-grade
- Encourage teaching: "How would you explain this technique to your team?"
- Include cross-functional challenges that stretch beyond their primary domain
- Skip all introductory content — link to docs for reference only`,
    missionComplexity: "expert",
    expectedPriorKnowledge:
      "The learner is AI-fluent. They've built custom workflows, integrated APIs, and may teach others. They understand model capabilities, prompting techniques, and tool ecosystems deeply. They want frontier knowledge and novel challenges.",
  },
};
