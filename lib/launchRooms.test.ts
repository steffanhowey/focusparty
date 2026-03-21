import { describe, expect, it } from "vitest";

import {
  LAUNCH_ROOM_CATALOG,
  getLaunchRoomCatalogEntryByDisplayName,
  getLaunchRoomMissionFitHint,
  getPartyLaunchLobbyFraming,
  getPartyLaunchPickerDescription,
  getPartyLaunchShortDescription,
  getPartyLaunchSwitcherSupportLine,
  type LaunchRoomKey,
} from "@/lib/launchRooms";

interface ExpectedLaunchRoomCopy {
  card: string;
  picker: string;
  lobby: string;
  switcher: string;
  missionFit: string;
}

const EXPECTED_LAUNCH_ROOM_COPY: Record<LaunchRoomKey, ExpectedLaunchRoomCopy> =
  {
    "messaging-lab": {
      card:
        "Best for messaging work that needs clarity, pressure-testing, and stronger language.",
      picker: "Sharpen positioning, offers, and copy.",
      lobby:
        "Use this room when the work is about what you're saying, how you're saying it, and why it should land.",
      switcher: "For positioning, offers, and copy",
      missionFit: "Best for messaging work",
    },
    "research-room": {
      card:
        "Best for research, synthesis, and making sense of messy information.",
      picker: "Turn inputs into usable insight.",
      lobby:
        "Use this room when the work starts with inputs, evidence, or questions, and your job is to turn that into clarity.",
      switcher: "For research, synthesis, and insight work",
      missionFit: "Good for research and synthesis",
    },
    "campaign-sprint": {
      card:
        "Best for turning ideas into launchable campaigns, tests, and live marketing moves.",
      picker: "Plan, test, and shape live campaigns.",
      lobby:
        "Use this room when the work is about getting a campaign, launch, or experiment into shape and into motion.",
      switcher: "For campaigns, launches, and experiments",
      missionFit: "Best fit for campaigns and experiments",
    },
    "content-systems": {
      card:
        "Best for designing content systems, repurposing workflows, and repeatable AI-assisted production.",
      picker: "Build repeatable content workflows.",
      lobby:
        "Use this room when the goal is not one asset, but a better way to keep creating the right assets over time.",
      switcher: "For repeatable content workflows",
      missionFit: "Good for repeatable content workflows",
    },
    "workflow-studio": {
      card:
        "Best for workflows, handoffs, operations, and AI-assisted process design.",
      picker: "Improve how the work gets done.",
      lobby:
        "Use this room when the bottleneck is not the idea itself, but the system, workflow, or handoff around it.",
      switcher: "For workflows, ops, and systems design",
      missionFit: "Best fit for workflows and ops",
    },
    "open-studio": {
      card:
        "Best for mixed work, messy starting points, and missions that don't need a specialized room.",
      picker: "Bring any mission and get moving.",
      lobby:
        "Use this room when you want a live place to work and you don't need the room to be highly specialized.",
      switcher: "For mixed work and flexible sessions",
      missionFit: "Good for mixed work",
    },
  };

describe("launch room semantics", () => {
  it("stores the approved semantics for all six launch rooms", () => {
    for (const [key, expectedCopy] of Object.entries(
      EXPECTED_LAUNCH_ROOM_COPY,
    ) as Array<[LaunchRoomKey, ExpectedLaunchRoomCopy]>) {
      expect(LAUNCH_ROOM_CATALOG[key]).toMatchObject({
        shortDescription: expectedCopy.card,
        pickerDescription: expectedCopy.picker,
        lobbyFraming: expectedCopy.lobby,
        switcherSupportLine: expectedCopy.switcher,
        missionFitHint: expectedCopy.missionFit,
      });
    }
  });

  it("looks up launch rooms by canonical display name", () => {
    for (const [key, room] of Object.entries(
      LAUNCH_ROOM_CATALOG,
    ) as Array<[LaunchRoomKey, (typeof LAUNCH_ROOM_CATALOG)[LaunchRoomKey]]>) {
      expect(getLaunchRoomCatalogEntryByDisplayName(room.name)?.key).toBe(key);
    }
  });

  it("returns the aligned helper copy for launch rooms", () => {
    const room = {
      persistent: true,
      blueprint_id: null,
      world_key: "default",
      runtime_profile_key: "default",
      launch_room_key: "research-room",
      launch_visible: true,
      name: "Research Room",
    };

    expect(getPartyLaunchShortDescription(room)).toBe(
      EXPECTED_LAUNCH_ROOM_COPY["research-room"].card,
    );
    expect(getPartyLaunchPickerDescription(room)).toBe(
      EXPECTED_LAUNCH_ROOM_COPY["research-room"].picker,
    );
    expect(getPartyLaunchLobbyFraming(room)).toBe(
      EXPECTED_LAUNCH_ROOM_COPY["research-room"].lobby,
    );
    expect(getPartyLaunchSwitcherSupportLine(room)).toBe(
      EXPECTED_LAUNCH_ROOM_COPY["research-room"].switcher,
    );
    expect(getLaunchRoomMissionFitHint("Research Room")).toBe(
      EXPECTED_LAUNCH_ROOM_COPY["research-room"].missionFit,
    );
  });

  it("keeps the existing world-based fallback for non-launch rooms", () => {
    const room = {
      persistent: false,
      blueprint_id: null,
      world_key: "vibe-coding",
      runtime_profile_key: "vibe-coding",
      launch_room_key: null,
      launch_visible: null,
      name: "Custom Builder Room",
    };

    expect(getPartyLaunchShortDescription(room)).toBe(
      "Ship code alongside other builders.",
    );
    expect(getPartyLaunchPickerDescription(room)).toBe(
      "Ship code alongside other builders.",
    );
    expect(getPartyLaunchLobbyFraming(room)).toBe(
      "Ship code alongside other builders.",
    );
    expect(getPartyLaunchSwitcherSupportLine(room)).toBe(
      "Ship code alongside other builders.",
    );
    expect(getLaunchRoomMissionFitHint("Custom Builder Room")).toBeNull();
  });
});
