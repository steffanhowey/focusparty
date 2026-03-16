-- ─── Topic → Skill Mapping Seed ────────────────────────────────────────
-- Maps canonical topics to skills with strength weights and relationship types.
-- This is the bridge that lets topic-level signal intelligence flow to skills.
--
-- Strength semantics:
--   1.0       = direct mapping (topic IS the skill)
--   0.7-0.9   = strong applied (topic is a primary tool/technique for the skill)
--   0.4-0.6   = moderate applied (topic develops the skill indirectly)
--   0.1-0.3   = weak contextual (topic provides background)
--
-- Relationship types:
--   direct     = the topic IS the skill in practice
--   applied    = the topic is a tool/technique that develops the skill
--   contextual = the topic provides background relevant to the skill
--
-- Safety: uses a subselect to only insert rows where both the topic and
-- skill exist in their respective tables. Missing topics/skills are silently skipped.
-- ────────────────────────────────────────────────────────────────────────

INSERT INTO fp_topic_skill_map (topic_slug, skill_slug, strength, relationship)
SELECT v.topic_slug, v.skill_slug, v.strength::NUMERIC, v.relationship
FROM (VALUES

  -- ════════════════════════════════════════════════════════════════════
  -- WRITING & COMMUNICATION skills
  -- ════════════════════════════════════════════════════════════════════

  -- prompt-engineering (skill)
  ('prompt-engineering', 'prompt-engineering', 1.0,  'direct'),
  ('llm',               'prompt-engineering', 0.6,  'applied'),
  ('chatgpt',           'prompt-engineering', 0.7,  'applied'),
  ('claude',            'prompt-engineering', 0.7,  'applied'),
  ('openai-api',        'prompt-engineering', 0.5,  'applied'),
  ('function-calling',  'prompt-engineering', 0.5,  'applied'),
  ('tool-use',          'prompt-engineering', 0.4,  'applied'),
  ('ai-fundamentals',   'prompt-engineering', 0.3,  'contextual'),
  ('llm-fundamentals',  'prompt-engineering', 0.4,  'contextual'),
  ('transformers',      'prompt-engineering', 0.2,  'contextual'),
  ('ai-models',         'prompt-engineering', 0.3,  'contextual'),

  -- ai-assisted-writing (skill)
  ('ai-writing',        'ai-assisted-writing', 0.9, 'direct'),
  ('chatgpt',           'ai-assisted-writing', 0.6, 'applied'),
  ('claude',            'ai-assisted-writing', 0.6, 'applied'),
  ('copywriting',       'ai-assisted-writing', 0.7, 'applied'),
  ('content-creation',  'ai-assisted-writing', 0.5, 'applied'),
  ('llm',              'ai-assisted-writing', 0.4, 'applied'),
  ('anthropic',         'ai-assisted-writing', 0.4, 'contextual'),

  -- content-strategy (skill)
  ('content-strategy',  'content-strategy', 1.0,    'direct'),
  ('content-creation',  'content-strategy', 0.6,    'applied'),
  ('seo',              'content-strategy', 0.5,     'applied'),
  ('social-media',     'content-strategy', 0.5,     'applied'),
  ('copywriting',      'content-strategy', 0.4,     'applied'),
  ('email-marketing',  'content-strategy', 0.3,     'applied'),

  -- tone-calibration (skill)
  ('ai-writing',       'tone-calibration', 0.4,     'applied'),
  ('copywriting',      'tone-calibration', 0.6,     'applied'),
  ('branding',         'tone-calibration', 0.4,     'applied'),

  -- email-generation (skill)
  ('email-marketing',  'email-generation', 0.8,     'direct'),
  ('ai-writing',       'email-generation', 0.5,     'applied'),
  ('copywriting',      'email-generation', 0.4,     'applied'),

  -- ════════════════════════════════════════════════════════════════════
  -- TECHNICAL BUILDING skills
  -- ════════════════════════════════════════════════════════════════════

  -- ai-code-generation (skill)
  ('ai-coding',        'ai-code-generation', 0.9,   'direct'),
  ('cursor',           'ai-code-generation', 0.9,   'applied'),
  ('copilot',          'ai-code-generation', 0.8,   'applied'),
  ('github-copilot',   'ai-code-generation', 0.8,   'applied'),
  ('bolt',             'ai-code-generation', 0.6,   'applied'),
  ('replit',           'ai-code-generation', 0.6,   'applied'),
  ('developer-tools',  'ai-code-generation', 0.5,   'applied'),
  ('python',           'ai-code-generation', 0.5,   'applied'),
  ('python-ai',        'ai-code-generation', 0.5,   'applied'),
  ('javascript',       'ai-code-generation', 0.4,   'applied'),
  ('javascript-ai',    'ai-code-generation', 0.5,   'applied'),
  ('typescript',       'ai-code-generation', 0.4,   'applied'),
  ('web-development',  'ai-code-generation', 0.4,   'applied'),
  ('openai-api',       'ai-code-generation', 0.4,   'applied'),

  -- ai-debugging (skill)
  ('ai-coding',        'ai-debugging', 0.6,         'applied'),
  ('cursor',           'ai-debugging', 0.6,         'applied'),
  ('copilot',          'ai-debugging', 0.5,         'applied'),
  ('github-copilot',   'ai-debugging', 0.5,         'applied'),
  ('developer-tools',  'ai-debugging', 0.4,         'applied'),
  ('testing',          'ai-debugging', 0.5,         'applied'),

  -- ai-testing (skill)
  ('testing',          'ai-testing', 0.8,           'direct'),
  ('ai-coding',        'ai-testing', 0.4,           'applied'),
  ('cursor',           'ai-testing', 0.3,           'applied'),

  -- full-stack-ai (skill)
  ('full-stack',       'full-stack-ai', 0.8,        'direct'),
  ('web-development',  'full-stack-ai', 0.5,        'applied'),
  ('nextjs',           'full-stack-ai', 0.6,        'applied'),
  ('react',            'full-stack-ai', 0.5,        'applied'),
  ('v0',               'full-stack-ai', 0.4,        'applied'),
  ('bolt',             'full-stack-ai', 0.7,        'applied'),
  ('replit',           'full-stack-ai', 0.5,        'applied'),
  ('cursor',           'full-stack-ai', 0.5,        'applied'),
  ('supabase',         'full-stack-ai', 0.5,        'applied'),
  ('vercel',           'full-stack-ai', 0.5,        'applied'),
  ('typescript',       'full-stack-ai', 0.4,        'applied'),
  ('javascript',       'full-stack-ai', 0.4,        'applied'),
  ('javascript-ai',    'full-stack-ai', 0.4,        'applied'),
  ('backend',          'full-stack-ai', 0.5,        'applied'),
  ('frontend',         'full-stack-ai', 0.5,        'applied'),

  -- api-integration (skill)
  ('apis',             'api-integration', 0.7,      'direct'),
  ('openai-api',       'api-integration', 0.8,      'applied'),
  ('api-design',       'api-integration', 0.6,      'applied'),
  ('mcp',              'api-integration', 0.7,      'applied'),
  ('function-calling', 'api-integration', 0.7,      'applied'),
  ('tool-use',         'api-integration', 0.5,      'applied'),
  ('langchain',        'api-integration', 0.7,      'applied'),
  ('langgraph',        'api-integration', 0.6,      'applied'),
  ('rag',              'api-integration', 0.5,      'applied'),
  ('supabase',         'api-integration', 0.4,      'applied'),
  ('backend',          'api-integration', 0.4,      'applied'),

  -- ════════════════════════════════════════════════════════════════════
  -- DATA & ANALYSIS skills
  -- ════════════════════════════════════════════════════════════════════

  -- data-exploration (skill)
  ('data-science',     'data-exploration', 0.7,     'direct'),
  ('analytics',        'data-exploration', 0.6,     'applied'),
  ('sql',              'data-exploration', 0.5,     'applied'),
  ('pandas',           'data-exploration', 0.6,     'applied'),
  ('jupyter',          'data-exploration', 0.5,     'applied'),
  ('python',           'data-exploration', 0.4,     'applied'),
  ('postgresql',       'data-exploration', 0.4,     'applied'),
  ('data-engineering', 'data-exploration', 0.5,     'applied'),
  ('rag',              'data-exploration', 0.5,     'applied'),
  ('vector-databases', 'data-exploration', 0.5,     'applied'),
  ('embeddings',       'data-exploration', 0.4,     'applied'),

  -- data-visualization (skill)
  ('visualization',    'data-visualization', 0.8,   'direct'),
  ('analytics',        'data-visualization', 0.5,   'applied'),
  ('data-science',     'data-visualization', 0.4,   'applied'),

  -- data-storytelling (skill)
  ('data-science',     'data-storytelling', 0.4,    'applied'),
  ('visualization',    'data-storytelling', 0.5,    'applied'),
  ('analytics',        'data-storytelling', 0.4,    'applied'),

  -- automated-analysis (skill)
  ('data-science',     'automated-analysis', 0.6,   'applied'),
  ('data-engineering', 'automated-analysis', 0.5,   'applied'),
  ('python',           'automated-analysis', 0.4,   'applied'),
  ('python-ai',        'automated-analysis', 0.5,   'applied'),
  ('pandas',           'automated-analysis', 0.5,   'applied'),
  ('jupyter',          'automated-analysis', 0.4,   'applied'),
  ('sql',              'automated-analysis', 0.4,   'applied'),
  ('machine-learning', 'automated-analysis', 0.3,   'contextual'),
  ('deep-learning',    'automated-analysis', 0.2,   'contextual'),
  ('neural-networks',  'automated-analysis', 0.2,   'contextual'),

  -- insight-generation (skill)
  ('analytics',        'insight-generation', 0.6,   'applied'),
  ('data-science',     'insight-generation', 0.5,   'applied'),
  ('perplexity',       'insight-generation', 0.4,   'applied'),
  ('user-research',    'insight-generation', 0.4,   'applied'),

  -- ════════════════════════════════════════════════════════════════════
  -- VISUAL & DESIGN skills
  -- ════════════════════════════════════════════════════════════════════

  -- ai-image-direction (skill)
  ('midjourney',       'ai-image-direction', 0.9,   'applied'),
  ('ai-design',        'ai-image-direction', 0.6,   'applied'),

  -- ui-prototyping (skill)
  ('v0',               'ui-prototyping', 0.9,       'applied'),
  ('prototyping',      'ui-prototyping', 0.8,       'direct'),
  ('figma',            'ui-prototyping', 0.6,       'applied'),
  ('ui-design',        'ui-prototyping', 0.6,       'applied'),
  ('ux-design',        'ui-prototyping', 0.5,       'applied'),
  ('ai-design',        'ui-prototyping', 0.6,       'applied'),

  -- design-iteration (skill)
  ('ai-design',        'design-iteration', 0.5,     'applied'),
  ('figma',            'design-iteration', 0.5,     'applied'),
  ('midjourney',       'design-iteration', 0.5,     'applied'),
  ('v0',               'design-iteration', 0.6,     'applied'),
  ('prototyping',      'design-iteration', 0.6,     'applied'),
  ('ui-design',        'design-iteration', 0.5,     'applied'),
  ('ux-design',        'design-iteration', 0.5,     'applied'),

  -- visual-systems (skill)
  ('design-systems',   'visual-systems', 0.8,       'direct'),
  ('figma',            'visual-systems', 0.4,       'applied'),
  ('ui-design',        'visual-systems', 0.4,       'applied'),
  ('branding',         'visual-systems', 0.4,       'applied'),
  ('ux-design',        'visual-systems', 0.3,       'contextual'),

  -- brand-ai (skill)
  ('branding',         'brand-ai', 0.7,             'direct'),
  ('midjourney',       'brand-ai', 0.4,             'applied'),
  ('ai-design',        'brand-ai', 0.4,             'applied'),

  -- ════════════════════════════════════════════════════════════════════
  -- STRATEGY & PLANNING skills
  -- ════════════════════════════════════════════════════════════════════

  -- research-synthesis (skill)
  ('perplexity',       'research-synthesis', 0.7,   'applied'),
  ('claude',           'research-synthesis', 0.5,   'applied'),
  ('chatgpt',          'research-synthesis', 0.4,   'applied'),
  ('user-research',    'research-synthesis', 0.5,   'applied'),
  ('rag',              'research-synthesis', 0.4,   'applied'),
  ('product-management','research-synthesis', 0.4,  'applied'),
  ('embeddings',       'research-synthesis', 0.3,   'contextual'),

  -- scenario-modeling (skill)
  ('ai-for-business',  'scenario-modeling', 0.5,    'applied'),
  ('product-management','scenario-modeling', 0.4,   'applied'),

  -- competitive-analysis (skill)
  ('ai-for-business',  'competitive-analysis', 0.4, 'applied'),
  ('perplexity',       'competitive-analysis', 0.4, 'applied'),
  ('product-management','competitive-analysis', 0.4,'applied'),

  -- roadmap-generation (skill)
  ('product-management','roadmap-generation', 0.6,  'applied'),
  ('ai-for-business',  'roadmap-generation', 0.3,   'contextual'),

  -- decision-frameworks (skill)
  ('ai-for-business',  'decision-frameworks', 0.5,  'applied'),
  ('product-management','decision-frameworks', 0.5, 'applied'),
  ('system-design',    'decision-frameworks', 0.3,  'contextual'),
  ('ai-safety',        'decision-frameworks', 0.2,  'contextual'),
  ('ai-ethics',        'decision-frameworks', 0.2,  'contextual'),

  -- ════════════════════════════════════════════════════════════════════
  -- WORKFLOW AUTOMATION skills
  -- ════════════════════════════════════════════════════════════════════

  -- process-mapping (skill)
  ('workflows',        'process-mapping', 0.6,      'applied'),
  ('automation',       'process-mapping', 0.4,      'applied'),
  ('ai-agents',        'process-mapping', 0.3,      'contextual'),

  -- no-code-automation (skill)
  ('no-code-ai',       'no-code-automation', 0.9,   'direct'),
  ('zapier',           'no-code-automation', 0.8,   'applied'),
  ('n8n',              'no-code-automation', 0.8,    'applied'),
  ('make',             'no-code-automation', 0.7,    'applied'),
  ('automation',       'no-code-automation', 0.5,   'applied'),

  -- tool-integration (skill)
  ('mcp',              'tool-integration', 0.7,     'applied'),
  ('tool-use',         'tool-integration', 0.7,     'applied'),
  ('langchain',        'tool-integration', 0.6,     'applied'),
  ('langgraph',        'tool-integration', 0.5,     'applied'),
  ('crewai',           'tool-integration', 0.6,     'applied'),
  ('autogen',          'tool-integration', 0.6,     'applied'),
  ('ai-agents',        'tool-integration', 0.6,     'applied'),
  ('ai-tools',         'tool-integration', 0.5,     'applied'),
  ('apis',             'tool-integration', 0.5,     'applied'),

  -- workflow-optimization (skill)
  ('workflows',        'workflow-optimization', 0.7, 'direct'),
  ('automation',       'workflow-optimization', 0.6, 'applied'),
  ('zapier',           'workflow-optimization', 0.6, 'applied'),
  ('n8n',              'workflow-optimization', 0.6, 'applied'),
  ('make',             'workflow-optimization', 0.5, 'applied'),
  ('ai-productivity',  'workflow-optimization', 0.5, 'applied'),
  ('notion',           'workflow-optimization', 0.3, 'applied'),
  ('devops',           'workflow-optimization', 0.4, 'applied'),

  -- task-automation (skill)
  ('automation',       'task-automation', 0.8,      'direct'),
  ('zapier',           'task-automation', 0.5,      'applied'),
  ('n8n',              'task-automation', 0.5,       'applied'),
  ('make',             'task-automation', 0.5,       'applied'),
  ('ai-tools',         'task-automation', 0.5,      'applied'),
  ('crewai',           'task-automation', 0.5,      'applied'),
  ('autogen',          'task-automation', 0.5,      'applied'),
  ('ai-agents',        'task-automation', 0.5,      'applied'),
  ('ai-productivity',  'task-automation', 0.5,      'applied'),
  ('notion',           'task-automation', 0.4,      'applied'),
  ('no-code-ai',       'task-automation', 0.6,      'applied'),
  ('devops',           'task-automation', 0.3,      'applied'),

  -- ════════════════════════════════════════════════════════════════════
  -- PERSUASION & SALES skills
  -- ════════════════════════════════════════════════════════════════════

  -- ai-prospecting (skill)
  ('ai-for-business',  'ai-prospecting', 0.3,      'contextual'),
  ('perplexity',       'ai-prospecting', 0.4,      'applied'),

  -- proposal-generation (skill)
  ('ai-writing',       'proposal-generation', 0.5,  'applied'),
  ('chatgpt',          'proposal-generation', 0.4,  'applied'),
  ('claude',           'proposal-generation', 0.4,  'applied'),

  -- pitch-development (skill)
  ('ai-for-business',  'pitch-development', 0.3,   'contextual'),
  ('ai-writing',       'pitch-development', 0.4,   'applied'),

  -- messaging-optimization (skill)
  ('copywriting',      'messaging-optimization', 0.5, 'applied'),
  ('social-media',     'messaging-optimization', 0.4, 'applied'),
  ('email-marketing',  'messaging-optimization', 0.5, 'applied'),

  -- account-research (skill)
  ('perplexity',       'account-research', 0.5,    'applied'),
  ('claude',           'account-research', 0.3,    'applied'),

  -- ════════════════════════════════════════════════════════════════════
  -- OPERATIONS & EXECUTION skills
  -- ════════════════════════════════════════════════════════════════════

  -- sop-generation (skill)
  ('ai-writing',       'sop-generation', 0.5,      'applied'),
  ('notion',           'sop-generation', 0.5,      'applied'),
  ('workflows',        'sop-generation', 0.3,      'contextual'),

  -- project-ai (skill)
  ('product-management','project-ai', 0.5,         'applied'),
  ('notion',           'project-ai', 0.4,          'applied'),
  ('ai-productivity',  'project-ai', 0.4,          'applied'),

  -- vendor-evaluation (skill)
  ('ai-for-business',  'vendor-evaluation', 0.3,   'contextual'),
  ('perplexity',       'vendor-evaluation', 0.3,   'applied'),

  -- process-improvement (skill)
  ('workflows',        'process-improvement', 0.5,  'applied'),
  ('automation',       'process-improvement', 0.4,  'applied'),
  ('ai-for-business',  'process-improvement', 0.3,  'contextual'),

  -- operational-reporting (skill)
  ('analytics',        'operational-reporting', 0.5, 'applied'),
  ('data-science',     'operational-reporting', 0.3, 'contextual'),
  ('visualization',    'operational-reporting', 0.4, 'applied')

) AS v(topic_slug, skill_slug, strength, relationship)
WHERE EXISTS (SELECT 1 FROM fp_topic_taxonomy WHERE slug = v.topic_slug)
  AND EXISTS (SELECT 1 FROM fp_skills WHERE slug = v.skill_slug)
ON CONFLICT (topic_slug, skill_slug) DO UPDATE SET
  strength = EXCLUDED.strength,
  relationship = EXCLUDED.relationship;
