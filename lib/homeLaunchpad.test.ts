import { describe, expect, it } from "vitest";

import {
  buildHomeBestNextRep,
  buildHomeBestRoom,
  buildHomePrimaryAction,
  buildHomeQueueSnapshot,
  buildHomeRecentMovement,
  type HomeMissionProgressEntry,
} from "@/lib/homeLaunchpad";
import type { MissionRecommendationViewModel } from "@/lib/missionRecommendations";
import type { PartyWithCount } from "@/lib/parties";
import type { GoalRecord, LearningPath, LearningProgress } from "@/lib/types";
import type { ProfileAchievement, SkillGaps } from "@/lib/useSkillProfile";

function createPath(overrides: Partial<LearningPath> = {}): LearningPath {
  return {
    id: "path-1",
    title: "Mission title",
    description: "Mission description",
    goal: "Mission goal",
    query: "Mission query",
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

function createProgress(
  overrides: Partial<LearningProgress> = {},
): LearningProgress {
  return {
    id: "progress-1",
    user_id: "user-1",
    path_id: "path-1",
    started_at: "2026-03-20T00:00:00.000Z",
    last_activity_at: "2026-03-20T00:00:00.000Z",
    completed_at: null,
    current_item_index: 0,
    items_completed: 1,
    items_total: 4,
    time_invested_seconds: 600,
    item_states: {},
    status: "in_progress",
    ...overrides,
  };
}

function createMissionRecommendation(
  path: LearningPath,
  overrides: Partial<MissionRecommendationViewModel> = {},
): MissionRecommendationViewModel {
  return {
    path,
    reason: "domain_expansion",
    explanation: "A strong next rep.",
    action: null,
    launchDomain: {
      key: "research-insight",
      label: "Research & Insight",
      shortLabel: "Research",
      source: "skill-tag",
    },
    roomHint: "Good for research and synthesis",
    ...overrides,
  };
}

function createRoom(overrides: Partial<PartyWithCount> = {}): PartyWithCount {
  return {
    id: "room-1",
    creator_id: null,
    name: "Research Room",
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

function createGoal(overrides: Partial<GoalRecord> = {}): GoalRecord {
  return {
    id: "goal-1",
    user_id: "user-1",
    title: "Saved mission",
    description: null,
    linked_path_id: "path-1",
    status: "active",
    position: 0,
    ai_generated: false,
    target_date: null,
    completed_at: null,
    created_at: "2026-03-20T00:00:00.000Z",
    updated_at: "2026-03-20T00:00:00.000Z",
    ...overrides,
  };
}

function createAchievement(
  overrides: Partial<ProfileAchievement> = {},
): ProfileAchievement {
  return {
    id: "achievement-1",
    path_id: "path-1",
    path_title: "Completed mission",
    path_topics: [],
    items_completed: 3,
    time_invested_seconds: 900,
    difficulty_level: "beginner",
    share_slug: "share-1",
    skill_receipt: null,
    completed_at: "2026-03-20T00:00:00.000Z",
    ...overrides,
  };
}

function createGaps(overrides: Partial<SkillGaps> = {}): SkillGaps {
  return {
    user_function: "marketing",
    function_gaps: [],
    active_progression: [],
    strongest: [],
    ...overrides,
  };
}

describe("homeLaunchpad helpers", () => {
  it("prefers the active mission for the hero state", () => {
    const activePath = createPath({ id: "active", title: "Active mission" });
    const activeMission: HomeMissionProgressEntry = {
      path: activePath,
      progress: createProgress({ path_id: activePath.id }),
    };
    const recommendation = createMissionRecommendation(
      createPath({ id: "next", title: "Next mission" }),
    );

    const primaryAction = buildHomePrimaryAction({
      activeMission,
      recommendations: [recommendation],
      fallbackRecommendations: [],
    });

    expect(primaryAction.kind).toBe("active");
    expect(primaryAction.mission?.id).toBe(activePath.id);
    expect(primaryAction.recommendation).toBeNull();
  });

  it("uses the first available fallback recommendation when no active mission exists", () => {
    const fallback = createMissionRecommendation(
      createPath({ id: "fallback", title: "Fallback mission" }),
    );

    const primaryAction = buildHomePrimaryAction({
      activeMission: null,
      recommendations: [],
      fallbackRecommendations: [fallback],
    });

    expect(primaryAction.kind).toBe("next");
    expect(primaryAction.mission?.id).toBe("fallback");
    expect(primaryAction.recommendation?.path.id).toBe("fallback");
  });

  it("returns one distinct secondary next rep without duplicating the hero mission", () => {
    const first = createMissionRecommendation(
      createPath({ id: "first", title: "First mission" }),
    );
    const second = createMissionRecommendation(
      createPath({ id: "second", title: "Second mission" }),
      {
        launchDomain: {
          key: "campaigns-experiments",
          label: "Campaigns & Experiments",
          shortLabel: "Campaigns",
          source: "skill-tag",
        },
      },
    );

    const primaryAction = buildHomePrimaryAction({
      activeMission: null,
      recommendations: [first, second],
      fallbackRecommendations: [first],
    });
    const bestNextRep = buildHomeBestNextRep({
      primaryAction,
      recommendations: [first, second],
      fallbackRecommendations: [first],
    });

    expect(primaryAction.mission?.id).toBe("first");
    expect(bestNextRep?.path.id).toBe("second");
  });

  it("uses the focused mission to choose the best room instead of a busier fallback room", () => {
    const messagingPath = createPath({
      id: "messaging",
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
        id: "research",
        participant_count: 8,
        launch_room_key: "research-room",
        world_key: "default",
        runtime_profile_key: "default",
      }),
      createRoom({
        id: "messaging-room",
        name: "Messaging Lab",
        participant_count: 2,
        launch_room_key: "messaging-lab",
        world_key: "writer-room",
        runtime_profile_key: "writer-room",
      }),
    ];

    const bestRoom = buildHomeBestRoom({
      focusPath: messagingPath,
      parties: rooms,
    });

    expect(bestRoom?.party.id).toBe("messaging-room");
    expect(bestRoom?.whyLine).toBe("Best for messaging work");
  });

  it("keeps recent movement capped to three compact items", () => {
    const achievements = [
      createAchievement({
        skill_receipt: {
          path: {
            id: "path-1",
            title: "Completed mission",
            completed_at: "2026-03-20T00:00:00.000Z",
          },
          is_first_receipt: false,
          skills: [
            {
              skill: {
                slug: "tone-calibration",
                name: "Tone Calibration",
                domain_slug: "writing-communication",
                domain_name: "Writing & Communication",
                domain_icon: "pen",
              },
              relevance: "primary",
              before: {
                fluency_level: "exploring",
                paths_completed: 0,
              },
              after: {
                fluency_level: "practicing",
                paths_completed: 1,
              },
              leveled_up: true,
              missions_in_path: 1,
              avg_score_in_path: null,
            },
          ],
        },
      }),
    ];
    const gaps = createGaps({
      active_progression: [
        {
          skill_slug: "campaign-planning",
          skill_name: "Campaign Planning",
          fluency_level: "exploring",
          paths_completed: 1,
          paths_to_next: 1,
          next_level: "Practicing",
        },
      ],
    });
    const nextRecommendation = createMissionRecommendation(createPath(), {
      launchDomain: {
        key: "campaigns-experiments",
        label: "Campaigns & Experiments",
        shortLabel: "Campaigns",
        source: "skill-tag",
      },
    });

    const movement = buildHomeRecentMovement({
      achievements,
      gaps,
      nextRecommendation,
    });

    expect(movement).toHaveLength(3);
    expect(movement[0]).toEqual(
      expect.objectContaining({
        label: "Completed",
        text: "Completed mission",
      }),
    );
    expect(movement[1]).toEqual(
      expect.objectContaining({
        label: "Strengthened",
        text: "Tone Calibration to Practicing",
      }),
    );
    expect(movement[2]).toEqual(
      expect.objectContaining({
        label: "Needs reps",
        text: "Campaigns",
      }),
    );
  });

  it("builds a lightweight queue snapshot that excludes the active mission and dedupes saved paths", () => {
    const activePath = createPath({
      id: "active-path",
      title: "Active mission",
    });
    const savedPath = createPath({ id: "saved-path", title: "Saved mission" });
    const activeMission: HomeMissionProgressEntry = {
      path: activePath,
      progress: createProgress({ path_id: activePath.id }),
    };

    const snapshot = buildHomeQueueSnapshot({
      goals: [
        createGoal({
          id: "goal-active",
          title: "Active mission goal",
          linked_path_id: activePath.id,
          position: 0,
        }),
        createGoal({
          id: "goal-saved",
          title: "Saved mission goal",
          linked_path_id: savedPath.id,
          position: 1,
        }),
        createGoal({
          id: "goal-saved-duplicate",
          title: "Duplicate saved mission goal",
          linked_path_id: savedPath.id,
          position: 2,
        }),
        createGoal({
          id: "goal-archived",
          title: "Archived mission goal",
          linked_path_id: "archived-path",
          position: 3,
          status: "archived",
        }),
      ],
      activeMission,
      knownPaths: [activePath, savedPath],
    });

    expect(snapshot.activeItem).toEqual(
      expect.objectContaining({
        pathId: activePath.id,
        title: "Active mission",
      }),
    );
    expect(snapshot.savedCount).toBe(1);
    expect(snapshot.savedItems).toEqual([
      expect.objectContaining({
        pathId: savedPath.id,
        title: "Saved mission",
      }),
    ]);
  });
});
