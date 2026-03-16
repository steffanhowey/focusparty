/**
 * Seed fp_skill_domains and fp_skills via Supabase JS client.
 *
 * Usage:
 *   set -a && source .env.local && set +a && npx tsx scripts/seed-skills.ts
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing Supabase env vars");

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface DomainSeed {
  slug: string;
  name: string;
  description: string;
  icon: string;
  sort_order: number;
}

interface SkillSeed {
  domain_slug: string;
  slug: string;
  name: string;
  description: string;
  relevant_functions: string[];
  sort_order: number;
}

const DOMAINS: DomainSeed[] = [
  { slug: "writing-communication", name: "Writing & Communication", description: "Prompt writing, content creation, narrative framing, tone calibration, and AI-assisted written communication.", icon: "pen-tool", sort_order: 1 },
  { slug: "technical-building", name: "Technical Building", description: "Code generation, architecture, debugging, deployment, and full-stack development with AI assistance.", icon: "code", sort_order: 2 },
  { slug: "data-analysis", name: "Data & Analysis", description: "Data exploration, visualization, storytelling, automated analysis, and insight generation using AI tools.", icon: "bar-chart-2", sort_order: 3 },
  { slug: "visual-design", name: "Visual & Design", description: "AI image direction, UI prototyping, rapid design iteration, visual systems, and brand direction.", icon: "palette", sort_order: 4 },
  { slug: "strategy-planning", name: "Strategy & Planning", description: "Research synthesis, scenario modeling, competitive analysis, roadmap generation, and decision frameworks.", icon: "compass", sort_order: 5 },
  { slug: "workflow-automation", name: "Workflow Automation", description: "Process mapping, no-code automation, tool integration, workflow optimization, and task automation.", icon: "workflow", sort_order: 6 },
  { slug: "persuasion-sales", name: "Persuasion & Sales", description: "AI-powered prospecting, proposal generation, pitch development, messaging optimization, and account research.", icon: "megaphone", sort_order: 7 },
  { slug: "operations-execution", name: "Operations & Execution", description: "SOP generation, AI project management, vendor evaluation, process improvement, and operational reporting.", icon: "settings", sort_order: 8 },
];

const SKILLS: SkillSeed[] = [
  // Writing & Communication
  { domain_slug: "writing-communication", slug: "prompt-engineering", name: "Prompt Engineering", description: "Crafting effective prompts that produce reliable, high-quality outputs from AI models.", relevant_functions: [], sort_order: 1 },
  { domain_slug: "writing-communication", slug: "ai-assisted-writing", name: "AI-Assisted Writing", description: "Using AI to draft, edit, and refine written content while maintaining voice and quality.", relevant_functions: ["marketing", "product"], sort_order: 2 },
  { domain_slug: "writing-communication", slug: "content-strategy", name: "Content Strategy with AI", description: "Planning and executing content programs using AI for ideation, creation, and optimization.", relevant_functions: ["marketing"], sort_order: 3 },
  { domain_slug: "writing-communication", slug: "tone-calibration", name: "Tone & Voice Calibration", description: "Directing AI to match specific brand voices, audience registers, and communication styles.", relevant_functions: ["marketing", "sales_revenue"], sort_order: 4 },
  { domain_slug: "writing-communication", slug: "email-generation", name: "Email Generation & Outreach", description: "Using AI to create personalized, effective email sequences and outreach campaigns.", relevant_functions: ["marketing", "sales_revenue"], sort_order: 5 },

  // Technical Building
  { domain_slug: "technical-building", slug: "ai-code-generation", name: "AI Code Generation", description: "Using AI coding assistants to generate, complete, and transform code efficiently.", relevant_functions: ["engineering"], sort_order: 1 },
  { domain_slug: "technical-building", slug: "ai-debugging", name: "AI-Assisted Debugging", description: "Leveraging AI to identify, diagnose, and fix bugs in code.", relevant_functions: ["engineering"], sort_order: 2 },
  { domain_slug: "technical-building", slug: "ai-testing", name: "AI-Powered Testing", description: "Using AI to generate test cases, write test suites, and improve code coverage.", relevant_functions: ["engineering"], sort_order: 3 },
  { domain_slug: "technical-building", slug: "full-stack-ai", name: "Full-Stack AI Development", description: "Building complete applications using AI assistance across frontend, backend, and infrastructure.", relevant_functions: ["engineering"], sort_order: 4 },
  { domain_slug: "technical-building", slug: "api-integration", name: "API Integration & Tooling", description: "Connecting AI services and APIs into applications and workflows.", relevant_functions: ["engineering", "operations"], sort_order: 5 },

  // Data & Analysis
  { domain_slug: "data-analysis", slug: "data-exploration", name: "AI Data Exploration", description: "Using AI to explore, query, and understand datasets quickly.", relevant_functions: ["data_analytics"], sort_order: 1 },
  { domain_slug: "data-analysis", slug: "data-visualization", name: "AI-Powered Visualization", description: "Creating charts, dashboards, and visual representations of data with AI assistance.", relevant_functions: ["data_analytics", "product"], sort_order: 2 },
  { domain_slug: "data-analysis", slug: "data-storytelling", name: "Data Storytelling", description: "Translating data insights into compelling narratives for stakeholders.", relevant_functions: ["data_analytics", "product"], sort_order: 3 },
  { domain_slug: "data-analysis", slug: "automated-analysis", name: "Automated Analysis", description: "Setting up AI-powered analysis pipelines that run automatically on new data.", relevant_functions: ["data_analytics", "engineering"], sort_order: 4 },
  { domain_slug: "data-analysis", slug: "insight-generation", name: "Insight Generation", description: "Using AI to surface patterns, anomalies, and actionable insights from data.", relevant_functions: ["data_analytics"], sort_order: 5 },

  // Visual & Design
  { domain_slug: "visual-design", slug: "ai-image-direction", name: "AI Image Direction", description: "Directing AI image generators to produce specific visual outcomes through iterative prompting.", relevant_functions: ["design", "marketing"], sort_order: 1 },
  { domain_slug: "visual-design", slug: "ui-prototyping", name: "AI UI Prototyping", description: "Using AI tools to rapidly prototype user interfaces and interactive designs.", relevant_functions: ["design", "product"], sort_order: 2 },
  { domain_slug: "visual-design", slug: "design-iteration", name: "Rapid Design Iteration", description: "Accelerating the design process through AI-powered iteration and variation generation.", relevant_functions: ["design"], sort_order: 3 },
  { domain_slug: "visual-design", slug: "visual-systems", name: "Visual System Design", description: "Building consistent visual systems and design tokens with AI assistance.", relevant_functions: ["design"], sort_order: 4 },
  { domain_slug: "visual-design", slug: "brand-ai", name: "Brand Direction with AI", description: "Using AI to develop, maintain, and evolve brand visual identity.", relevant_functions: ["design", "marketing"], sort_order: 5 },

  // Strategy & Planning
  { domain_slug: "strategy-planning", slug: "research-synthesis", name: "Research Synthesis", description: "Using AI to gather, organize, and synthesize research from multiple sources into actionable insights.", relevant_functions: ["product", "data_analytics"], sort_order: 1 },
  { domain_slug: "strategy-planning", slug: "scenario-modeling", name: "Scenario Modeling", description: "Building and evaluating strategic scenarios using AI for forecasting and planning.", relevant_functions: ["product", "operations"], sort_order: 2 },
  { domain_slug: "strategy-planning", slug: "competitive-analysis", name: "Competitive Analysis with AI", description: "Using AI to monitor competitors, analyze positioning, and identify market opportunities.", relevant_functions: ["product", "marketing"], sort_order: 3 },
  { domain_slug: "strategy-planning", slug: "roadmap-generation", name: "AI Roadmap Generation", description: "Using AI to draft, prioritize, and communicate product and project roadmaps.", relevant_functions: ["product"], sort_order: 4 },
  { domain_slug: "strategy-planning", slug: "decision-frameworks", name: "Decision Framework Building", description: "Creating structured decision frameworks with AI to evaluate options systematically.", relevant_functions: ["product", "operations"], sort_order: 5 },

  // Workflow Automation
  { domain_slug: "workflow-automation", slug: "process-mapping", name: "AI Process Mapping", description: "Using AI to document, visualize, and optimize business processes.", relevant_functions: ["operations"], sort_order: 1 },
  { domain_slug: "workflow-automation", slug: "no-code-automation", name: "No-Code AI Automation", description: "Building automated workflows using no-code platforms with AI capabilities.", relevant_functions: ["operations", "marketing"], sort_order: 2 },
  { domain_slug: "workflow-automation", slug: "tool-integration", name: "Tool Integration & Chaining", description: "Connecting multiple AI tools and services into seamless automated pipelines.", relevant_functions: ["operations", "engineering"], sort_order: 3 },
  { domain_slug: "workflow-automation", slug: "workflow-optimization", name: "Workflow Optimization", description: "Analyzing and improving existing workflows using AI insights and automation.", relevant_functions: ["operations"], sort_order: 4 },
  { domain_slug: "workflow-automation", slug: "task-automation", name: "Task Automation", description: "Automating repetitive individual tasks using AI agents and assistants.", relevant_functions: [], sort_order: 5 },

  // Persuasion & Sales
  { domain_slug: "persuasion-sales", slug: "ai-prospecting", name: "AI-Powered Prospecting", description: "Using AI to identify, qualify, and prioritize sales prospects at scale.", relevant_functions: ["sales_revenue"], sort_order: 1 },
  { domain_slug: "persuasion-sales", slug: "proposal-generation", name: "Proposal Generation", description: "Creating compelling, personalized proposals and pitches with AI assistance.", relevant_functions: ["sales_revenue"], sort_order: 2 },
  { domain_slug: "persuasion-sales", slug: "pitch-development", name: "Pitch Development", description: "Developing and refining sales pitches and presentations using AI.", relevant_functions: ["sales_revenue", "marketing"], sort_order: 3 },
  { domain_slug: "persuasion-sales", slug: "messaging-optimization", name: "Messaging Optimization", description: "Using AI to test, refine, and optimize sales and marketing messaging.", relevant_functions: ["sales_revenue", "marketing"], sort_order: 4 },
  { domain_slug: "persuasion-sales", slug: "account-research", name: "Account Research with AI", description: "Using AI to deeply research accounts, industries, and decision-makers for sales preparation.", relevant_functions: ["sales_revenue"], sort_order: 5 },

  // Operations & Execution
  { domain_slug: "operations-execution", slug: "sop-generation", name: "SOP & Documentation Generation", description: "Using AI to create, maintain, and update standard operating procedures and documentation.", relevant_functions: ["operations"], sort_order: 1 },
  { domain_slug: "operations-execution", slug: "project-ai", name: "AI Project Management", description: "Leveraging AI for project planning, tracking, risk assessment, and team coordination.", relevant_functions: ["operations", "product"], sort_order: 2 },
  { domain_slug: "operations-execution", slug: "vendor-evaluation", name: "Vendor Evaluation with AI", description: "Using AI to research, compare, and evaluate vendors and technology solutions.", relevant_functions: ["operations"], sort_order: 3 },
  { domain_slug: "operations-execution", slug: "process-improvement", name: "AI Process Improvement", description: "Identifying and implementing process improvements using AI analysis and recommendations.", relevant_functions: ["operations"], sort_order: 4 },
  { domain_slug: "operations-execution", slug: "operational-reporting", name: "Operational Reporting", description: "Creating automated operational reports and dashboards with AI assistance.", relevant_functions: ["operations", "data_analytics"], sort_order: 5 },
];

async function main(): Promise<void> {
  // ── Step 1: Upsert domains ──────────────────────────────────
  console.log("Seeding 8 skill domains...");
  const { error: domErr } = await supabase
    .from("fp_skill_domains")
    .upsert(DOMAINS, { onConflict: "slug" });
  if (domErr) {
    console.error("Domain upsert failed:", domErr.message);
    process.exit(1);
  }
  console.log("  ✓ 8 domains upserted");

  // ── Step 2: Fetch domain IDs ────────────────────────────────
  const { data: domains, error: fetchErr } = await supabase
    .from("fp_skill_domains")
    .select("id, slug");
  if (fetchErr || !domains) {
    console.error("Failed to fetch domains:", fetchErr?.message);
    process.exit(1);
  }
  const domainMap = new Map(domains.map((d) => [d.slug, d.id]));
  console.log(`  ✓ Fetched ${domainMap.size} domain IDs`);

  // ── Step 3: Upsert skills ──────────────────────────────────
  console.log("Seeding 40 skills...");
  const skillRows = SKILLS.map((s) => ({
    domain_id: domainMap.get(s.domain_slug),
    slug: s.slug,
    name: s.name,
    description: s.description,
    relevant_functions: s.relevant_functions,
    sort_order: s.sort_order,
  }));

  const missing = skillRows.filter((r) => !r.domain_id);
  if (missing.length > 0) {
    console.error("Missing domain IDs for skills — domain slugs not found");
    process.exit(1);
  }

  const { error: skillErr } = await supabase
    .from("fp_skills")
    .upsert(skillRows, { onConflict: "slug" });
  if (skillErr) {
    console.error("Skill upsert failed:", skillErr.message);
    process.exit(1);
  }
  console.log("  ✓ 40 skills upserted");

  // ── Step 4: Verify ─────────────────────────────────────────
  const { count: domCount } = await supabase
    .from("fp_skill_domains")
    .select("*", { count: "exact", head: true });
  const { count: skillCount } = await supabase
    .from("fp_skills")
    .select("*", { count: "exact", head: true });
  console.log(`\nVerification: ${domCount} domains, ${skillCount} skills in database.`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
