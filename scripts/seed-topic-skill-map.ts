import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface TopicSkillMapping {
  topic_slug: string;
  skill_slug: string;
  strength: number;
  relationship: 'direct' | 'applied' | 'contextual';
}

const mappings: TopicSkillMapping[] = [
  // WRITING & COMMUNICATION skills
  { topic_slug: 'prompt-engineering', skill_slug: 'prompt-engineering', strength: 1.0, relationship: 'direct' },
  { topic_slug: 'llm', skill_slug: 'prompt-engineering', strength: 0.6, relationship: 'applied' },
  { topic_slug: 'chatgpt', skill_slug: 'prompt-engineering', strength: 0.7, relationship: 'applied' },
  { topic_slug: 'claude', skill_slug: 'prompt-engineering', strength: 0.7, relationship: 'applied' },
  { topic_slug: 'openai-api', skill_slug: 'prompt-engineering', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'function-calling', skill_slug: 'prompt-engineering', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'tool-use', skill_slug: 'prompt-engineering', strength: 0.4, relationship: 'applied' },
  { topic_slug: 'ai-fundamentals', skill_slug: 'prompt-engineering', strength: 0.3, relationship: 'contextual' },
  { topic_slug: 'llm-fundamentals', skill_slug: 'prompt-engineering', strength: 0.4, relationship: 'contextual' },
  { topic_slug: 'transformers', skill_slug: 'prompt-engineering', strength: 0.2, relationship: 'contextual' },
  { topic_slug: 'ai-models', skill_slug: 'prompt-engineering', strength: 0.3, relationship: 'contextual' },

  { topic_slug: 'ai-writing', skill_slug: 'ai-assisted-writing', strength: 0.9, relationship: 'direct' },
  { topic_slug: 'chatgpt', skill_slug: 'ai-assisted-writing', strength: 0.6, relationship: 'applied' },
  { topic_slug: 'claude', skill_slug: 'ai-assisted-writing', strength: 0.6, relationship: 'applied' },
  { topic_slug: 'copywriting', skill_slug: 'ai-assisted-writing', strength: 0.7, relationship: 'applied' },
  { topic_slug: 'content-creation', skill_slug: 'ai-assisted-writing', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'llm', skill_slug: 'ai-assisted-writing', strength: 0.4, relationship: 'applied' },
  { topic_slug: 'anthropic', skill_slug: 'ai-assisted-writing', strength: 0.4, relationship: 'contextual' },

  { topic_slug: 'content-strategy', skill_slug: 'content-strategy', strength: 1.0, relationship: 'direct' },
  { topic_slug: 'content-creation', skill_slug: 'content-strategy', strength: 0.6, relationship: 'applied' },
  { topic_slug: 'seo', skill_slug: 'content-strategy', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'social-media', skill_slug: 'content-strategy', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'copywriting', skill_slug: 'content-strategy', strength: 0.4, relationship: 'applied' },
  { topic_slug: 'email-marketing', skill_slug: 'content-strategy', strength: 0.3, relationship: 'applied' },

  { topic_slug: 'ai-writing', skill_slug: 'tone-calibration', strength: 0.4, relationship: 'applied' },
  { topic_slug: 'copywriting', skill_slug: 'tone-calibration', strength: 0.6, relationship: 'applied' },
  { topic_slug: 'branding', skill_slug: 'tone-calibration', strength: 0.4, relationship: 'applied' },

  { topic_slug: 'email-marketing', skill_slug: 'email-generation', strength: 0.8, relationship: 'direct' },
  { topic_slug: 'ai-writing', skill_slug: 'email-generation', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'copywriting', skill_slug: 'email-generation', strength: 0.4, relationship: 'applied' },

  // TECHNICAL BUILDING skills
  { topic_slug: 'ai-coding', skill_slug: 'ai-code-generation', strength: 0.9, relationship: 'direct' },
  { topic_slug: 'cursor', skill_slug: 'ai-code-generation', strength: 0.9, relationship: 'applied' },
  { topic_slug: 'copilot', skill_slug: 'ai-code-generation', strength: 0.8, relationship: 'applied' },
  { topic_slug: 'github-copilot', skill_slug: 'ai-code-generation', strength: 0.8, relationship: 'applied' },
  { topic_slug: 'bolt', skill_slug: 'ai-code-generation', strength: 0.6, relationship: 'applied' },
  { topic_slug: 'replit', skill_slug: 'ai-code-generation', strength: 0.6, relationship: 'applied' },
  { topic_slug: 'developer-tools', skill_slug: 'ai-code-generation', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'python', skill_slug: 'ai-code-generation', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'python-ai', skill_slug: 'ai-code-generation', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'javascript', skill_slug: 'ai-code-generation', strength: 0.4, relationship: 'applied' },
  { topic_slug: 'javascript-ai', skill_slug: 'ai-code-generation', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'typescript', skill_slug: 'ai-code-generation', strength: 0.4, relationship: 'applied' },
  { topic_slug: 'web-development', skill_slug: 'ai-code-generation', strength: 0.4, relationship: 'applied' },
  { topic_slug: 'openai-api', skill_slug: 'ai-code-generation', strength: 0.4, relationship: 'applied' },

  { topic_slug: 'ai-coding', skill_slug: 'ai-debugging', strength: 0.6, relationship: 'applied' },
  { topic_slug: 'cursor', skill_slug: 'ai-debugging', strength: 0.6, relationship: 'applied' },
  { topic_slug: 'copilot', skill_slug: 'ai-debugging', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'github-copilot', skill_slug: 'ai-debugging', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'developer-tools', skill_slug: 'ai-debugging', strength: 0.4, relationship: 'applied' },
  { topic_slug: 'testing', skill_slug: 'ai-debugging', strength: 0.5, relationship: 'applied' },

  { topic_slug: 'testing', skill_slug: 'ai-testing', strength: 0.8, relationship: 'direct' },
  { topic_slug: 'ai-coding', skill_slug: 'ai-testing', strength: 0.4, relationship: 'applied' },
  { topic_slug: 'cursor', skill_slug: 'ai-testing', strength: 0.3, relationship: 'applied' },

  { topic_slug: 'full-stack', skill_slug: 'full-stack-ai', strength: 0.8, relationship: 'direct' },
  { topic_slug: 'web-development', skill_slug: 'full-stack-ai', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'nextjs', skill_slug: 'full-stack-ai', strength: 0.6, relationship: 'applied' },
  { topic_slug: 'react', skill_slug: 'full-stack-ai', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'v0', skill_slug: 'full-stack-ai', strength: 0.4, relationship: 'applied' },
  { topic_slug: 'bolt', skill_slug: 'full-stack-ai', strength: 0.7, relationship: 'applied' },
  { topic_slug: 'replit', skill_slug: 'full-stack-ai', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'cursor', skill_slug: 'full-stack-ai', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'supabase', skill_slug: 'full-stack-ai', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'vercel', skill_slug: 'full-stack-ai', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'typescript', skill_slug: 'full-stack-ai', strength: 0.4, relationship: 'applied' },
  { topic_slug: 'javascript', skill_slug: 'full-stack-ai', strength: 0.4, relationship: 'applied' },
  { topic_slug: 'javascript-ai', skill_slug: 'full-stack-ai', strength: 0.4, relationship: 'applied' },
  { topic_slug: 'backend', skill_slug: 'full-stack-ai', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'frontend', skill_slug: 'full-stack-ai', strength: 0.5, relationship: 'applied' },

  { topic_slug: 'apis', skill_slug: 'api-integration', strength: 0.7, relationship: 'direct' },
  { topic_slug: 'openai-api', skill_slug: 'api-integration', strength: 0.8, relationship: 'applied' },
  { topic_slug: 'api-design', skill_slug: 'api-integration', strength: 0.6, relationship: 'applied' },
  { topic_slug: 'mcp', skill_slug: 'api-integration', strength: 0.7, relationship: 'applied' },
  { topic_slug: 'function-calling', skill_slug: 'api-integration', strength: 0.7, relationship: 'applied' },
  { topic_slug: 'tool-use', skill_slug: 'api-integration', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'langchain', skill_slug: 'api-integration', strength: 0.7, relationship: 'applied' },
  { topic_slug: 'langgraph', skill_slug: 'api-integration', strength: 0.6, relationship: 'applied' },
  { topic_slug: 'rag', skill_slug: 'api-integration', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'supabase', skill_slug: 'api-integration', strength: 0.4, relationship: 'applied' },
  { topic_slug: 'backend', skill_slug: 'api-integration', strength: 0.4, relationship: 'applied' },

  // DATA & ANALYSIS skills
  { topic_slug: 'data-science', skill_slug: 'data-exploration', strength: 0.7, relationship: 'direct' },
  { topic_slug: 'analytics', skill_slug: 'data-exploration', strength: 0.6, relationship: 'applied' },
  { topic_slug: 'sql', skill_slug: 'data-exploration', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'pandas', skill_slug: 'data-exploration', strength: 0.6, relationship: 'applied' },
  { topic_slug: 'jupyter', skill_slug: 'data-exploration', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'python', skill_slug: 'data-exploration', strength: 0.4, relationship: 'applied' },
  { topic_slug: 'postgresql', skill_slug: 'data-exploration', strength: 0.4, relationship: 'applied' },
  { topic_slug: 'data-engineering', skill_slug: 'data-exploration', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'rag', skill_slug: 'data-exploration', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'vector-databases', skill_slug: 'data-exploration', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'embeddings', skill_slug: 'data-exploration', strength: 0.4, relationship: 'applied' },

  { topic_slug: 'visualization', skill_slug: 'data-visualization', strength: 0.8, relationship: 'direct' },
  { topic_slug: 'analytics', skill_slug: 'data-visualization', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'data-science', skill_slug: 'data-visualization', strength: 0.4, relationship: 'applied' },

  { topic_slug: 'data-science', skill_slug: 'data-storytelling', strength: 0.4, relationship: 'applied' },
  { topic_slug: 'visualization', skill_slug: 'data-storytelling', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'analytics', skill_slug: 'data-storytelling', strength: 0.4, relationship: 'applied' },

  { topic_slug: 'data-science', skill_slug: 'automated-analysis', strength: 0.6, relationship: 'applied' },
  { topic_slug: 'data-engineering', skill_slug: 'automated-analysis', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'python', skill_slug: 'automated-analysis', strength: 0.4, relationship: 'applied' },
  { topic_slug: 'python-ai', skill_slug: 'automated-analysis', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'pandas', skill_slug: 'automated-analysis', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'jupyter', skill_slug: 'automated-analysis', strength: 0.4, relationship: 'applied' },
  { topic_slug: 'sql', skill_slug: 'automated-analysis', strength: 0.4, relationship: 'applied' },
  { topic_slug: 'machine-learning', skill_slug: 'automated-analysis', strength: 0.3, relationship: 'contextual' },
  { topic_slug: 'deep-learning', skill_slug: 'automated-analysis', strength: 0.2, relationship: 'contextual' },
  { topic_slug: 'neural-networks', skill_slug: 'automated-analysis', strength: 0.2, relationship: 'contextual' },

  { topic_slug: 'analytics', skill_slug: 'insight-generation', strength: 0.6, relationship: 'applied' },
  { topic_slug: 'data-science', skill_slug: 'insight-generation', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'perplexity', skill_slug: 'insight-generation', strength: 0.4, relationship: 'applied' },
  { topic_slug: 'user-research', skill_slug: 'insight-generation', strength: 0.4, relationship: 'applied' },

  // VISUAL & DESIGN skills
  { topic_slug: 'midjourney', skill_slug: 'ai-image-direction', strength: 0.9, relationship: 'applied' },
  { topic_slug: 'ai-design', skill_slug: 'ai-image-direction', strength: 0.6, relationship: 'applied' },

  { topic_slug: 'v0', skill_slug: 'ui-prototyping', strength: 0.9, relationship: 'applied' },
  { topic_slug: 'prototyping', skill_slug: 'ui-prototyping', strength: 0.8, relationship: 'direct' },
  { topic_slug: 'figma', skill_slug: 'ui-prototyping', strength: 0.6, relationship: 'applied' },
  { topic_slug: 'ui-design', skill_slug: 'ui-prototyping', strength: 0.6, relationship: 'applied' },
  { topic_slug: 'ux-design', skill_slug: 'ui-prototyping', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'ai-design', skill_slug: 'ui-prototyping', strength: 0.6, relationship: 'applied' },

  { topic_slug: 'ai-design', skill_slug: 'design-iteration', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'figma', skill_slug: 'design-iteration', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'midjourney', skill_slug: 'design-iteration', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'v0', skill_slug: 'design-iteration', strength: 0.6, relationship: 'applied' },
  { topic_slug: 'prototyping', skill_slug: 'design-iteration', strength: 0.6, relationship: 'applied' },
  { topic_slug: 'ui-design', skill_slug: 'design-iteration', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'ux-design', skill_slug: 'design-iteration', strength: 0.5, relationship: 'applied' },

  { topic_slug: 'design-systems', skill_slug: 'visual-systems', strength: 0.8, relationship: 'direct' },
  { topic_slug: 'figma', skill_slug: 'visual-systems', strength: 0.4, relationship: 'applied' },
  { topic_slug: 'ui-design', skill_slug: 'visual-systems', strength: 0.4, relationship: 'applied' },
  { topic_slug: 'branding', skill_slug: 'visual-systems', strength: 0.4, relationship: 'applied' },
  { topic_slug: 'ux-design', skill_slug: 'visual-systems', strength: 0.3, relationship: 'contextual' },

  { topic_slug: 'branding', skill_slug: 'brand-ai', strength: 0.7, relationship: 'direct' },
  { topic_slug: 'midjourney', skill_slug: 'brand-ai', strength: 0.4, relationship: 'applied' },
  { topic_slug: 'ai-design', skill_slug: 'brand-ai', strength: 0.4, relationship: 'applied' },

  // STRATEGY & PLANNING skills
  { topic_slug: 'perplexity', skill_slug: 'research-synthesis', strength: 0.7, relationship: 'applied' },
  { topic_slug: 'claude', skill_slug: 'research-synthesis', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'chatgpt', skill_slug: 'research-synthesis', strength: 0.4, relationship: 'applied' },
  { topic_slug: 'user-research', skill_slug: 'research-synthesis', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'rag', skill_slug: 'research-synthesis', strength: 0.4, relationship: 'applied' },
  { topic_slug: 'product-management', skill_slug: 'research-synthesis', strength: 0.4, relationship: 'applied' },
  { topic_slug: 'embeddings', skill_slug: 'research-synthesis', strength: 0.3, relationship: 'contextual' },

  { topic_slug: 'ai-for-business', skill_slug: 'scenario-modeling', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'product-management', skill_slug: 'scenario-modeling', strength: 0.4, relationship: 'applied' },

  { topic_slug: 'ai-for-business', skill_slug: 'competitive-analysis', strength: 0.4, relationship: 'applied' },
  { topic_slug: 'perplexity', skill_slug: 'competitive-analysis', strength: 0.4, relationship: 'applied' },
  { topic_slug: 'product-management', skill_slug: 'competitive-analysis', strength: 0.4, relationship: 'applied' },

  { topic_slug: 'product-management', skill_slug: 'roadmap-generation', strength: 0.6, relationship: 'applied' },
  { topic_slug: 'ai-for-business', skill_slug: 'roadmap-generation', strength: 0.3, relationship: 'contextual' },

  { topic_slug: 'ai-for-business', skill_slug: 'decision-frameworks', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'product-management', skill_slug: 'decision-frameworks', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'system-design', skill_slug: 'decision-frameworks', strength: 0.3, relationship: 'contextual' },
  { topic_slug: 'ai-safety', skill_slug: 'decision-frameworks', strength: 0.2, relationship: 'contextual' },
  { topic_slug: 'ai-ethics', skill_slug: 'decision-frameworks', strength: 0.2, relationship: 'contextual' },

  // WORKFLOW AUTOMATION skills
  { topic_slug: 'workflows', skill_slug: 'process-mapping', strength: 0.6, relationship: 'applied' },
  { topic_slug: 'automation', skill_slug: 'process-mapping', strength: 0.4, relationship: 'applied' },
  { topic_slug: 'ai-agents', skill_slug: 'process-mapping', strength: 0.3, relationship: 'contextual' },

  { topic_slug: 'no-code-ai', skill_slug: 'no-code-automation', strength: 0.9, relationship: 'direct' },
  { topic_slug: 'zapier', skill_slug: 'no-code-automation', strength: 0.8, relationship: 'applied' },
  { topic_slug: 'n8n', skill_slug: 'no-code-automation', strength: 0.8, relationship: 'applied' },
  { topic_slug: 'make', skill_slug: 'no-code-automation', strength: 0.7, relationship: 'applied' },
  { topic_slug: 'automation', skill_slug: 'no-code-automation', strength: 0.5, relationship: 'applied' },

  { topic_slug: 'mcp', skill_slug: 'tool-integration', strength: 0.7, relationship: 'applied' },
  { topic_slug: 'tool-use', skill_slug: 'tool-integration', strength: 0.7, relationship: 'applied' },
  { topic_slug: 'langchain', skill_slug: 'tool-integration', strength: 0.6, relationship: 'applied' },
  { topic_slug: 'langgraph', skill_slug: 'tool-integration', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'crewai', skill_slug: 'tool-integration', strength: 0.6, relationship: 'applied' },
  { topic_slug: 'autogen', skill_slug: 'tool-integration', strength: 0.6, relationship: 'applied' },
  { topic_slug: 'ai-agents', skill_slug: 'tool-integration', strength: 0.6, relationship: 'applied' },
  { topic_slug: 'ai-tools', skill_slug: 'tool-integration', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'apis', skill_slug: 'tool-integration', strength: 0.5, relationship: 'applied' },

  { topic_slug: 'workflows', skill_slug: 'workflow-optimization', strength: 0.7, relationship: 'direct' },
  { topic_slug: 'automation', skill_slug: 'workflow-optimization', strength: 0.6, relationship: 'applied' },
  { topic_slug: 'zapier', skill_slug: 'workflow-optimization', strength: 0.6, relationship: 'applied' },
  { topic_slug: 'n8n', skill_slug: 'workflow-optimization', strength: 0.6, relationship: 'applied' },
  { topic_slug: 'make', skill_slug: 'workflow-optimization', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'ai-productivity', skill_slug: 'workflow-optimization', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'notion', skill_slug: 'workflow-optimization', strength: 0.3, relationship: 'applied' },
  { topic_slug: 'devops', skill_slug: 'workflow-optimization', strength: 0.4, relationship: 'applied' },

  { topic_slug: 'automation', skill_slug: 'task-automation', strength: 0.8, relationship: 'direct' },
  { topic_slug: 'zapier', skill_slug: 'task-automation', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'n8n', skill_slug: 'task-automation', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'make', skill_slug: 'task-automation', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'ai-tools', skill_slug: 'task-automation', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'crewai', skill_slug: 'task-automation', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'autogen', skill_slug: 'task-automation', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'ai-agents', skill_slug: 'task-automation', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'ai-productivity', skill_slug: 'task-automation', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'notion', skill_slug: 'task-automation', strength: 0.4, relationship: 'applied' },
  { topic_slug: 'no-code-ai', skill_slug: 'task-automation', strength: 0.6, relationship: 'applied' },
  { topic_slug: 'devops', skill_slug: 'task-automation', strength: 0.3, relationship: 'applied' },

  // PERSUASION & SALES skills
  { topic_slug: 'ai-for-business', skill_slug: 'ai-prospecting', strength: 0.3, relationship: 'contextual' },
  { topic_slug: 'perplexity', skill_slug: 'ai-prospecting', strength: 0.4, relationship: 'applied' },

  { topic_slug: 'ai-writing', skill_slug: 'proposal-generation', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'chatgpt', skill_slug: 'proposal-generation', strength: 0.4, relationship: 'applied' },
  { topic_slug: 'claude', skill_slug: 'proposal-generation', strength: 0.4, relationship: 'applied' },

  { topic_slug: 'ai-for-business', skill_slug: 'pitch-development', strength: 0.3, relationship: 'contextual' },
  { topic_slug: 'ai-writing', skill_slug: 'pitch-development', strength: 0.4, relationship: 'applied' },

  { topic_slug: 'copywriting', skill_slug: 'messaging-optimization', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'social-media', skill_slug: 'messaging-optimization', strength: 0.4, relationship: 'applied' },
  { topic_slug: 'email-marketing', skill_slug: 'messaging-optimization', strength: 0.5, relationship: 'applied' },

  { topic_slug: 'perplexity', skill_slug: 'account-research', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'claude', skill_slug: 'account-research', strength: 0.3, relationship: 'applied' },

  // OPERATIONS & EXECUTION skills
  { topic_slug: 'ai-writing', skill_slug: 'sop-generation', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'notion', skill_slug: 'sop-generation', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'workflows', skill_slug: 'sop-generation', strength: 0.3, relationship: 'contextual' },

  { topic_slug: 'product-management', skill_slug: 'project-ai', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'notion', skill_slug: 'project-ai', strength: 0.4, relationship: 'applied' },
  { topic_slug: 'ai-productivity', skill_slug: 'project-ai', strength: 0.4, relationship: 'applied' },

  { topic_slug: 'ai-for-business', skill_slug: 'vendor-evaluation', strength: 0.3, relationship: 'contextual' },
  { topic_slug: 'perplexity', skill_slug: 'vendor-evaluation', strength: 0.3, relationship: 'applied' },

  { topic_slug: 'workflows', skill_slug: 'process-improvement', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'automation', skill_slug: 'process-improvement', strength: 0.4, relationship: 'applied' },
  { topic_slug: 'ai-for-business', skill_slug: 'process-improvement', strength: 0.3, relationship: 'contextual' },

  { topic_slug: 'analytics', skill_slug: 'operational-reporting', strength: 0.5, relationship: 'applied' },
  { topic_slug: 'data-science', skill_slug: 'operational-reporting', strength: 0.3, relationship: 'contextual' },
  { topic_slug: 'visualization', skill_slug: 'operational-reporting', strength: 0.4, relationship: 'applied' },
];

