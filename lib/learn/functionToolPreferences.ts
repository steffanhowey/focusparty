/**
 * Function-to-tool preference mapping.
 *
 * Maps each professional function to its preferred and secondary AI tools
 * from the tool registry. The adaptation engine uses this to prioritize
 * which tools appear in missions and recommendations.
 */

import type { ProfessionalFunction } from "@/lib/onboarding/types";
import type { AiTool } from "@/lib/types";
import { getTool } from "@/lib/learn/toolRegistry";

/** Tool preference tiers for a professional function. */
interface ToolPreferences {
  /** Primary tools — appear in most missions for this function */
  preferred: string[];
  /** Secondary tools — used for variety or advanced missions */
  secondary: string[];
}

/** Tool preferences keyed by professional function. */
const FUNCTION_TOOL_MAP: Record<ProfessionalFunction, ToolPreferences> = {
  engineering: {
    preferred: ["cursor", "copilot", "claude"],
    secondary: ["replit", "chatgpt", "v0"],
  },
  marketing: {
    preferred: ["chatgpt", "claude", "midjourney"],
    secondary: ["v0", "notebooklm"],
  },
  design: {
    preferred: ["midjourney", "v0", "claude"],
    secondary: ["cursor", "chatgpt"],
  },
  product: {
    preferred: ["claude", "chatgpt", "notebooklm"],
    secondary: ["v0", "cursor"],
  },
  data_analytics: {
    preferred: ["claude", "chatgpt", "replit"],
    secondary: ["notebooklm", "cursor"],
  },
  sales_revenue: {
    preferred: ["chatgpt", "claude", "notebooklm"],
    secondary: ["midjourney", "v0"],
  },
  operations: {
    preferred: ["claude", "chatgpt", "replit"],
    secondary: ["cursor", "notebooklm"],
  },
};

/**
 * Get tools for a professional function, sorted by relevance.
 * Preferred tools appear first, then secondary, then remaining.
 * Returns resolved AiTool objects (skips any unresolved slugs).
 */
export function getToolsForFunction(fn: ProfessionalFunction): AiTool[] {
  const prefs = FUNCTION_TOOL_MAP[fn];
  if (!prefs) return [];

  const seen = new Set<string>();
  const result: AiTool[] = [];

  // Preferred first, then secondary
  for (const slug of [...prefs.preferred, ...prefs.secondary]) {
    if (seen.has(slug)) continue;
    seen.add(slug);
    const tool = getTool(slug);
    if (tool) result.push(tool);
  }

  return result;
}

/**
 * Get just the preferred tool slugs for a function.
 * Useful for injecting into prompts without resolving full tool objects.
 */
export function getPreferredToolSlugs(fn: ProfessionalFunction): string[] {
  return FUNCTION_TOOL_MAP[fn]?.preferred ?? [];
}

/**
 * Get the tool preferences record for a function.
 */
export function getToolPreferences(fn: ProfessionalFunction): ToolPreferences {
  return FUNCTION_TOOL_MAP[fn] ?? { preferred: [], secondary: [] };
}
