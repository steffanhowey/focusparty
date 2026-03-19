import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SkillReceipt } from "@/lib/types/skills";

const {
  createServerClientMock,
  createAdminClientMock,
  evaluateSubmissionMock,
  calculateSkillReceiptMock,
  loadSkillTagsWithUserMock,
  loadSkillTagsForPathsMock,
} = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
  createAdminClientMock: vi.fn(),
  evaluateSubmissionMock: vi.fn(),
  calculateSkillReceiptMock: vi.fn(),
  loadSkillTagsWithUserMock: vi.fn(),
  loadSkillTagsForPathsMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createServerClientMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createClient: createAdminClientMock,
}));

vi.mock("@/lib/learn/evaluator", () => ({
  evaluateSubmission: evaluateSubmissionMock,
}));

vi.mock("@/lib/skills/receiptCalculator", () => ({
  calculateSkillReceipt: calculateSkillReceiptMock,
}));

vi.mock("@/lib/skills/pathSkillTags", () => ({
  loadSkillTagsWithUser: loadSkillTagsWithUserMock,
  loadSkillTagsForPaths: loadSkillTagsForPathsMock,
}));

import { GET, PATCH } from "./route";

interface PatchFixture {
  pathRow: Record<string, unknown> | null;
  profileRow: Record<string, unknown> | null;
  existingProgress: Record<string, unknown> | null;
  completionRow: Record<string, unknown> | null;
  existingAchievement: Record<string, unknown> | null;
  persistReceiptPromise: Promise<{ error: null }>;
  achievementUpserts: Array<Record<string, unknown>>;
  achievementReceiptUpdates: SkillReceipt[];
  activityEvents: Array<Record<string, unknown>>;
  progressInsertPayloads: Array<Record<string, unknown>>;
  progressUpdatePayloads: Array<Record<string, unknown>>;
}