async function seed() {
  try {
    console.log('🌱 Starting topic-skill-map seed...');

    // Fetch existing topic slugs
    const { data: topicsData, error: topicsError } = await supabase
      .from('fp_topic_taxonomy')
      .select('slug');

    if (topicsError) {
      console.error('Error fetching topics:', topicsError);
      process.exit(1);
    }

    const existingTopics = new Set(topicsData?.map((t) => t.slug) || []);
    console.log(`✓ Fetched ${existingTopics.size} existing topics`);

    // Fetch existing skill slugs
    const { data: skillsData, error: skillsError } = await supabase
      .from('fp_skills')
      .select('slug');

    if (skillsError) {
      console.error('Error fetching skills:', skillsError);
      process.exit(1);
    }

    const existingSkills = new Set(skillsData?.map((s) => s.slug) || []);
    console.log(`✓ Fetched ${existingSkills.size} existing skills`);

    // Filter mappings to only include those where both topic and skill exist
    const validMappings = mappings.filter(
      (m) => existingTopics.has(m.topic_slug) && existingSkills.has(m.skill_slug)
    );

    const skippedCount = mappings.length - validMappings.length;
    if (skippedCount > 0) {
      console.log(`⚠ Skipping ${skippedCount} mappings with missing topic or skill references`);
    }

    console.log(`✓ Preparing to upsert ${validMappings.length} topic-skill mappings`);

    // Batch upsert in chunks to avoid timeouts
    const batchSize = 50;
    let upsertedCount = 0;

    for (let i = 0; i < validMappings.length; i += batchSize) {
      const batch = validMappings.slice(i, i + batchSize);

      const { error: upsertError } = await supabase
        .from('fp_topic_skill_map')
        .upsert(batch, {
          onConflict: 'topic_slug,skill_slug',
        });

      if (upsertError) {
        console.error(`Error upserting batch ${Math.floor(i / batchSize) + 1}:`, upsertError);
        process.exit(1);
      }

      upsertedCount += batch.length;
      console.log(`✓ Upserted batch ${Math.floor(i / batchSize) + 1} (${upsertedCount}/${validMappings.length})`);
    }

    console.log('\n📊 Seed Summary:');
    console.log(`  Total mappings defined: ${mappings.length}`);
    console.log(`  Valid mappings upserted: ${upsertedCount}`);
    console.log(`  Topics referenced: ${existingTopics.size}`);
    console.log(`  Skills referenced: ${existingSkills.size}`);
    console.log(`  Skipped (missing references): ${skippedCount}`);
    console.log('\n✅ Topic-skill-map seed complete!');
  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

seed();
