import type { LaunchRoomKey } from "@/lib/launchRooms";
import type { LearningPath } from "@/lib/types";

export type LaunchDomainKey =
  | "research-insight"
  | "positioning-messaging"
  | "content-systems"
  | "campaigns-experiments"
  | "workflow-design-operations";

export type MissionLaunchDomainSource =
  | "skill-tag"
  | "legacy-domain"
  | "keyword"
  | "fallback";

export interface MissionLaunchDomain {
  key: LaunchDomainKey;
  label: string;
  shortLabel: string;
  source: MissionLaunchDomainSource;
}

interface LaunchDomainDefinition {
  key: LaunchDomainKey;
  label: string;
  shortLabel: string;
}

const LAUNCH_DOMAIN_DEFINITIONS: LaunchDomainDefinition[] = [
  {
    key: "research-insight",
    label: "Research & Insight",
    shortLabel: "Research",
  },
  {
    key: "positioning-messaging",
    label: "Positioning & Messaging",
    shortLabel: "Messaging",
  },
  {
    key: "content-systems",
    label: "Content Systems",
    shortLabel: "Content Systems",
  },
  {
    key: "campaigns-experiments",
    label: "Campaigns & Experiments",
    shortLabel: "Campaigns",
  },
  {
    key: "workflow-design-operations",
    label: "Workflow Design & Operations",
    shortLabel: "Workflow",
  },
];

const LAUNCH_DOMAIN_BY_KEY = new Map(
  LAUNCH_DOMAIN_DEFINITIONS.map((domain) => [domain.key, domain]),
);

export const LAUNCH_DOMAIN_OPTIONS = LAUNCH_DOMAIN_DEFINITIONS;

const SKILL_TO_LAUNCH_DOMAIN: Record<string, LaunchDomainKey> = {
  "research-synthesis": "research-insight",
  "competitive-analysis": "research-insight",
  "competitive-analysis-ai": "research-insight",
  "market-intelligence-ai": "research-insight",
  "account-research": "research-insight",
  "ai-audience-analysis": "research-insight",
  "scenario-modeling": "research-insight",
  "vendor-evaluation": "research-insight",

  "tone-calibration": "positioning-messaging",
  "tone-voice-calibration": "positioning-messaging",
  "ai-sales-messaging": "positioning-messaging",
  "proposal-generation": "positioning-messaging",
  "ai-proposal-generation": "positioning-messaging",
  "pitch-development": "positioning-messaging",
  "ai-pitch-development": "positioning-messaging",
  // Temporary launch simplification: revisit these if we expand a more
  // creative/design-native taxonomy after launch.
  "ai-brand-design": "positioning-messaging",
  // Temporary launch simplification: revisit these if we expand a more
  // creative/design-native taxonomy after launch.
  "ai-presentation-design": "positioning-messaging",

  "content-strategy": "content-systems",
  "content-strategy-ai": "content-systems",
  "ai-assisted-writing": "content-systems",
  "email-generation": "content-systems",
  "technical-writing-ai": "content-systems",
  "sop-generation": "content-systems",
  "ai-document-processing": "content-systems",
  "ai-knowledge-management": "content-systems",

  "messaging-optimization": "campaigns-experiments",
  "ai-email-automation": "campaigns-experiments",
  "ai-prospecting": "campaigns-experiments",
  "ai-image-direction": "campaigns-experiments",
  "ai-video-creation": "campaigns-experiments",

  "ai-workflow-design": "workflow-design-operations",
  "process-mapping": "workflow-design-operations",
  "no-code-automation": "workflow-design-operations",
  "no-code-ai-tools": "workflow-design-operations",
  "tool-integration": "workflow-design-operations",
  "workflow-optimization": "workflow-design-operations",
  "task-automation": "workflow-design-operations",
  "api-integration-ai": "workflow-design-operations",
  "ai-project-management": "workflow-design-operations",
  "ai-process-improvement": "workflow-design-operations",
};

const LEGACY_DOMAIN_TO_LAUNCH_DOMAIN: Record<string, LaunchDomainKey> = {
  "strategy-planning": "research-insight",
  "strategy-and-planning": "research-insight",

  "writing-communication": "positioning-messaging",
  "writing-and-communication": "positioning-messaging",
  "persuasion-sales": "positioning-messaging",
  "persuasion-and-sales": "positioning-messaging",

  "workflow-automation": "workflow-design-operations",
  "operations-execution": "workflow-design-operations",
  "operations-and-execution": "workflow-design-operations",
  "technical-building": "workflow-design-operations",

  "visual-design": "content-systems",
  "visual-and-design": "content-systems",
};

