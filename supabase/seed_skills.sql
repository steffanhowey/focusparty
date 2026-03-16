-- ═══════════════════════════════════════════════════════════════
-- Seed: Skill Taxonomy — 8 Domains, ~40 Skills
-- Run after 20260323_create_skill_taxonomy.sql
-- ═══════════════════════════════════════════════════════════════

-- ─── Domains ────────────────────────────────────────────────

INSERT INTO fp_skill_domains (slug, name, description, icon, sort_order) VALUES
  ('writing-communication', 'Writing & Communication', 'Prompt writing, content creation, narrative framing, tone calibration, and AI-assisted written communication.', 'pen-tool', 1),
  ('technical-building', 'Technical Building', 'Code generation, architecture, debugging, deployment, and full-stack development with AI assistance.', 'code', 2),
  ('data-analysis', 'Data & Analysis', 'Data exploration, visualization, storytelling, automated analysis, and insight generation using AI tools.', 'bar-chart-2', 3),
  ('visual-design', 'Visual & Design', 'AI image direction, UI prototyping, rapid design iteration, visual systems, and brand direction.', 'palette', 4),
  ('strategy-planning', 'Strategy & Planning', 'Research synthesis, scenario modeling, competitive analysis, roadmap generation, and decision frameworks.', 'compass', 5),
  ('workflow-automation', 'Workflow Automation', 'Process mapping, no-code automation, tool integration, workflow optimization, and task automation.', 'workflow', 6),
  ('persuasion-sales', 'Persuasion & Sales', 'AI-powered prospecting, proposal generation, pitch development, messaging optimization, and account research.', 'megaphone', 7),
  ('operations-execution', 'Operations & Execution', 'SOP generation, AI project management, vendor evaluation, process improvement, and operational reporting.', 'settings', 8);

-- ─── Skills: Writing & Communication ────────────────────────

INSERT INTO fp_skills (domain_id, slug, name, description, relevant_functions, sort_order) VALUES
  ((SELECT id FROM fp_skill_domains WHERE slug = 'writing-communication'), 'prompt-engineering', 'Prompt Engineering', 'Crafting effective prompts that produce reliable, high-quality outputs from AI models.', '{}', 1),
  ((SELECT id FROM fp_skill_domains WHERE slug = 'writing-communication'), 'ai-assisted-writing', 'AI-Assisted Writing', 'Using AI to draft, edit, and refine written content while maintaining voice and quality.', '{marketing,product}', 2),
  ((SELECT id FROM fp_skill_domains WHERE slug = 'writing-communication'), 'content-strategy', 'Content Strategy with AI', 'Planning and executing content programs using AI for ideation, creation, and optimization.', '{marketing}', 3),
  ((SELECT id FROM fp_skill_domains WHERE slug = 'writing-communication'), 'tone-calibration', 'Tone & Voice Calibration', 'Directing AI to match specific brand voices, audience registers, and communication styles.', '{marketing,sales_revenue}', 4),
  ((SELECT id FROM fp_skill_domains WHERE slug = 'writing-communication'), 'email-generation', 'Email Generation & Outreach', 'Using AI to create personalized, effective email sequences and outreach campaigns.', '{marketing,sales_revenue}', 5);

-- ─── Skills: Technical Building ─────────────────────────────

INSERT INTO fp_skills (domain_id, slug, name, description, relevant_functions, sort_order) VALUES
  ((SELECT id FROM fp_skill_domains WHERE slug = 'technical-building'), 'ai-code-generation', 'AI Code Generation', 'Using AI coding assistants to generate, complete, and transform code efficiently.', '{engineering}', 1),
  ((SELECT id FROM fp_skill_domains WHERE slug = 'technical-building'), 'ai-debugging', 'AI-Assisted Debugging', 'Leveraging AI to identify, diagnose, and fix bugs in code.', '{engineering}', 2),
  ((SELECT id FROM fp_skill_domains WHERE slug = 'technical-building'), 'ai-testing', 'AI-Powered Testing', 'Using AI to generate test cases, write test suites, and improve code coverage.', '{engineering}', 3),
  ((SELECT id FROM fp_skill_domains WHERE slug = 'technical-building'), 'full-stack-ai', 'Full-Stack AI Development', 'Building complete applications using AI assistance across frontend, backend, and infrastructure.', '{engineering}', 4),
  ((SELECT id FROM fp_skill_domains WHERE slug = 'technical-building'), 'api-integration', 'API Integration & Tooling', 'Connecting AI services and APIs into applications and workflows.', '{engineering,operations}', 5);

