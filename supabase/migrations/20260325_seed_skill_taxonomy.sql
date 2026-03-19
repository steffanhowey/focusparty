-- ═══════════════════════════════════════════════════════════════
-- Seed Skill Taxonomy: 8 Domains + ~45 Skills
-- This seeds the empty fp_skill_domains and fp_skills tables
-- so the curriculum generator can tag paths and the receipt
-- calculator can compute skill progression.
-- ═══════════════════════════════════════════════════════════════

-- ── Domains ──────────────────────────────────────────────────

INSERT INTO fp_skill_domains (slug, name, description, icon, sort_order) VALUES
('writing-communication', 'Writing & Communication', 'Prompt writing, email generation, content creation, narrative framing, tone calibration', 'pen-tool', 1),
('technical-building', 'Technical Building', 'Code generation, architecture, debugging, deployment, full-stack development with AI', 'code', 2),
('data-analysis', 'Data & Analysis', 'Exploration, visualization, storytelling, automation, insight generation with AI', 'bar-chart-3', 3),
('visual-design', 'Visual & Design', 'AI image direction, iteration, layout, brand, rapid prototyping', 'palette', 4),
('strategy-planning', 'Strategy & Planning', 'Research synthesis, scenario modeling, roadmap generation, competitive analysis', 'compass', 5),
('workflow-automation', 'Workflow Automation', 'Process mapping, API integration, no-code tooling, efficiency optimization', 'workflow', 6),
('persuasion-sales', 'Persuasion & Sales', 'Messaging, prospecting, proposal generation, pitch development with AI', 'megaphone', 7),
('operations-execution', 'Operations & Execution', 'Project management, stakeholder coordination, process improvement, scaling with AI', 'settings', 8)
ON CONFLICT (slug) DO NOTHING;

-- ── Skills: Writing & Communication ──────────────────────────

INSERT INTO fp_skills (domain_id, slug, name, description, relevant_functions, sort_order) VALUES
((SELECT id FROM fp_skill_domains WHERE slug = 'writing-communication'), 'prompt-engineering', 'Prompt Engineering', 'Crafting effective prompts for LLMs — system prompts, chain-of-thought, few-shot, iterative refinement', '{engineering,marketing,product,data_analytics,design,sales_revenue,operations}', 1),
((SELECT id FROM fp_skill_domains WHERE slug = 'writing-communication'), 'ai-assisted-writing', 'AI-Assisted Writing', 'Using AI to draft, edit, and polish written content — emails, docs, reports, copy', '{marketing,product,sales_revenue,operations}', 2),
((SELECT id FROM fp_skill_domains WHERE slug = 'writing-communication'), 'content-strategy-ai', 'AI Content Strategy', 'Planning and producing content at scale using AI — calendars, briefs, repurposing', '{marketing,sales_revenue}', 3),
((SELECT id FROM fp_skill_domains WHERE slug = 'writing-communication'), 'technical-writing-ai', 'AI Technical Writing', 'Using AI to produce documentation, READMEs, API docs, and technical specs', '{engineering,product}', 4),
((SELECT id FROM fp_skill_domains WHERE slug = 'writing-communication'), 'tone-voice-calibration', 'Tone & Voice Calibration', 'Directing AI output to match brand voice, audience register, and emotional tone', '{marketing,sales_revenue,product}', 5)
ON CONFLICT (slug) DO NOTHING;

-- ── Skills: Technical Building ───────────────────────────────

INSERT INTO fp_skills (domain_id, slug, name, description, relevant_functions, sort_order) VALUES
((SELECT id FROM fp_skill_domains WHERE slug = 'technical-building'), 'ai-code-generation', 'AI Code Generation', 'Using AI coding assistants to generate, complete, and scaffold code — Cursor, Copilot, Claude Code', '{engineering}', 1),
((SELECT id FROM fp_skill_domains WHERE slug = 'technical-building'), 'ai-debugging', 'AI-Assisted Debugging', 'Using AI to identify, diagnose, and fix bugs in code', '{engineering}', 2),
((SELECT id FROM fp_skill_domains WHERE slug = 'technical-building'), 'ai-architecture', 'AI-Assisted Architecture', 'Using AI to design systems, evaluate trade-offs, and plan technical implementations', '{engineering,product}', 3),
((SELECT id FROM fp_skill_domains WHERE slug = 'technical-building'), 'ai-testing', 'AI-Assisted Testing', 'Using AI to generate tests, identify edge cases, and improve test coverage', '{engineering}', 4),
((SELECT id FROM fp_skill_domains WHERE slug = 'technical-building'), 'vibe-coding', 'Vibe Coding', 'Building complete features or apps through natural language conversation with AI — v0, Bolt, Replit Agent', '{engineering,product,design}', 5),
((SELECT id FROM fp_skill_domains WHERE slug = 'technical-building'), 'ai-devops', 'AI-Assisted DevOps', 'Using AI for deployment, CI/CD, infrastructure, and monitoring tasks', '{engineering,operations}', 6)
ON CONFLICT (slug) DO NOTHING;

