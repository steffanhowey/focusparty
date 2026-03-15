/**
 * Editorial seed data for the 28 onboarding picks (7 functions × 4 fluency levels).
 *
 * Each pick defines:
 * - path_topic: the query passed to the curriculum generator
 * - display_title: what the user sees in onboarding Step 3
 * - display_description: one-line "You'll learn to..." description
 * - time_estimate_min: expected completion time
 * - module_count: number of modules in the generated path
 * - tool_names: primary tools featured in this path
 *
 * The admin seed endpoint uses these to:
 * 1. Generate adapted learning paths via the curriculum generator
 * 2. Insert rows into fp_onboarding_picks with display metadata
 */

import type { ProfessionalFunction, FluencyLevel } from "./types";

export interface SeedPick {
  function: ProfessionalFunction;
  fluency_level: FluencyLevel;
  path_topic: string;
  display_title: string;
  display_description: string;
  time_estimate_min: number;
  module_count: number;
  tool_names: string[];
}

export const SEED_PICKS: SeedPick[] = [
  // ─── Engineering ────────────────────────────────────────────

  {
    function: "engineering",
    fluency_level: "exploring",
    path_topic: "getting started with AI coding assistants",
    display_title: "Your First AI-Assisted Feature",
    display_description:
      "You'll build a working feature using an AI coding assistant, step by step.",
    time_estimate_min: 35,
    module_count: 4,
    tool_names: ["Cursor", "ChatGPT"],
  },
  {
    function: "engineering",
    fluency_level: "practicing",
    path_topic: "AI-assisted coding with Cursor",
    display_title: "Ship Faster with Cursor",
    display_description:
      "You'll scaffold, iterate, and debug a real component using AI-powered development.",
    time_estimate_min: 40,
    module_count: 4,
    tool_names: ["Cursor", "Claude"],
  },
  {
    function: "engineering",
    fluency_level: "proficient",
    path_topic: "advanced AI coding workflows and agentic development",
    display_title: "Agentic Development Workflows",
    display_description:
      "You'll build a multi-file feature using AI agents for planning, coding, and testing.",
    time_estimate_min: 45,
    module_count: 5,
    tool_names: ["Cursor", "Claude", "Copilot"],
  },
  {
    function: "engineering",
    fluency_level: "advanced",
    path_topic: "building custom AI developer tools and integrations",
    display_title: "Build Your Own AI Dev Tools",
    display_description:
      "You'll design and implement a custom AI-powered workflow for your engineering team.",
    time_estimate_min: 50,
    module_count: 5,
    tool_names: ["Claude", "Cursor", "Copilot"],
  },

  // ─── Marketing ──────────────────────────────────────────────

  {
    function: "marketing",
    fluency_level: "exploring",
    path_topic: "AI-powered content creation for marketers",
    display_title: "AI-Powered Content Creation",
    display_description:
      "You'll create a content calendar and ad copy using AI, with guided prompts throughout.",
    time_estimate_min: 35,
    module_count: 4,
    tool_names: ["ChatGPT", "Claude"],
  },
  {
    function: "marketing",
    fluency_level: "practicing",
    path_topic: "AI content strategy and campaign planning",
    display_title: "AI Content Strategy",
    display_description:
      "You'll build a full content strategy with audience personas, topic clusters, and channel plans.",
    time_estimate_min: 40,
    module_count: 4,
    tool_names: ["Claude", "ChatGPT"],
  },
  {
    function: "marketing",
    fluency_level: "proficient",
    path_topic: "scaling marketing output with AI automation",
    display_title: "Scale Your Marketing with AI",
    display_description:
      "You'll build repeatable AI workflows for content production, personalization, and analysis.",
    time_estimate_min: 45,
    module_count: 5,
    tool_names: ["Claude", "ChatGPT", "Midjourney"],
  },
  {
    function: "marketing",
    fluency_level: "advanced",
    path_topic: "AI-native marketing operations and team workflows",
    display_title: "AI-Native Marketing Operations",
    display_description:
      "You'll design an AI-powered marketing system your whole team can use.",
    time_estimate_min: 50,
    module_count: 5,
    tool_names: ["Claude", "ChatGPT", "Midjourney"],
  },

  // ─── Design ─────────────────────────────────────────────────

  {
    function: "design",
    fluency_level: "exploring",
    path_topic: "AI design tools for beginners",
    display_title: "Design Your First AI Prototype",
    display_description:
      "You'll generate a working interactive prototype from a text description, no code required.",
    time_estimate_min: 35,
    module_count: 4,
    tool_names: ["v0", "Midjourney"],
  },
  {
    function: "design",
    fluency_level: "practicing",
    path_topic: "rapid prototyping with AI design tools",
    display_title: "Rapid Prototyping with AI",
    display_description:
      "You'll iterate through multiple design concepts at speed using AI-powered tools.",
    time_estimate_min: 40,
    module_count: 4,
    tool_names: ["v0", "Midjourney", "Claude"],
  },
  {
    function: "design",
    fluency_level: "proficient",
    path_topic: "AI-powered design systems and visual exploration",
    display_title: "AI-Powered Design Systems",
    display_description:
      "You'll create a cohesive design system using AI for component generation and visual exploration.",
    time_estimate_min: 45,
    module_count: 5,
    tool_names: ["Midjourney", "v0", "Claude"],
  },
  {
    function: "design",
    fluency_level: "advanced",
    path_topic: "custom AI design workflows and creative direction",
    display_title: "AI Creative Direction",
    display_description:
      "You'll build a custom AI workflow that extends your creative process and teaches your team.",
    time_estimate_min: 50,
    module_count: 5,
    tool_names: ["Midjourney", "v0", "Claude"],
  },

  // ─── Product ────────────────────────────────────────────────

  {
    function: "product",
    fluency_level: "exploring",
    path_topic: "using AI for product management basics",
    display_title: "AI for Product Managers",
    display_description:
      "You'll draft your first PRD and user stories using AI, with guided prompts at every step.",
    time_estimate_min: 35,
    module_count: 4,
    tool_names: ["Claude", "ChatGPT"],
  },
  {
    function: "product",
    fluency_level: "practicing",
    path_topic: "writing PRDs and specs with AI",
    display_title: "Write Better Specs with AI",
    display_description:
      "You'll produce a complete PRD with requirements, user stories, and success metrics.",
    time_estimate_min: 40,
    module_count: 4,
    tool_names: ["Claude", "ChatGPT", "NotebookLM"],
  },
  {
    function: "product",
    fluency_level: "proficient",
    path_topic: "AI-powered user research synthesis and competitive analysis",
    display_title: "AI Research & Competitive Intel",
    display_description:
      "You'll synthesize research data and build competitive analyses using AI-powered workflows.",
    time_estimate_min: 45,
    module_count: 5,
    tool_names: ["Claude", "NotebookLM", "ChatGPT"],
  },
  {
    function: "product",
    fluency_level: "advanced",
    path_topic: "building AI-first product strategy and prototyping",
    display_title: "AI-First Product Strategy",
    display_description:
      "You'll prototype a product feature with AI and build a strategy for AI-native product development.",
    time_estimate_min: 50,
    module_count: 5,
    tool_names: ["Claude", "v0", "ChatGPT"],
  },

  // ─── Data & Analytics ───────────────────────────────────────

  {
    function: "data_analytics",
    fluency_level: "exploring",
    path_topic: "AI-powered data exploration for beginners",
    display_title: "Explore Data with AI",
    display_description:
      "You'll query a dataset using natural language and create your first AI-generated visualization.",
    time_estimate_min: 35,
    module_count: 4,
    tool_names: ["ChatGPT", "Claude"],
  },
  {
    function: "data_analytics",
    fluency_level: "practicing",
    path_topic: "AI-assisted data analysis and visualization",
    display_title: "AI-Powered Data Analysis",
    display_description:
      "You'll build a complete analysis pipeline: query, visualize, interpret, and present findings.",
    time_estimate_min: 40,
    module_count: 4,
    tool_names: ["Claude", "ChatGPT", "Replit"],
  },
  {
    function: "data_analytics",
    fluency_level: "proficient",
    path_topic: "building automated data reports and dashboards with AI",
    display_title: "Automated Reports & Dashboards",
    display_description:
      "You'll build an automated reporting workflow that turns raw data into stakeholder-ready insights.",
    time_estimate_min: 45,
    module_count: 5,
    tool_names: ["Claude", "Replit", "ChatGPT"],
  },
  {
    function: "data_analytics",
    fluency_level: "advanced",
    path_topic: "advanced AI analytics workflows and custom pipelines",
    display_title: "Custom AI Analytics Pipelines",
    display_description:
      "You'll design and build a reusable AI-powered analytics pipeline for your team.",
    time_estimate_min: 50,
    module_count: 5,
    tool_names: ["Claude", "Replit", "Cursor"],
  },

  // ─── Sales & Revenue ────────────────────────────────────────

  {
    function: "sales_revenue",
    fluency_level: "exploring",
    path_topic: "AI for sales prospecting and outreach basics",
    display_title: "AI-Powered Prospecting",
    display_description:
      "You'll research a real prospect and generate a personalized outreach email using AI.",
    time_estimate_min: 35,
    module_count: 4,
    tool_names: ["ChatGPT", "Claude"],
  },
  {
    function: "sales_revenue",
    fluency_level: "practicing",
    path_topic: "AI-assisted sales proposals and competitive intelligence",
    display_title: "Proposals & Competitive Intel with AI",
    display_description:
      "You'll build a proposal and competitive intelligence brief using AI research tools.",
    time_estimate_min: 40,
    module_count: 4,
    tool_names: ["Claude", "ChatGPT", "NotebookLM"],
  },
  {
    function: "sales_revenue",
    fluency_level: "proficient",
    path_topic: "scaling sales workflows with AI automation",
    display_title: "Scale Your Sales Process with AI",
    display_description:
      "You'll build repeatable AI workflows for prospecting, outreach, and deal preparation.",
    time_estimate_min: 45,
    module_count: 5,
    tool_names: ["Claude", "ChatGPT", "NotebookLM"],
  },
  {
    function: "sales_revenue",
    fluency_level: "advanced",
    path_topic: "AI-native sales operations and team playbooks",
    display_title: "AI-Native Sales Playbooks",
    display_description:
      "You'll design an AI-powered sales system with playbooks your whole team can run.",
    time_estimate_min: 50,
    module_count: 5,
    tool_names: ["Claude", "ChatGPT", "NotebookLM"],
  },

  // ─── Operations ─────────────────────────────────────────────

  {
    function: "operations",
    fluency_level: "exploring",
    path_topic: "AI workflow automation for beginners",
    display_title: "Automate Your First Workflow",
    display_description:
      "You'll identify a manual process and build your first AI-powered automation.",
    time_estimate_min: 35,
    module_count: 4,
    tool_names: ["ChatGPT", "Claude"],
  },
  {
    function: "operations",
    fluency_level: "practicing",
    path_topic: "AI-powered process documentation and SOPs",
    display_title: "AI-Powered SOPs & Docs",
    display_description:
      "You'll create professional SOPs and process documentation using AI assistance.",
    time_estimate_min: 40,
    module_count: 4,
    tool_names: ["Claude", "ChatGPT"],
  },
  {
    function: "operations",
    fluency_level: "proficient",
    path_topic: "building scalable AI automation systems for operations",
    display_title: "Scalable AI Automation",
    display_description:
      "You'll design a multi-step automation system with error handling and monitoring.",
    time_estimate_min: 45,
    module_count: 5,
    tool_names: ["Claude", "ChatGPT", "Replit"],
  },
  {
    function: "operations",
    fluency_level: "advanced",
    path_topic: "AI-native operations strategy and team enablement",
    display_title: "AI-Native Operations",
    display_description:
      "You'll build an AI operations playbook that transforms how your team works.",
    time_estimate_min: 50,
    module_count: 5,
    tool_names: ["Claude", "Replit", "ChatGPT"],
  },
];
