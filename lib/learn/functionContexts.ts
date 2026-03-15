/**
 * Function-specific context for curriculum adaptation.
 *
 * Each professional function gets a unique perspective, mission framing,
 * and success criteria that shapes how the curriculum generator produces
 * learning paths. These contexts are injected into the LLM system prompt
 * by the adaptation engine.
 */

import type { ProfessionalFunction } from "@/lib/onboarding/types";

/** Context definition for a single professional function. */
export interface FunctionContext {
  /** Display name */
  label: string;
  /** 2-sentence description of how this function uses AI — injected into system prompt */
  perspective: string;
  /** How missions should be worded for this function */
  missionFraming: string;
  /** What "done" means for this function */
  successCriteriaGuidance: string;
  /** Topics to de-prioritize for this function */
  avoidTopics: string[];
}

/** Function-specific contexts keyed by ProfessionalFunction. */
export const FUNCTION_CONTEXTS: Record<ProfessionalFunction, FunctionContext> = {
  engineering: {
    label: "Engineering",
    perspective:
      "Engineers use AI to ship faster — writing code with copilots, debugging with AI assistants, generating tests, and refactoring legacy systems. The goal is production-quality output, not experimentation.",
    missionFraming:
      "Frame missions as engineering tasks: build a feature, fix a bug, refactor a module, write tests, scaffold an API. The user should produce working code that could ship.",
    successCriteriaGuidance:
      "Success means the code works: it passes linting, handles edge cases, follows best practices, and could be merged into a real codebase. Evaluate for correctness, readability, and robustness.",
    avoidTopics: [
      "brand strategy",
      "content calendars",
      "ad creative",
      "sales outreach",
      "visual design theory",
    ],
  },

  marketing: {
    label: "Marketing",
    perspective:
      "Marketers use AI to produce at scale — generating on-brand copy, building content strategies, creating ad variations, and automating research. The goal is production-ready marketing output, not technical exploration.",
    missionFraming:
      "Frame missions as marketing deliverables: write campaign copy, build a content calendar, generate ad variations, create audience personas, draft email sequences. The user should produce work they can use in a real campaign.",
    successCriteriaGuidance:
      "Success means the output is usable: on-brand, audience-appropriate, structured for the channel, and ready to publish or present with minimal editing. Evaluate for clarity, persuasiveness, and strategic alignment.",
    avoidTopics: [
      "code architecture",
      "API design",
      "database schemas",
      "unit testing",
      "deployment pipelines",
    ],
  },

  design: {
    label: "Design",
    perspective:
      "Designers use AI to explore faster — generating visual concepts, prototyping interfaces, creating design variations, and building consistent systems. The goal is creative direction and rapid iteration, not pixel perfection.",
    missionFraming:
      "Frame missions as design explorations: generate concept variations, prototype a UI flow, create a visual system, iterate on a layout. The user should produce design artifacts they can build on.",
    successCriteriaGuidance:
      "Success means the output demonstrates creative range and intentionality: multiple directions from one brief, consistent visual language, and clear rationale for design decisions. Evaluate for creativity, coherence, and craft.",
    avoidTopics: [
      "backend architecture",
      "data pipelines",
      "sales forecasting",
      "SEO strategy",
      "financial modeling",
    ],
  },

  product: {
    label: "Product",
    perspective:
      "Product managers use AI to think and spec faster — synthesizing user research, writing PRDs, generating user stories, modeling competitive landscapes, and prototyping concepts. The goal is structured strategic thinking, not implementation.",
    missionFraming:
      "Frame missions as product artifacts: write a spec, synthesize research findings, draft user stories, create a competitive analysis, model a feature rollout. The user should produce documents and frameworks that drive decisions.",
    successCriteriaGuidance:
      "Success means the output is structured enough for a team to act on: clear problem statements, prioritized requirements, actionable user stories, and evidence-based reasoning. Evaluate for strategic clarity and actionability.",
    avoidTopics: [
      "code implementation details",
      "visual design craft",
      "sales pipeline management",
      "accounting workflows",
      "media buying",
    ],
  },

  data_analytics: {
    label: "Data & Analytics",
    perspective:
      "Data professionals use AI to explore and explain faster — querying datasets with natural language, generating visualizations, automating analyses, and building stakeholder-ready reports. The goal is actionable insight, not raw computation.",
    missionFraming:
      "Frame missions as analytical tasks: explore a dataset, build a visualization, generate an insight report, automate a recurring analysis, create a dashboard. The user should produce insights a non-technical stakeholder can act on.",
    successCriteriaGuidance:
      "Success means the output tells a clear story: the right data is surfaced, visualizations are appropriate, findings are contextualized, and recommendations are actionable. Evaluate for analytical rigor and communication clarity.",
    avoidTopics: [
      "brand identity",
      "UI prototyping",
      "sales outreach scripts",
      "content copywriting",
      "visual design systems",
    ],
  },

  sales_revenue: {
    label: "Sales & Revenue",
    perspective:
      "Sales professionals use AI to prospect and close faster — researching accounts, generating personalized outreach, building proposals, analyzing pipelines, and creating competitive intelligence. The goal is revenue-driving output, not academic research.",
    missionFraming:
      "Frame missions as sales deliverables: research a prospect, draft outreach emails, build a proposal, analyze competitive positioning, create a call prep brief. The user should produce materials they can use in their next deal.",
    successCriteriaGuidance:
      "Success means the output is ready to use: personalized to the prospect, data-backed, concise, and compelling. Evaluate for specificity, persuasiveness, and professional tone.",
    avoidTopics: [
      "code architecture",
      "visual design theory",
      "statistical modeling",
      "content strategy",
      "system administration",
    ],
  },

  operations: {
    label: "Operations",
    perspective:
      "Operations professionals use AI to systematize and automate — building workflows, optimizing processes, managing vendors, creating documentation, and analyzing operational data. The goal is scalable efficiency, not one-off solutions.",
    missionFraming:
      "Frame missions as operational improvements: automate a workflow, create a process document, build a vendor evaluation framework, design a reporting dashboard, draft SOPs. The user should produce systems that scale.",
    successCriteriaGuidance:
      "Success means the output is repeatable and scalable: clear steps, error handling, edge case coverage, and documentation that someone else can follow. Evaluate for thoroughness, clarity, and operational robustness.",
    avoidTopics: [
      "creative direction",
      "code refactoring",
      "user research synthesis",
      "brand positioning",
      "visual prototyping",
    ],
  },
};