-- ── Skills: Data & Analysis ──────────────────────────────────

INSERT INTO fp_skills (domain_id, slug, name, description, relevant_functions, sort_order) VALUES
((SELECT id FROM fp_skill_domains WHERE slug = 'data-analysis'), 'ai-data-exploration', 'AI Data Exploration', 'Using AI to query, filter, and understand datasets through natural language', '{data_analytics,engineering,product}', 1),
((SELECT id FROM fp_skill_domains WHERE slug = 'data-analysis'), 'ai-data-visualization', 'AI Data Visualization', 'Using AI to create charts, dashboards, and visual representations of data', '{data_analytics,marketing,product}', 2),
((SELECT id FROM fp_skill_domains WHERE slug = 'data-analysis'), 'data-storytelling', 'Data Storytelling', 'Translating AI-generated analysis into compelling narratives for stakeholders', '{data_analytics,marketing,product}', 3),
((SELECT id FROM fp_skill_domains WHERE slug = 'data-analysis'), 'ai-spreadsheet-automation', 'AI Spreadsheet Automation', 'Using AI to build formulas, automate spreadsheet workflows, and analyze tabular data', '{data_analytics,operations,sales_revenue}', 4),
((SELECT id FROM fp_skill_domains WHERE slug = 'data-analysis'), 'ai-sql-querying', 'AI-Assisted SQL', 'Using AI to write, optimize, and debug SQL queries', '{data_analytics,engineering}', 5)
ON CONFLICT (slug) DO NOTHING;

-- ── Skills: Visual & Design ──────────────────────────────────

INSERT INTO fp_skills (domain_id, slug, name, description, relevant_functions, sort_order) VALUES
((SELECT id FROM fp_skill_domains WHERE slug = 'visual-design'), 'ai-image-direction', 'AI Image Direction', 'Directing AI image generators to produce specific visual outcomes — Midjourney, DALL-E, Ideogram', '{design,marketing}', 1),
((SELECT id FROM fp_skill_domains WHERE slug = 'visual-design'), 'ai-ui-prototyping', 'AI UI Prototyping', 'Using AI to rapidly prototype interfaces and user experiences — v0, Galileo, Uizard', '{design,product,engineering}', 2),
((SELECT id FROM fp_skill_domains WHERE slug = 'visual-design'), 'ai-brand-design', 'AI Brand Design', 'Using AI for brand identity work — logos, color systems, style guides, visual consistency', '{design,marketing}', 3),
((SELECT id FROM fp_skill_domains WHERE slug = 'visual-design'), 'ai-video-creation', 'AI Video Creation', 'Using AI for video editing, generation, and post-production — Runway, Pika, CapCut AI', '{design,marketing}', 4),
((SELECT id FROM fp_skill_domains WHERE slug = 'visual-design'), 'ai-presentation-design', 'AI Presentation Design', 'Using AI to create compelling slides and visual presentations', '{design,marketing,sales_revenue,product}', 5)
ON CONFLICT (slug) DO NOTHING;

-- ── Skills: Strategy & Planning ──────────────────────────────

INSERT INTO fp_skills (domain_id, slug, name, description, relevant_functions, sort_order) VALUES
((SELECT id FROM fp_skill_domains WHERE slug = 'strategy-planning'), 'research-synthesis', 'Research Synthesis', 'Using AI to gather, organize, and synthesize research from multiple sources', '{product,marketing,data_analytics,operations}', 1),
((SELECT id FROM fp_skill_domains WHERE slug = 'strategy-planning'), 'competitive-analysis-ai', 'AI Competitive Analysis', 'Using AI to analyze competitors, identify gaps, and surface strategic opportunities', '{product,marketing,sales_revenue}', 2),
((SELECT id FROM fp_skill_domains WHERE slug = 'strategy-planning'), 'ai-roadmap-generation', 'AI Roadmap Generation', 'Using AI to draft product roadmaps, prioritize features, and plan releases', '{product,engineering}', 3),
((SELECT id FROM fp_skill_domains WHERE slug = 'strategy-planning'), 'scenario-modeling', 'Scenario Modeling', 'Using AI to model outcomes, run what-if analyses, and evaluate strategic options', '{product,data_analytics,operations}', 4),
((SELECT id FROM fp_skill_domains WHERE slug = 'strategy-planning'), 'ai-prd-writing', 'AI PRD & Spec Writing', 'Using AI to draft product requirements, user stories, and technical specifications', '{product,engineering}', 5),
((SELECT id FROM fp_skill_domains WHERE slug = 'strategy-planning'), 'market-intelligence-ai', 'AI Market Intelligence', 'Using AI to monitor market trends, analyze industry signals, and track emerging patterns', '{product,marketing,sales_revenue}', 6)
ON CONFLICT (slug) DO NOTHING;