-- ─── Skills: Data & Analysis ────────────────────────────────

INSERT INTO fp_skills (domain_id, slug, name, description, relevant_functions, sort_order) VALUES
  ((SELECT id FROM fp_skill_domains WHERE slug = 'data-analysis'), 'data-exploration', 'AI Data Exploration', 'Using AI to explore, query, and understand datasets quickly.', '{data_analytics}', 1),
  ((SELECT id FROM fp_skill_domains WHERE slug = 'data-analysis'), 'data-visualization', 'AI-Powered Visualization', 'Creating charts, dashboards, and visual representations of data with AI assistance.', '{data_analytics,product}', 2),
  ((SELECT id FROM fp_skill_domains WHERE slug = 'data-analysis'), 'data-storytelling', 'Data Storytelling', 'Translating data insights into compelling narratives for stakeholders.', '{data_analytics,product}', 3),
  ((SELECT id FROM fp_skill_domains WHERE slug = 'data-analysis'), 'automated-analysis', 'Automated Analysis', 'Setting up AI-powered analysis pipelines that run automatically on new data.', '{data_analytics,engineering}', 4),
  ((SELECT id FROM fp_skill_domains WHERE slug = 'data-analysis'), 'insight-generation', 'Insight Generation', 'Using AI to surface patterns, anomalies, and actionable insights from data.', '{data_analytics}', 5);

-- ─── Skills: Visual & Design ────────────────────────────────

INSERT INTO fp_skills (domain_id, slug, name, description, relevant_functions, sort_order) VALUES
  ((SELECT id FROM fp_skill_domains WHERE slug = 'visual-design'), 'ai-image-direction', 'AI Image Direction', 'Directing AI image generators to produce specific visual outcomes through iterative prompting.', '{design,marketing}', 1),
  ((SELECT id FROM fp_skill_domains WHERE slug = 'visual-design'), 'ui-prototyping', 'AI UI Prototyping', 'Using AI tools to rapidly prototype user interfaces and interactive designs.', '{design,product}', 2),
  ((SELECT id FROM fp_skill_domains WHERE slug = 'visual-design'), 'design-iteration', 'Rapid Design Iteration', 'Accelerating the design process through AI-powered iteration and variation generation.', '{design}', 3),
  ((SELECT id FROM fp_skill_domains WHERE slug = 'visual-design'), 'visual-systems', 'Visual System Design', 'Building consistent visual systems and design tokens with AI assistance.', '{design}', 4),
  ((SELECT id FROM fp_skill_domains WHERE slug = 'visual-design'), 'brand-ai', 'Brand Direction with AI', 'Using AI to develop, maintain, and evolve brand visual identity.', '{design,marketing}', 5);

-- ─── Skills: Strategy & Planning ────────────────────────────

INSERT INTO fp_skills (domain_id, slug, name, description, relevant_functions, sort_order) VALUES
  ((SELECT id FROM fp_skill_domains WHERE slug = 'strategy-planning'), 'research-synthesis', 'Research Synthesis', 'Using AI to gather, organize, and synthesize research from multiple sources into actionable insights.', '{product,data_analytics}', 1),
  ((SELECT id FROM fp_skill_domains WHERE slug = 'strategy-planning'), 'scenario-modeling', 'Scenario Modeling', 'Building and evaluating strategic scenarios using AI for forecasting and planning.', '{product,operations}', 2),
  ((SELECT id FROM fp_skill_domains WHERE slug = 'strategy-planning'), 'competitive-analysis', 'Competitive Analysis with AI', 'Using AI to monitor competitors, analyze positioning, and identify market opportunities.', '{product,marketing}', 3),
  ((SELECT id FROM fp_skill_domains WHERE slug = 'strategy-planning'), 'roadmap-generation', 'AI Roadmap Generation', 'Using AI to draft, prioritize, and communicate product and project roadmaps.', '{product}', 4),
  ((SELECT id FROM fp_skill_domains WHERE slug = 'strategy-planning'), 'decision-frameworks', 'Decision Framework Building', 'Creating structured decision frameworks with AI to evaluate options systematically.', '{product,operations}', 5);

