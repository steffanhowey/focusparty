import { describe, expect, it } from "vitest";

import { getMissionRoomRecommendations } from "@/lib/missionRoomRecommendations";
import type { PartyWithCount } from "@/lib/parties";
import type { LearningPath } from "@/lib/types";

function createPath(overrides: Partial<LearningPath> = {}): LearningPath {
  return {
    id: "path-1",
    title: "Mission title",
    description: "Mission description",
    goal: "Mission goal",
    query: "mission query",
    topics: [],
    difficulty_level: "beginner",
    estimated_duration_seconds: 900,
    items: [],
    view_count: 0,
    start_count: 0,
    completion_count: 0,
    created_at: "2026-03-20T00:00:00.000Z",
    ...overrides,
  };
}

function createRoom(overrides: Partial<PartyWithCount>): PartyWithCount {
  return {
    id: "room-1",
    creator_id: null,
    name: "Room",
    character: "ember",
    planned_duration_min: 45,
    max_participants: 10,
    status: "waiting",
    created_at: "2026-03-20T00:00:00.000Z",
    invite_code: "abc123",
    world_key: "default",
    host_personality: "default",
    launch_room_key: "research-room",
    launch_visible: true,
    runtime_profile_key: "default",
    persistent: true,
    blueprint_id: null,
    participant_count: 0,
    synthetic_participants: [],
    ...overrides,
  };
}

describe("getMissionRoomRecommendations", () => {
  it("prefers the launch-domain room over fallback rooms", () => {
    const path = createPath({
      skill_tags: [
        {
          skill_slug: "tone-calibration",
          skill_name: "Tone Calibration",
          domain_name: "Writing & Communication",
          relevance: "primary",
        },
      ],
    });

    const rooms = [
      createRoom({
        id: "open",
        name: "Open Studio",
        launch_room_key: "open-studio",
        world_key: "gentle-start",
        runtime_profile_key: "gentle-start",
      }),
      createRoom({
        id: "message",
        name: "Messaging Lab",
        launch_room_key: "messaging-lab",
        world_key: "writer-room",
        runtime_profile_key: "writer-room",
      }),
    ];

    const recommendation = getMissionRoomRecommendations(path, rooms);

    expect(recommendation.recommendedRoom?.id).toBe("message");
    expect(recommendation.missionDomainLabel).toBe("Positioning & Messaging");
  });

  it("uses active status and participant count to break ties within preferred buckets", () => {
    const path = createPath({
      skill_tags: [
        {
          skill_slug: "content-strategy",
          skill_name: "Content Strategy",
          domain_name: "Writing & Communication",
          relevance: "primary",
        },
      ],
    });

    const rooms = [
      createRoom({
        id: "content-waiting",
        launch_room_key: "content-systems",
        world_key: "content-systems",
        runtime_profile_key: "writer-room",
        participant_count: 6,
      }),
      createRoom({
        id: "content-active",
        launch_room_key: "content-systems",
        world_key: "content-systems",
        runtime_profile_key: "writer-room",
        status: "active",
        participant_count: 2,
      }),
    ];

    const recommendation = getMissionRoomRecommendations(path, rooms);

    expect(recommendation.recommendedRoom?.id).toBe("content-active");
  });

  it("preserves the general fallback behavior when the domain is only the final safe default", () => {
    const path = createPath({
      title: "Do the work",
      goal: undefined,
      query: "plain task",
      topics: [],
    });

    const rooms = [
      createRoom({
        id: "research",
        launch_room_key: "research-room",
        world_key: "default",
        runtime_profile_key: "default",
      }),
      createRoom({
        id: "open",
        launch_room_key: "open-studio",
        world_key: "gentle-start",
        runtime_profile_key: "gentle-start",
      }),
    ];

    const recommendation = getMissionRoomRecommendations(path, rooms);

    expect(recommendation.recommendedRoom?.id).toBe("research");
    expect(recommendation.missionDomainSlug).toBe("research-insight");
  });
});