-- ── Skills: Workflow Automation ──────────────────────────────

INSERT INTO fp_skills (domain_id, slug, name, description, relevant_functions, sort_order) VALUES
((SELECT id FROM fp_skill_domains WHERE slug = 'workflow-automation'), 'ai-workflow-design', 'AI Workflow Design', 'Designing automated workflows using AI — identifying bottlenecks, mapping processes, planning automations', '{operations,engineering,marketing}', 1),
((SELECT id FROM fp_skill_domains WHERE slug = 'workflow-automation'), 'no-code-ai-tools', 'No-Code AI Tools', 'Building automations without code using AI-powered platforms — Zapier AI, Make, n8n', '{operations,marketing,sales_revenue}', 2),
((SELECT id FROM fp_skill_domains WHERE slug = 'workflow-automation'), 'api-integration-ai', 'AI API Integration', 'Using AI to connect APIs, build integrations, and orchestrate data flows between tools', '{engineering,operations}', 3),
((SELECT id FROM fp_skill_domains WHERE slug = 'workflow-automation'), 'ai-email-automation', 'AI Email Automation', 'Using AI for email workflows — drafting sequences, personalizing at scale, optimizing send times', '{marketing,sales_revenue,operations}', 4),
((SELECT id FROM fp_skill_domains WHERE slug = 'workflow-automation'), 'ai-document-processing', 'AI Document Processing', 'Using AI to extract, transform, and process information from documents at scale', '{operations,data_analytics}', 5)
ON CONFLICT (slug) DO NOTHING;

-- ── Skills: Persuasion & Sales ───────────────────────────────

INSERT INTO fp_skills (domain_id, slug, name, description, relevant_functions, sort_order) VALUES
((SELECT id FROM fp_skill_domains WHERE slug = 'persuasion-sales'), 'ai-sales-messaging', 'AI Sales Messaging', 'Using AI to craft prospecting emails, follow-ups, and personalized outreach at scale', '{sales_revenue,marketing}', 1),
((SELECT id FROM fp_skill_domains WHERE slug = 'persuasion-sales'), 'ai-proposal-generation', 'AI Proposal Generation', 'Using AI to draft proposals, SOWs, and pitch decks tailored to specific prospects', '{sales_revenue,marketing}', 2),
((SELECT id FROM fp_skill_domains WHERE slug = 'persuasion-sales'), 'ai-audience-analysis', 'AI Audience Analysis', 'Using AI to build personas, segment audiences, and understand buyer intent', '{marketing,sales_revenue,product}', 3),
((SELECT id FROM fp_skill_domains WHERE slug = 'persuasion-sales'), 'ai-pitch-development', 'AI Pitch Development', 'Using AI to structure arguments, refine narratives, and build persuasive presentations', '{sales_revenue,marketing,product}', 4)
ON CONFLICT (slug) DO NOTHING;

-- ── Skills: Operations & Execution ───────────────────────────

INSERT INTO fp_skills (domain_id, slug, name, description, relevant_functions, sort_order) VALUES
((SELECT id FROM fp_skill_domains WHERE slug = 'operations-execution'), 'ai-project-management', 'AI Project Management', 'Using AI to plan projects, track progress, allocate resources, and manage timelines', '{operations,product,engineering}', 1),
((SELECT id FROM fp_skill_domains WHERE slug = 'operations-execution'), 'ai-meeting-optimization', 'AI Meeting Optimization', 'Using AI for meeting notes, action items, agenda generation, and async collaboration', '{operations,product}', 2),
((SELECT id FROM fp_skill_domains WHERE slug = 'operations-execution'), 'ai-process-improvement', 'AI Process Improvement', 'Using AI to identify inefficiencies, suggest improvements, and measure impact of process changes', '{operations,data_analytics}', 3),
((SELECT id FROM fp_skill_domains WHERE slug = 'operations-execution'), 'ai-knowledge-management', 'AI Knowledge Management', 'Using AI to organize, surface, and maintain institutional knowledge and documentation', '{operations,engineering,product}', 4),
((SELECT id FROM fp_skill_domains WHERE slug = 'operations-execution'), 'ai-hiring-talent', 'AI Hiring & Talent', 'Using AI for job descriptions, candidate screening, interview prep, and team skill assessment', '{operations}', 5)
ON CONFLICT (slug) DO NOTHING;
