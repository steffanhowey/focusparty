// ─── AI Tool Registry ──────────────────────────────────────────
// Rich tool metadata for deep integration with learning paths.

import type { AiTool } from "@/lib/types";

/** Complete registry of AI tools with integration metadata */
const TOOL_REGISTRY: Record<string, AiTool> = {
  claude: {
    name: "Claude",
    slug: "claude",
    url: "https://claude.ai/new",
    description: "AI assistant for analysis, writing, and code",
    icon: "sparkles",
    category: "general",
    submission_type: "either",
    paste_instruction: "Paste the prompt into the chat and press Enter.",
    supports_deep_link: false,
    deep_link_template: null,
  },
  chatgpt: {
    name: "ChatGPT",
    slug: "chatgpt",
    url: "https://chat.openai.com",
    description: "Conversational AI assistant by OpenAI",
    icon: "message-circle",
    category: "general",
    submission_type: "either",
    paste_instruction: "Paste the prompt into the message box and send.",
    supports_deep_link: false,
    deep_link_template: null,
  },
  cursor: {
    name: "Cursor",
    slug: "cursor",
    url: "https://cursor.com",
    description: "AI-powered code editor built on VS Code",
    icon: "code",
    category: "coding",
    submission_type: "text",
    paste_instruction:
      "Open Composer (Cmd+I), paste the prompt, and review the output.",
    supports_deep_link: false,
    deep_link_template: null,
  },
  v0: {
    name: "v0",
    slug: "v0",
    url: "https://v0.dev",
    description: "AI UI component generator by Vercel",
    icon: "layout",
    category: "coding",
    submission_type: "either",
    paste_instruction: "Paste the prompt in the input box and generate.",
    supports_deep_link: true,
    deep_link_template: "https://v0.dev/chat?q={{prompt}}",
  },
  replit: {
    name: "Replit",
    slug: "replit",
    url: "https://replit.com",
    description: "Browser-based IDE with AI coding assistant",
    icon: "terminal",
    category: "coding",
    submission_type: "text",
    paste_instruction:
      "Create a new Repl, open the AI tab, and paste the prompt.",
    supports_deep_link: false,
    deep_link_template: null,
  },
  copilot: {
    name: "GitHub Copilot",
    slug: "copilot",
    url: "https://github.com/features/copilot",
    description: "AI pair programmer in your editor",
    icon: "github",
    category: "coding",
    submission_type: "text",
    paste_instruction:
      "Open a file in VS Code, type a comment with the prompt, and let Copilot generate.",
    supports_deep_link: false,
    deep_link_template: null,
  },
  notebooklm: {
    name: "NotebookLM",
    slug: "notebooklm",
    url: "https://notebooklm.google.com",
    description: "AI-powered research and note-taking by Google",
    icon: "notebook-pen",
    category: "research",
    submission_type: "either",
    paste_instruction:
      "Create a new notebook, add sources, then paste the prompt in the chat.",
    supports_deep_link: false,
    deep_link_template: null,
  },
  midjourney: {
    name: "Midjourney",
    slug: "midjourney",
    url: "https://www.midjourney.com",
    description: "AI image generation",
    icon: "image",
    category: "design",
    submission_type: "screenshot",
    paste_instruction: "Use /imagine and paste the prompt.",
    supports_deep_link: false,
    deep_link_template: null,
  },
};

/** Get a tool by slug */
export function getTool(slug: string): AiTool | null {
  return TOOL_REGISTRY[slug] ?? null;
}

/** Get all tools */
export function getAllTools(): AiTool[] {
  return Object.values(TOOL_REGISTRY);
}

/** Get tools by category */
export function getToolsByCategory(category: AiTool["category"]): AiTool[] {
  return Object.values(TOOL_REGISTRY).filter((t) => t.category === category);
}

/**
 * Build a tool launch URL — uses deep link if supported, otherwise homepage.
 * For deep-linked tools, URL-encodes the prompt into the template.
 */
export function buildToolUrl(tool: AiTool, prompt?: string): string {
  if (tool.supports_deep_link && tool.deep_link_template && prompt) {
    return tool.deep_link_template.replace(
      "{{prompt}}",
      encodeURIComponent(prompt.slice(0, 2000))
    );
  }
  return tool.url;
}

/**
 * Resolve freeform tool name strings from scaffolding into structured AiTool objects.
 * Uses case-insensitive fuzzy matching against the registry.
 */
export function resolveTools(toolNames: string[]): AiTool[] {
  return toolNames
    .map((name) => {
      const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");

      // Direct slug match
      if (TOOL_REGISTRY[normalized]) return TOOL_REGISTRY[normalized];

      // Fuzzy: check if normalized input contains or is contained by any slug/name
      const match = Object.values(TOOL_REGISTRY).find((tool) => {
        const toolNorm = tool.name.toLowerCase().replace(/[^a-z0-9]/g, "");
        return (
          normalized.includes(tool.slug) ||
          toolNorm.includes(normalized) ||
          normalized.includes(toolNorm)
        );
      });

      return match ?? null;
    })
    .filter((t): t is AiTool => t !== null);
}