let fixture: PatchFixture;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function createAdminClientFixture() {
  return {
    from(table: string) {
      if (table === "fp_learning_paths") {
        return {
          select() {
            return {
              eq() {
                return {
                  single() {
                    return Promise.resolve({
                      data: fixture.pathRow,
                      error: null,
                    });
                  },
                };
              },
            };
          },
          update() {
            return {
              eq() {
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      }

      if (table === "fp_learning_progress") {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      single() {
                        return Promise.resolve({
                          data: fixture.existingProgress,
                          error: null,
                        });
                      },
                    };
                  },
                };
              },
            };
          },
          insert(payload: Record<string, unknown>) {
            fixture.progressInsertPayloads.push(payload);

            const created = {
              id: "progress-1",
              user_id: payload.user_id as string,
              path_id: payload.path_id as string,
              started_at: "2026-03-19T12:00:00.000Z",
              last_activity_at: "2026-03-19T12:00:00.000Z",
              completed_at: null,
              current_item_index: (payload.current_item_index as number) ?? 0,
              items_completed: 0,
              items_total: (payload.items_total as number) ?? 0,
              time_invested_seconds:
                (payload.time_invested_seconds as number) ?? 0,
              item_states:
                (payload.item_states as Record<string, unknown>) ?? {},
              status: "in_progress",
            };

            fixture.existingProgress = created;

            return {
              select() {
                return {
                  single() {
                    return Promise.resolve({
                      data: created,
                      error: null,
                    });
                  },
                };
              },
            };
          },
          update(payload: Record<string, unknown>) {
            fixture.progressUpdatePayloads.push(payload);

            return {
              eq() {
                return {
                  is() {
                    return {
                      select() {
                        return {
                          single() {
                            return Promise.resolve({
                              data: fixture.completionRow,
                              error: null,
                            });
                          },
                        };
                      },
                    };
                  },
                  select() {
                    return {
                      single() {
                        const updated = {
                          ...(fixture.existingProgress ?? {}),
                          ...payload,
                        };
                        fixture.existingProgress = updated;
                        return Promise.resolve({
                          data: updated,
                          error: null,
                        });
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (table === "fp_achievements") {
        return {
          upsert(payload: Record<string, unknown>) {
            fixture.achievementUpserts.push(payload);
            fixture.existingAchievement = {
              id: "achievement-1",
              ...(fixture.existingAchievement ?? {}),
              ...payload,
              skill_receipt:
                (fixture.existingAchievement?.skill_receipt as SkillReceipt | null) ??
                null,
            };
            return Promise.resolve({ error: null });
          },
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      single() {
                        return Promise.resolve({
                          data: fixture.existingAchievement,
                          error: null,
                        });
                      },
                    };
                  },
                };
              },
            };
          },
          update(payload: { skill_receipt: SkillReceipt }) {
            fixture.achievementReceiptUpdates.push(payload.skill_receipt);
            return {
              eq() {
                return {
                  eq() {
                    return fixture.persistReceiptPromise;
                  },
                };
              },
            };
          },
        };
      }

      if (table === "fp_profiles") {
        return {
          select() {
            return {
              eq() {
                return {
                  single() {
                    return Promise.resolve({
                      data: fixture.profileRow,
                      error: null,
                    });
                  },
                };
              },
            };
          },
        };
      }

      if (table === "fp_activity_events") {
        return {
          insert(payload: Record<string, unknown>) {
            fixture.activityEvents.push(payload);
            return Promise.resolve({ error: null });
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

describe("PATCH /api/learn/paths/[id]", () => {
  beforeEach(() => {
    fixture = {
      pathRow: {
        id: "path-1",
        items: [{ item_id: "item-1", task_type: "do" }],
        start_count: 0,
        completion_count: 0,
        title: "Ship a Workflow",
        topics: ["automation"],
        difficulty_level: "intermediate",
      },
      profileRow: {
        display_name: "Steffan",
        first_name: "Steffan",
      },
      existingProgress: {
        id: "progress-1",
        user_id: "user-1",
        path_id: "path-1",
        started_at: "2026-03-19T12:00:00.000Z",
        last_activity_at: "2026-03-19T12:00:00.000Z",
        completed_at: null,
        current_item_index: 0,
        items_completed: 0,
        items_total: 1,
        time_invested_seconds: 120,
        item_states: {},
        status: "in_progress",
      },
      completionRow: { id: "progress-1" },
      existingAchievement: { skill_receipt: null },
      persistReceiptPromise: Promise.resolve({ error: null }),
      achievementUpserts: [],
      achievementReceiptUpdates: [],
      activityEvents: [],
      progressInsertPayloads: [],
      progressUpdatePayloads: [],
    };

    vi.clearAllMocks();

    createServerClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    });

    createAdminClientMock.mockReturnValue(createAdminClientFixture());
    evaluateSubmissionMock.mockResolvedValue(null);
    loadSkillTagsWithUserMock.mockResolvedValue([]);
    loadSkillTagsForPathsMock.mockResolvedValue(new Map());
  });

  it("waits for skill receipt persistence before returning the completion response", async () => {
    const receipt: SkillReceipt = {
      path: {
        id: "path-1",
        title: "Ship a Workflow",
        completed_at: "2026-03-19T13:00:00.000Z",
      },
      skills: [
        {
          skill: {
            slug: "ai-workflow-design",
            name: "AI Workflow Design",
            domain_slug: "workflow-automation",
            domain_name: "Workflow Automation",
            domain_icon: "workflow",
          },
          relevance: "primary",
          before: { fluency_level: "exploring", paths_completed: 0 },
          after: { fluency_level: "exploring", paths_completed: 1 },
          leveled_up: false,
          missions_in_path: 1,
          avg_score_in_path: 84,
        },
      ],
      is_first_receipt: false,
    };

    const persistDeferred = deferred<{ error: null }>();
    fixture.persistReceiptPromise = persistDeferred.promise;
    calculateSkillReceiptMock.mockResolvedValue(receipt);

    const pending = PATCH(
      new Request("http://localhost/api/learn/paths/path-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_completed: "item-1" }),
      }),
      { params: Promise.resolve({ id: "path-1" }) },
    );

    let settled = false;
    void pending.then(() => {
      settled = true;
    });

    await vi.waitFor(() => {
      expect(fixture.achievementReceiptUpdates).toEqual([receipt]);
    });

    expect(settled).toBe(false);

    persistDeferred.resolve({ error: null });

    const response = await pending;
    const body = (await response.json()) as {
      skill_receipt: SkillReceipt;
      achievement: { share_slug: string };
    };

    expect(response.status).toBe(200);
    expect(body.skill_receipt).toEqual(receipt);
    expect(body.achievement.share_slug).toMatch(/^steffan-automation-/);
    expect(fixture.achievementReceiptUpdates).toEqual([receipt]);
    expect(fixture.achievementUpserts[0]).toMatchObject({
      completed_at: expect.any(String),
    });
  });

  it("reuses an existing persisted receipt instead of recalculating it", async () => {
    const storedReceipt: SkillReceipt = {
      path: {
        id: "path-1",
        title: "Ship a Workflow",
        completed_at: "2026-03-19T13:00:00.000Z",
      },
      skills: [
        {
          skill: {
            slug: "ai-workflow-design",
            name: "AI Workflow Design",
            domain_slug: "workflow-automation",
            domain_name: "Workflow Automation",
            domain_icon: "workflow",
          },
          relevance: "primary",
          before: { fluency_level: "exploring", paths_completed: 0 },
          after: { fluency_level: "exploring", paths_completed: 1 },
          leveled_up: false,
          missions_in_path: 1,
          avg_score_in_path: 84,
        },
      ],
      is_first_receipt: false,
    };

    fixture.existingAchievement = { skill_receipt: storedReceipt };
    calculateSkillReceiptMock.mockResolvedValue(null);

    const response = await PATCH(
      new Request("http://localhost/api/learn/paths/path-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_completed: "item-1" }),
      }),
      { params: Promise.resolve({ id: "path-1" }) },
    );

    const body = (await response.json()) as {
      skill_receipt: SkillReceipt;
      achievement: { share_slug: string };
    };

    expect(response.status).toBe(200);
    expect(body.skill_receipt).toEqual(storedReceipt);
    expect(body.achievement.share_slug).toBeDefined();
  });

  it("processes completion on the very first patch after creating progress", async () => {
    fixture.existingProgress = null;

    const receipt: SkillReceipt = {
      path: {
        id: "path-1",
        title: "Ship a Workflow",
        completed_at: "2026-03-19T13:00:00.000Z",
      },
      skills: [
        {
          skill: {
            slug: "ai-workflow-design",
            name: "AI Workflow Design",
            domain_slug: "workflow-automation",
            domain_name: "Workflow Automation",
            domain_icon: "workflow",
          },
          relevance: "primary",
          before: { fluency_level: "exploring", paths_completed: 0 },
          after: { fluency_level: "exploring", paths_completed: 1 },
          leveled_up: false,
          missions_in_path: 1,
          avg_score_in_path: 84,
        },
      ],
      is_first_receipt: true,
    };

    calculateSkillReceiptMock.mockResolvedValue(receipt);

    const response = await PATCH(
      new Request("http://localhost/api/learn/paths/path-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_completed: "item-1",
          time_delta_seconds: 45,
        }),
      }),
      { params: Promise.resolve({ id: "path-1" }) },
    );

    const body = (await response.json()) as {
      progress: {
        status: string;
        items_completed: number;
        time_invested_seconds: number;
        completed_at: string | null;
      };
      achievement: {
        path_title: string;
        share_slug: string;
      };
      skill_receipt: SkillReceipt;
    };

    expect(response.status).toBe(200);
    expect(fixture.progressInsertPayloads).toHaveLength(1);
    expect(body.progress.status).toBe("completed");
    expect(body.progress.items_completed).toBe(1);
    expect(body.progress.time_invested_seconds).toBe(45);
    expect(body.progress.completed_at).toBeTruthy();
    expect(body.achievement).toMatchObject({
      path_title: "Ship a Workflow",
    });
    expect(body.achievement.share_slug).toMatch(/^steffan-automation-/);
    expect(body.skill_receipt).toEqual(receipt);
    expect(fixture.achievementUpserts[0]).toMatchObject({
      completed_at: body.progress.completed_at,
    });
    expect(fixture.activityEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event_type: "path_started",
          payload: expect.objectContaining({
            path_id: "path-1",
            path_title: "Ship a Workflow",
          }),
        }),
        expect.objectContaining({
          event_type: "path_completed",
          payload: expect.objectContaining({
            path_id: "path-1",
            path_title: "Ship a Workflow",
            items_completed: 1,
            time_invested_seconds: 45,
          }),
        }),
      ]),
    );
    expect(
      fixture.activityEvents.filter((event) => event.event_type === "skill_leveled_up"),
    ).toHaveLength(0);
  });

  it("emits a skill_leveled_up event with the receipt transition details", async () => {
    const receipt: SkillReceipt = {
      path: {
        id: "path-1",
        title: "Ship a Workflow",
        completed_at: "2026-03-19T13:00:00.000Z",
      },
      skills: [
        {
          skill: {
            slug: "ai-workflow-design",
            name: "AI Workflow Design",
            domain_slug: "workflow-automation",
            domain_name: "Workflow Automation",
            domain_icon: "workflow",
          },
          relevance: "primary",
          before: { fluency_level: "exploring", paths_completed: 1 },
          after: { fluency_level: "practicing", paths_completed: 2 },
          leveled_up: true,
          missions_in_path: 1,
          avg_score_in_path: 88,
        },
      ],
      is_first_receipt: false,
    };

    calculateSkillReceiptMock.mockResolvedValue(receipt);

    const response = await PATCH(
      new Request("http://localhost/api/learn/paths/path-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_completed: "item-1" }),
      }),
      { params: Promise.resolve({ id: "path-1" }) },
    );

    expect(response.status).toBe(200);
    expect(fixture.activityEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event_type: "skill_leveled_up",
          body: "Leveled up AI Workflow Design to practicing",
          payload: expect.objectContaining({
            skill_slug: "ai-workflow-design",
            skill_name: "AI Workflow Design",
            from_level: "exploring",
            to_level: "practicing",
            path_id: "path-1",
          }),
        }),
      ]),
    );
  });

  it("returns the persisted achievement summary on GET for completed paths", async () => {
    fixture.existingProgress = {
      ...fixture.existingProgress,
      status: "completed",
      completed_at: "2026-03-19T13:00:00.000Z",
      items_completed: 1,
    };
    fixture.existingAchievement = {
      id: "achievement-1",
      user_id: "user-1",
      path_id: "path-1",
      path_title: "Ship a Workflow",
      path_topics: ["automation"],
      items_completed: 1,
      time_invested_seconds: 120,
      difficulty_level: "intermediate",
      completed_at: "2026-03-19T13:00:00.000Z",
      share_slug: "steffan-automation-a3f8",
      skill_receipt: null,
    };

    const response = await GET(
      new Request("http://localhost/api/learn/paths/path-1"),
      { params: Promise.resolve({ id: "path-1" }) },
    );

    const body = (await response.json()) as {
      achievement: {
        share_slug: string;
        path_title: string;
      };
      progress: {
        status: string;
      };
    };

    expect(response.status).toBe(200);
    expect(body.progress.status).toBe("completed");
    expect(body.achievement).toMatchObject({
      share_slug: "steffan-automation-a3f8",
      path_title: "Ship a Workflow",
    });
  });
});
