import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createServerClientMock,
  createAdminClientMock,
  getSkillDomainsMock,
  getSkillsMock,
} = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
  createAdminClientMock: vi.fn(),
  getSkillDomainsMock: vi.fn(),
  getSkillsMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createServerClientMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createClient: createAdminClientMock,
}));

vi.mock("@/lib/skills/taxonomy", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/skills/taxonomy")>(
      "@/lib/skills/taxonomy",
    );
  return {
    ...actual,
    getSkillDomains: getSkillDomainsMock,
    getSkills: getSkillsMock,
  };
});

import { GET } from "./route";

interface ProfileFixture {
  userSkills: Array<Record<string, unknown>>;
  achievements: Array<Record<string, unknown>>;
  profile: Record<string, unknown> | null;
  completedCount: number;
}

let fixture: ProfileFixture;

function createAdminClientFixture() {
  return {
    from(table: string) {
      if (table === "fp_user_skills") {
        return {
          select() {
            return {
              eq() {
                return Promise.resolve({
                  data: fixture.userSkills,
                  error: null,
                });
              },
            };
          },
        };
      }

      if (table === "fp_achievements") {
        return {
          select() {
            return {
              eq() {
                return {
                  order() {
                    return {
                      limit() {
                        return Promise.resolve({
                          data: fixture.achievements,
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

      if (table === "fp_profiles") {
        return {
          select() {
            return {
              eq() {
                return {
                  single() {
                    return Promise.resolve({
                      data: fixture.profile,
                      error: null,
                    });
                  },
                };
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
                    return Promise.resolve({
                      count: fixture.completedCount,
                      error: null,
                    });
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

describe("GET /api/skills/profile", () => {
  beforeEach(() => {
    fixture = {
      userSkills: [],
      achievements: [],
      profile: { primary_function: "marketing" },
      completedCount: 0,
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
  });

  it("uses the unique completed-path count and still matches legacy function labels for gaps", async () => {
    getSkillDomainsMock.mockResolvedValue([
      {
        id: "domain-1",
        slug: "writing-communication",
        name: "Writing & Communication",
        description: "Writing",
        icon: "pen-tool",
        sort_order: 1,
      },
    ]);

    getSkillsMock.mockResolvedValue([
      {
        id: "skill-1",
        domain_id: "domain-1",
        slug: "skill-1",
        name: "Skill 1",
        description: "First",
        relevant_functions: ["marketing"],
        sort_order: 1,
      },
      {
        id: "skill-2",
        domain_id: "domain-1",
        slug: "skill-2",
        name: "Skill 2",
        description: "Second",
        relevant_functions: ["marketing"],
        sort_order: 2,
      },
      {
        id: "skill-3",
        domain_id: "domain-1",
        slug: "skill-3",
        name: "Skill 3",
        description: "Third",
        relevant_functions: ["marketing"],
        sort_order: 3,
      },
      {
        id: "gap-skill",
        domain_id: "domain-1",
        slug: "gap-skill",
        name: "Gap Skill",
        description: "Gap",
        relevant_functions: ["Marketing"],
        sort_order: 4,
      },
    ]);

    fixture.userSkills = [
      {
        skill_id: "skill-1",
        fluency_level: "exploring",
        paths_completed: 1,
        missions_completed: 2,
        avg_score: 82,
        last_demonstrated_at: null,
      },
      {
        skill_id: "skill-2",
        fluency_level: "exploring",
        paths_completed: 1,
        missions_completed: 2,
        avg_score: 78,
        last_demonstrated_at: null,
      },
      {
        skill_id: "skill-3",
        fluency_level: "exploring",
        paths_completed: 1,
        missions_completed: 2,
        avg_score: 75,
        last_demonstrated_at: null,
      },
    ];
    fixture.completedCount = 1;

    const response = await GET();
    const body = (await response.json()) as {
      summary: { total_paths_completed: number };
      gaps: { function_gaps: Array<{ skill_slug: string }> };
    };

    expect(response.status).toBe(200);
    expect(body.summary.total_paths_completed).toBe(1);
    expect(body.summary.total_paths_completed).not.toBe(3);
    expect(body.gaps.function_gaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ skill_slug: "gap-skill" }),
      ]),
    );
  });
});
