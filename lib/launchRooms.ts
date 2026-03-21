import { getPartyRuntimeWorldKey, getWorldConfig } from "./worlds";

export type LaunchRoomKey =
  | "messaging-lab"
  | "research-room"
  | "campaign-sprint"
  | "content-systems"
  | "workflow-studio"
  | "open-studio";

export type LaunchRoomClass =
  | "messaging"
  | "research"
  | "campaign"
  | "content"
  | "workflow"
  | "open";

export type LaunchRoomDiscoveryTag = "coding" | "writing" | "calm";

export interface LaunchRoomCatalogEntry {
  key: LaunchRoomKey;
  name: string;
  shortDescription: string;
  pickerDescription: string;
  roomClass: LaunchRoomClass;
  supportedMissionDomains: string[];
  discoveryTags: LaunchRoomDiscoveryTag[];
  launchVisible: boolean;
  sortOrder: number;
  featuredWeight: number;
  runtimeProfileKey: string;
}

interface LaunchRoomBindingLike {
  launch_room_key?: string | null;
  launch_visible?: boolean | null;
  runtime_profile_key?: string | null;
  world_key?: string | null;
  persistent?: boolean | null;
  blueprint_id?: string | null;
  name?: string | null;
}

const LEGACY_LAUNCH_WORLD_TO_KEY: Record<string, LaunchRoomKey> = {
  "writer-room": "messaging-lab",
  default: "research-room",
  "yc-build": "campaign-sprint",
  "vibe-coding": "workflow-studio",
  "gentle-start": "open-studio",
};

const LEGACY_DISCOVERY_TAGS: Record<string, LaunchRoomDiscoveryTag[]> = {
  "vibe-coding": ["coding"],
  "yc-build": ["coding"],
  "writer-room": ["writing"],
  default: ["writing"],
  "gentle-start": ["calm"],
};

export const LAUNCH_ROOM_CATALOG: Record<LaunchRoomKey, LaunchRoomCatalogEntry> = {
  "messaging-lab": {
    key: "messaging-lab",
    name: "Messaging Lab",
    shortDescription: "Draft sharper pitches, outreach, and messaging with other communicators in motion.",
    pickerDescription: "Best for messaging, sales notes, outreach, and high-stakes communication work.",
    roomClass: "messaging",
    supportedMissionDomains: ["writing-communication", "persuasion-sales"],
    discoveryTags: ["writing"],
    launchVisible: true,
    sortOrder: 1,
    featuredWeight: 90,
    runtimeProfileKey: "writer-room",
  },
  "research-room": {
    key: "research-room",
    name: "Research Room",
    shortDescription: "Read, analyze, and synthesize without losing the thread.",
    pickerDescription: "Best for research, analysis, reading, and working through source material.",
    roomClass: "research",
    supportedMissionDomains: ["strategy-planning", "operations-execution"],
    discoveryTags: ["writing"],
    launchVisible: true,
    sortOrder: 2,
    featuredWeight: 85,
    runtimeProfileKey: "default",
  },
  "campaign-sprint": {
    key: "campaign-sprint",
    name: "Campaign Sprint",
    shortDescription: "Push launches, plans, and deadline-driven work over the line.",
    pickerDescription: "Best for launch pushes, campaign execution, and time-boxed planning work.",
    roomClass: "campaign",
    supportedMissionDomains: [
      "operations-execution",
      "strategy-planning",
      "technical-building",
    ],
    discoveryTags: ["coding"],
    launchVisible: true,
    sortOrder: 3,
    featuredWeight: 80,
    runtimeProfileKey: "yc-build",
  },
  "content-systems": {
    key: "content-systems",
    name: "Content Systems",
    shortDescription: "Build repeatable content workflows, calendars, and editorial assets.",
    pickerDescription: "Best for content ops, editorial systems, and repeatable publishing workflows.",
    roomClass: "content",
    supportedMissionDomains: [
      "writing-communication",
      "workflow-automation",
      "strategy-planning",
    ],
    discoveryTags: ["writing"],
    launchVisible: true,
    sortOrder: 4,
    featuredWeight: 78,
    runtimeProfileKey: "writer-room",
  },
  "workflow-studio": {
    key: "workflow-studio",
    name: "Workflow Studio",
    shortDescription: "Design automations, tools, and AI-assisted workflows that actually run.",
    pickerDescription: "Best for automations, tooling, systems design, and builder workflows.",
    roomClass: "workflow",
    supportedMissionDomains: ["technical-building", "workflow-automation"],
    discoveryTags: ["coding"],
    launchVisible: true,
    sortOrder: 5,
    featuredWeight: 82,
    runtimeProfileKey: "vibe-coding",
  },
  "open-studio": {
    key: "open-studio",
    name: "Open Studio",
    shortDescription: "Bring any task and get moving in a low-pressure room.",
    pickerDescription: "Best for mixed work, early momentum, and open-ended focus sessions.",
    roomClass: "open",
    supportedMissionDomains: [],
    discoveryTags: ["calm"],
    launchVisible: true,
    sortOrder: 6,
    featuredWeight: 70,
    runtimeProfileKey: "gentle-start",
  },
};