const KEYWORD_BUCKETS: Array<{
  key: LaunchDomainKey;
  keywords: string[];
}> = [
  {
    key: "research-insight",
    keywords: ["research", "insight", "audience", "competitive"],
  },
  {
    key: "positioning-messaging",
    keywords: ["messaging", "positioning", "tone", "copy"],
  },
  {
    key: "content-systems",
    keywords: ["content", "editorial", "calendar", "newsletter"],
  },
  {
    key: "campaigns-experiments",
    keywords: ["campaign", "experiment", "launch", "outreach"],
  },
  {
    key: "workflow-design-operations",
    keywords: ["workflow", "automation", "process", "ops"],
  },
];

const LAUNCH_ROOM_PREFERENCE_ORDER: Record<LaunchDomainKey, LaunchRoomKey[]> = {
  "research-insight": ["research-room", "open-studio"],
  "positioning-messaging": [
    "messaging-lab",
    "research-room",
    "open-studio",
  ],
  "content-systems": [
    "content-systems",
    "workflow-studio",
    "open-studio",
  ],
  "campaigns-experiments": [
    "campaign-sprint",
    "messaging-lab",
    "open-studio",
  ],
  "workflow-design-operations": [
    "workflow-studio",
    "content-systems",
    "open-studio",
  ],
};

const DOMAIN_SOURCE_PRIORITY: Record<MissionLaunchDomainSource, number> = {
  "skill-tag": 4,
  "legacy-domain": 3,
  keyword: 2,
  fallback: 1,
};

function normalizeLookupValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\w\s-]/g, " ")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+/g, "-");

  return normalized || null;
}

function toLaunchDomain(
  key: LaunchDomainKey,
  source: MissionLaunchDomainSource,
): MissionLaunchDomain {
  const definition = LAUNCH_DOMAIN_BY_KEY.get(key);
  if (!definition) {
    throw new Error(`Unknown launch domain: ${key}`);
  }

  return {
    key: definition.key,
    label: definition.label,
    shortLabel: definition.shortLabel,
    source,
  };
}

function getSkillTagDomain(path: LearningPath): MissionLaunchDomain | null {
  const orderedTags = [...(path.skill_tags ?? [])].sort((left, right) => {
    if (left.relevance === "primary" && right.relevance !== "primary") return -1;
    if (left.relevance !== "primary" && right.relevance === "primary") return 1;
    return 0;
  });

  for (const tag of orderedTags) {
    const skillKey = normalizeLookupValue(tag.skill_slug);
    if (!skillKey) continue;

    const resolvedKey = SKILL_TO_LAUNCH_DOMAIN[skillKey];
    if (resolvedKey) {
      return toLaunchDomain(resolvedKey, "skill-tag");
    }
  }

  return null;
}

function getLegacyDomain(path: LearningPath): MissionLaunchDomain | null {
  const orderedTags = [...(path.skill_tags ?? [])].sort((left, right) => {
    if (left.relevance === "primary" && right.relevance !== "primary") return -1;
    if (left.relevance !== "primary" && right.relevance === "primary") return 1;
    return 0;
  });

  for (const tag of orderedTags) {
    const domainKey = normalizeLookupValue(tag.domain_name);
    if (!domainKey) continue;

    const resolvedKey = LEGACY_DOMAIN_TO_LAUNCH_DOMAIN[domainKey];
    if (resolvedKey) {
      return toLaunchDomain(resolvedKey, "legacy-domain");
    }
  }

  return null;
}

function getKeywordDomain(path: LearningPath): MissionLaunchDomain | null {
  const keywordText = [
    path.title,
    path.goal,
    path.query,
    ...path.topics.slice(0, 2),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  if (!keywordText) return null;

  for (const bucket of KEYWORD_BUCKETS) {
    if (bucket.keywords.some((keyword) => keywordText.includes(keyword))) {
      return toLaunchDomain(bucket.key, "keyword");
    }
  }

  return null;
}

export function getMissionLaunchDomain(path: LearningPath): MissionLaunchDomain {
  return (
    getSkillTagDomain(path) ??
    getLegacyDomain(path) ??
    getKeywordDomain(path) ??
    toLaunchDomain("research-insight", "fallback")
  );
}

export function getMissionLaunchDomainShortLabel(path: LearningPath): string {
  return getMissionLaunchDomain(path).shortLabel;
}

export function getLaunchRoomPreferenceOrder(
  domainKey: LaunchDomainKey,
): LaunchRoomKey[] {
  return LAUNCH_ROOM_PREFERENCE_ORDER[domainKey];
}

export function getMissionLaunchDomainPriority(
  path: LearningPath,
): number {
  return DOMAIN_SOURCE_PRIORITY[getMissionLaunchDomain(path).source];
}

