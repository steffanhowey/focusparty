import { getTool } from "@/lib/learn/toolRegistry";
import type { AiTool } from "@/lib/types";
import type { MissionBriefV2 } from "@/lib/missions/types/missionBriefV2";

const CAPABILITY_FALLBACKS: Record<string, string> = {
  "general-llm": "chatgpt",
  research: "notebooklm",
  writing: "chatgpt",
  coding: "cursor",
  design: "midjourney",
};

/** Resolve a canonical mission brief tool plan into a concrete legacy AiTool. */
export function resolveMissionProjectionTool(brief: MissionBriefV2): AiTool {
  const primary = brief.tools?.primary;

  if (primary?.resolutionType === "registry") {
    const tool = getTool(primary.toolKey);
    if (tool) {
      return tool;
    }
  }

  if (primary?.displayName) {
    const tool = getTool(primary.displayName.toLowerCase());
    if (tool) {
      return tool;
    }
  }

  for (const capability of primary?.capabilityTags ?? []) {
    const fallbackSlug = CAPABILITY_FALLBACKS[capability];
    if (!fallbackSlug) continue;

    const tool = getTool(fallbackSlug);
    if (tool) {
      return tool;
    }
  }

  if (primary?.toolKey) {
    const tool = getTool(primary.toolKey);
    if (tool) {
      return tool;
    }
  }

  return getTool("chatgpt")!;
}

export const __testing = {
  CAPABILITY_FALLBACKS,
};