export function isLaunchRoomKey(value: string | null | undefined): value is LaunchRoomKey {
  if (!value) return false;
  return value in LAUNCH_ROOM_CATALOG;
}

export function getLaunchRoomCatalogEntry(
  key: string | null | undefined,
): LaunchRoomCatalogEntry | null {
  if (!isLaunchRoomKey(key)) return null;
  return LAUNCH_ROOM_CATALOG[key];
}

function getLegacyFallbackLaunchRoomKey(
  party: LaunchRoomBindingLike,
): LaunchRoomKey | null {
  if (!party.persistent || party.blueprint_id) return null;
  const worldKey = party.world_key ?? "";
  return LEGACY_LAUNCH_WORLD_TO_KEY[worldKey] ?? null;
}

export function getPartyLaunchRoomKey(
  party: LaunchRoomBindingLike | null | undefined,
): LaunchRoomKey | null {
  if (!party) return null;
  if (isLaunchRoomKey(party.launch_room_key)) {
    return party.launch_room_key;
  }
  return getLegacyFallbackLaunchRoomKey(party);
}

export function getPartyLaunchRoomEntry(
  party: LaunchRoomBindingLike | null | undefined,
): LaunchRoomCatalogEntry | null {
  const key = getPartyLaunchRoomKey(party);
  return key ? LAUNCH_ROOM_CATALOG[key] : null;
}

export function isPartyLaunchVisible(
  party: LaunchRoomBindingLike | null | undefined,
): boolean {
  if (!party) return false;
  if (party.persistent === false) return true;
  if (typeof party.launch_visible === "boolean") return party.launch_visible;
  return getPartyLaunchRoomEntry(party) !== null;
}

export function getPartyLaunchDisplayName(
  party: LaunchRoomBindingLike | null | undefined,
): string {
  const launchRoom = getPartyLaunchRoomEntry(party);
  if (launchRoom) return launchRoom.name;
  if (party?.name?.trim()) return party.name.trim();
  return getWorldConfig(getPartyRuntimeWorldKey(party)).label;
}

export function getPartyLaunchShortDescription(
  party: LaunchRoomBindingLike | null | undefined,
): string {
  const launchRoom = getPartyLaunchRoomEntry(party);
  if (launchRoom) return launchRoom.shortDescription;
  return getWorldConfig(getPartyRuntimeWorldKey(party)).description;
}

export function getPartyLaunchPickerDescription(
  party: LaunchRoomBindingLike | null | undefined,
): string {
  const launchRoom = getPartyLaunchRoomEntry(party);
  if (launchRoom) return launchRoom.pickerDescription;
  return getPartyLaunchShortDescription(party);
}

export function getPartyLaunchSupportedMissionDomains(
  party: LaunchRoomBindingLike | null | undefined,
): string[] {
  const launchRoom = getPartyLaunchRoomEntry(party);
  if (launchRoom) return launchRoom.supportedMissionDomains;
  return getWorldConfig(getPartyRuntimeWorldKey(party)).skillDomains;
}

export function getPartyLaunchDiscoveryTags(
  party: LaunchRoomBindingLike | null | undefined,
): LaunchRoomDiscoveryTag[] {
  const launchRoom = getPartyLaunchRoomEntry(party);
  if (launchRoom) return launchRoom.discoveryTags;
  return LEGACY_DISCOVERY_TAGS[getPartyRuntimeWorldKey(party)] ?? [];
}

export function getPartyLaunchSortOrder(
  party: LaunchRoomBindingLike | null | undefined,
): number | null {
  return getPartyLaunchRoomEntry(party)?.sortOrder ?? null;
}

export function getLaunchRoomCatalogEntries(): LaunchRoomCatalogEntry[] {
  return Object.values(LAUNCH_ROOM_CATALOG).sort(
    (left, right) => left.sortOrder - right.sortOrder,
  );
}