-- ─── Skills: Workflow Automation ────────────────────────────

INSERT INTO fp_skills (domain_id, slug, name, description, relevant_functions, sort_order) VALUES
  ((SELECT id FROM fp_skill_domains WHERE slug = 'workflow-automation'), 'process-mapping', 'AI Process Mapping', 'Using AI to document, visualize, and optimize business processes.', '{operations}', 1),
  ((SELECT id FROM fp_skill_domains WHERE slug = 'workflow-automation'), 'no-code-automation', 'No-Code AI Automation', 'Building automated workflows using no-code platforms with AI capabilities.', '{operations,marketing}', 2),
  ((SELECT id FROM fp_skill_domains WHERE slug = 'workflow-automation'), 'tool-integration', 'Tool Integration & Chaining', 'Connecting multiple AI tools and services into seamless automated pipelines.', '{operations,engineering}', 3),
  ((SELECT id FROM fp_skill_domains WHERE slug = 'workflow-automation'), 'workflow-optimization', 'Workflow Optimization', 'Analyzing and improving existing workflows using AI insights and automation.', '{operations}', 4),
  ((SELECT id FROM fp_skill_domains WHERE slug = 'workflow-automation'), 'task-automation', 'Task Automation', 'Automating repetitive individual tasks using AI agents and assistants.', '{}', 5);

-- ─── Skills: Persuasion & Sales ─────────────────────────────

INSERT INTO fp_skills (domain_id, slug, name, description, relevant_functions, sort_order) VALUES
  ((SELECT id FROM fp_skill_domains WHERE slug = 'persuasion-sales'), 'ai-prospecting', 'AI-Powered Prospecting', 'Using AI to identify, qualify, and prioritize sales prospects at scale.', '{sales_revenue}', 1),
  ((SELECT id FROM fp_skill_domains WHERE slug = 'persuasion-sales'), 'proposal-generation', 'Proposal Generation', 'Creating compelling, personalized proposals and pitches with AI assistance.', '{sales_revenue}', 2),
  ((SELECT id FROM fp_skill_domains WHERE slug = 'persuasion-sales'), 'pitch-development', 'Pitch Development', 'Developing and refining sales pitches and presentations using AI.', '{sales_revenue,marketing}', 3),
  ((SELECT id FROM fp_skill_domains WHERE slug = 'persuasion-sales'), 'messaging-optimization', 'Messaging Optimization', 'Using AI to test, refine, and optimize sales and marketing messaging.', '{sales_revenue,marketing}', 4),
  ((SELECT id FROM fp_skill_domains WHERE slug = 'persuasion-sales'), 'account-research', 'Account Research with AI', 'Using AI to deeply research accounts, industries, and decision-makers for sales preparation.', '{sales_revenue}', 5);

-- ─── Skills: Operations & Execution ─────────────────────────

INSERT INTO fp_skills (domain_id, slug, name, description, relevant_functions, sort_order) VALUES
  ((SELECT id FROM fp_skill_domains WHERE slug = 'operations-execution'), 'sop-generation', 'SOP & Documentation Generation', 'Using AI to create, maintain, and update standard operating procedures and documentation.', '{operations}', 1),
  ((SELECT id FROM fp_skill_domains WHERE slug = 'operations-execution'), 'project-ai', 'AI Project Management', 'Leveraging AI for project planning, tracking, risk assessment, and team coordination.', '{operations,product}', 2),
  ((SELECT id FROM fp_skill_domains WHERE slug = 'operations-execution'), 'vendor-evaluation', 'Vendor Evaluation with AI', 'Using AI to research, compare, and evaluate vendors and technology solutions.', '{operations}', 3),
  ((SELECT id FROM fp_skill_domains WHERE slug = 'operations-execution'), 'process-improvement', 'AI Process Improvement', 'Identifying and implementing process improvements using AI analysis and recommendations.', '{operations}', 4),
  ((SELECT id FROM fp_skill_domains WHERE slug = 'operations-execution'), 'operational-reporting', 'Operational Reporting', 'Creating automated operational reports and dashboards with AI assistance.', '{operations,data_analytics}', 5);
