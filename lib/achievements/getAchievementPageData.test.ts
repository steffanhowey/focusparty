import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClientMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createClient: createAdminClientMock,
}));

import { loadAchievementPageData } from "./getAchievementPageData";

interface HelperFixture {
  byShareSlug: Record<string, unknown> | null;
  byId: Record<string, unknown> | null;
  profileRow: Record<string, unknown> | null;
  lookups: Array<{ table: string; column: string; value: unknown }>;
}

let fixture: HelperFixture;

function createAdminClientFixture() {
  return {
    from(table: string) {
      if (table === "fp_achievements") {
        return {
          select() {
            return {
              eq(column: string, value: unknown) {
                fixture.lookups.push({ table, column, value });

                if (column === "share_slug") {
                  return {
                    single() {
                      return Promise.resolve({
                        data: fixture.byShareSlug,
                        error: null,
                      });
                    },
                  };
                }

                if (column === "id") {
                  return {
                    single() {
                      return Promise.resolve({
                        data: fixture.byId,
                        error: null,
                      });
                    },
                  };
                }

                throw new Error(`Unexpected achievement lookup column ${column}`);
              },
            };
          },
        };
      }

      if (table === "fp_profiles") {
        return {
          select() {
            return {
              eq(column: string, value: unknown) {
                fixture.lookups.push({ table, column, value });
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

      throw new Error(`Unexpected table ${table}`);
    },
  };
}

describe("loadAchievementPageData", () => {
  beforeEach(() => {
    fixture = {
      byShareSlug: null,
      byId: null,
      profileRow: null,
      lookups: [],
    };

    vi.clearAllMocks();
    createAdminClientMock.mockReturnValue(createAdminClientFixture());
  });

  it("loads a public achievement by share slug and prefers display_name", async () => {
    fixture.byShareSlug = {
      id: "achievement-1",
      user_id: "user-1",
      path_id: "path-1",
      progress_id: "progress-1",
      path_title: "Ship a Workflow",
      path_topics: ["automation"],
      items_completed: 3,
      time_invested_seconds: 2400,
      difficulty_level: "intermediate",
      completed_at: "2026-03-19T13:00:00.000Z",
      share_slug: "steffan-automation-a3f8",
      skill_receipt: {
        path: {
          id: "path-1",
          title: "Ship a Workflow",
          completed_at: "2026-03-19T13:00:00.000Z",
        },
        skills: [],
        is_first_receipt: false,
      },
    };
    fixture.profileRow = {
      display_name: "Steffan",
      first_name: "Steffan",
    };

    const result = await loadAchievementPageData("steffan-automation-a3f8");

    expect(result).toMatchObject({
      user_name: "Steffan",
      achievement: {
        share_slug: "steffan-automation-a3f8",
        path_title: "Ship a Workflow",
        progress_id: "progress-1",
      },
    });
    expect(fixture.lookups).toEqual([
      {
        table: "fp_achievements",
        column: "share_slug",
        value: "steffan-automation-a3f8",
      },
      {
        table: "fp_profiles",
        column: "id",
        value: "user-1",
      },
    ]);
  });

  it("falls back to an id lookup and first_name when the share slug misses", async () => {
    fixture.byId = {
      id: "achievement-2",
      user_id: "user-2",
      path_id: "path-2",
      progress_id: null,
      path_title: "Master Prompt Workflows",
      path_topics: ["prompt engineering"],
      items_completed: 4,
      time_invested_seconds: 1800,
      difficulty_level: "advanced",
      completed_at: "2026-03-19T13:00:00.000Z",
      share_slug: "casey-prompt-a9z1",
      skill_receipt: null,
    };
    fixture.profileRow = {
      display_name: null,
      first_name: "Casey",
    };

    const result = await loadAchievementPageData("achievement-2");

    expect(result).toMatchObject({
      user_name: "Casey",
      achievement: {
        id: "achievement-2",
        share_slug: "casey-prompt-a9z1",
      },
    });
    expect(fixture.lookups).toEqual([
      {
        table: "fp_achievements",
        column: "share_slug",
        value: "achievement-2",
      },
      {
        table: "fp_achievements",
        column: "id",
        value: "achievement-2",
      },
      {
        table: "fp_profiles",
        column: "id",
        value: "user-2",
      },
    ]);
  });

  it("returns null when the achievement cannot be found", async () => {
    const result = await loadAchievementPageData("missing");

    expect(result).toBeNull();
    expect(fixture.lookups).toEqual([
      {
        table: "fp_achievements",
        column: "share_slug",
        value: "missing",
      },
      {
        table: "fp_achievements",
        column: "id",
        value: "missing",
      },
    ]);
  });
});
