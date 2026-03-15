// ─── Learn Content Seed Topics ────────────────────────────────
// YouTube search queries for seeding the content lake with
// AI/learning content. Organized by category.

export interface SeedCategory {
  slug: string;
  label: string;
  queries: string[];
  /** Specific YouTube channels known for quality content in this area */
  channelIds?: string[];
}

export const SEED_CATEGORIES: SeedCategory[] = [
  {
    slug: "prompt-engineering",
    label: "Prompt Engineering",
    queries: [
      "prompt engineering tutorial 2025",
      "advanced prompt engineering techniques",
      "system prompt design best practices",
      "chain of thought prompting tutorial",
      "prompt engineering for developers",
    ],
  },
  {
    slug: "ai-coding",
    label: "AI-Assisted Coding",
    queries: [
      "cursor AI coding tutorial",
      "cursor composer tutorial 2025",
      "github copilot tutorial",
      "AI pair programming workflow",
      "vscode AI coding tools",
      "coding with AI assistants",
    ],
  },
  {
    slug: "ai-agents",
    label: "AI Agents",
    queries: [
      "building AI agents tutorial",
      "AI agent frameworks 2025",
      "autonomous AI agents explained",
      "LangChain agents tutorial",
      "CrewAI tutorial",
      "AI agent architecture",
    ],
  },
  {
    slug: "rag",
    label: "RAG & Vector Databases",
    queries: [
      "RAG tutorial retrieval augmented generation",
      "vector database tutorial 2025",
      "building RAG applications",
      "pinecone vector database tutorial",
      "RAG with LangChain",
      "embeddings tutorial for beginners",
    ],
  },
  {
    slug: "fine-tuning",
    label: "Fine-Tuning & Training",
    queries: [
      "fine tuning LLM tutorial",
      "fine tuning GPT tutorial",
      "LoRA fine tuning explained",
      "fine tuning open source models",
      "custom AI model training",
    ],
  },
  {
    slug: "ai-tools",
    label: "AI Tools & Platforms",
    queries: [
      "Claude AI tutorial",
      "ChatGPT advanced features tutorial",
      "v0 dev tutorial vercel",
      "replit AI agent tutorial",
      "NotebookLM tutorial",
      "AI tools for productivity 2025",
    ],
  },
  {
    slug: "ai-for-business",
    label: "AI for Business & Product",
    queries: [
      "AI for product managers",
      "using AI for business strategy",
      "AI automation workflows",
      "AI for non-technical professionals",
      "AI use cases for business 2025",
    ],
  },
  {
    slug: "ai-fundamentals",
    label: "AI Fundamentals",
    queries: [
      "how large language models work explained",
      "transformer architecture explained simply",
      "AI fundamentals for developers 2025",
      "machine learning basics tutorial",
      "neural networks explained visually",
    ],
  },
  {
    slug: "no-code-ai",
    label: "No-Code AI",
    queries: [
      "no code AI app building tutorial",
      "build AI apps without coding",
      "AI automation no code tools",
      "make.com AI automation tutorial",
      "zapier AI features tutorial",
    ],
  },
  {
    slug: "ai-design",
    label: "AI for Design",
    queries: [
      "midjourney tutorial 2025",
      "AI UI design workflow",
      "AI for UX designers",
      "generative AI design tools",
      "AI image generation for professionals",
    ],
  },
];
