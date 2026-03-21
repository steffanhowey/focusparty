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
  lobbyFraming: string;
  switcherSupportLine: string;
  missionFitHint: string;
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
    shortDescription:
      "Best for messaging work that needs clarity, pressure-testing, and stronger language.",
    pickerDescription: "Sharpen positioning, offers, and copy.",
    lobbyFraming:
      "Use this room when the work is about what you're saying, how you're saying it, and why it should land.",
    switcherSupportLine: "For positioning, offers, and copy",
    missionFitHint: "Best for messaging work",
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
    shortDescription:
      "Best for research, synthesis, and making sense of messy information.",
    pickerDescription: "Turn inputs into usable insight.",
    lobbyFraming:
      "Use this room when the work starts with inputs, evidence, or questions, and your job is to turn that into clarity.",
    switcherSupportLine: "For research, synthesis, and insight work",
    missionFitHint: "Good for research and synthesis",
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
    shortDescription:
      "Best for turning ideas into launchable campaigns, tests, and live marketing moves.",
    pickerDescription: "Plan, test, and shape live campaigns.",
    lobbyFraming:
      "Use this room when the work is about getting a campaign, launch, or experiment into shape and into motion.",
    switcherSupportLine: "For campaigns, launches, and experiments",
    missionFitHint: "Best fit for campaigns and experiments",
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
    shortDescription:
      "Best for designing content systems, repurposing workflows, and repeatable AI-assisted production.",
    pickerDescription: "Build repeatable content workflows.",
    lobbyFraming:
      "Use this room when the goal is not one asset, but a better way to keep creating the right assets over time.",
    switcherSupportLine: "For repeatable content workflows",
    missionFitHint: "Good for repeatable content workflows",
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
    shortDescription:
      "Best for workflows, handoffs, operations, and AI-assisted process design.",
    pickerDescription: "Improve how the work gets done.",
    lobbyFraming:
      "Use this room when the bottleneck is not the idea itself, but the system, workflow, or handoff around it.",
    switcherSupportLine: "For workflows, ops, and systems design",
    missionFitHint: "Best fit for workflows and ops",
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
    shortDescription:
      "Best for mixed work, messy starting points, and missions that don't need a specialized room.",
    pickerDescription: "Bring any mission and get moving.",
    lobbyFraming:
      "Use this room when you want a live place to work and you don't need the room to be highly specialized.",
    switcherSupportLine: "For mixed work and flexible sessions",
    missionFitHint: "Good for mixed work",
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

function normalizeLaunchRoomLookupValue(
  value: string | null | undefined,
): string | null {
  if (!value) return null;

  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  return normalized || null;
}

const LAUNCH_ROOM_ENTRY_BY_DISPLAY_NAME = new Map<string, LaunchRoomCatalogEntry>(
  Object.values(LAUNCH_ROOM_CATALOG).flatMap((entry) => {
    const keyLookup = normalizeLaunchRoomLookupValue(entry.key);
    const nameLookup = normalizeLaunchRoomLookupValue(entry.name);

    return [
      ...(keyLookup ? [[keyLookup, entry] as const] : []),
      ...(nameLookup ? [[nameLookup, entry] as const] : []),
    ];
  }),
);

export function getLaunchRoomCatalogEntryByDisplayName(
  value: string | null | undefined,
): LaunchRoomCatalogEntry | null {
  const normalized = normalizeLaunchRoomLookupValue(value);
  if (!normalized) return null;
  return LAUNCH_ROOM_ENTRY_BY_DISPLAY_NAME.get(normalized) ?? null;
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

export function getPartyLaunchLobbyFraming(
  party: LaunchRoomBindingLike | null | undefined,
): string {
  const launchRoom = getPartyLaunchRoomEntry(party);
  if (launchRoom) return launchRoom.lobbyFraming;
  return getPartyLaunchShortDescription(party);
}

export function getPartyLaunchSwitcherSupportLine(
  party: LaunchRoomBindingLike | null | undefined,
): string {
  const launchRoom = getPartyLaunchRoomEntry(party);
  if (launchRoom) return launchRoom.switcherSupportLine;
  return getPartyLaunchPickerDescription(party);
}

export function getLaunchRoomMissionFitHint(
  room: LaunchRoomBindingLike | string | null | undefined,
): string | null {
  if (!room) return null;

  const launchRoom =
    typeof room === "string"
      ? getLaunchRoomCatalogEntry(room) ??
        getLaunchRoomCatalogEntryByDisplayName(room)
      : getPartyLaunchRoomEntry(room);

  return launchRoom?.missionFitHint ?? null;
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
