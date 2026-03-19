import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createAdminClientMock,
  getSkillsMock,
  getSkillsWithDomainsMock,
  getAllMarketStatesMock,
  mapPathRowMock,
  loadSkillTagsForPathsMock,
} = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  getSkillsMock: vi.fn(),
  getSkillsWithDomainsMock: vi.fn(),
  getAllMarketStatesMock: vi.fn(),
  mapPathRowMock: vi.fn(),
  loadSkillTagsForPathsMock: vi.fn(),
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
    getSkills: getSkillsMock,
    getSkillsWithDomains: getSkillsWithDomainsMock,
  };
});

vi.mock("@/lib/intelligence/marketState", () => ({
  getAllMarketStates: getAllMarketStatesMock,
}));

vi.mock("@/lib/learn/pathGenerator", () => ({
  mapPathRow: mapPathRowMock,
}));

vi.mock("@/lib/skills/pathSkillTags", () => ({
  loadSkillTagsForPaths: loadSkillTagsForPathsMock,
}));

vi.mock("@/lib/worlds", () => ({
  WORLD_CONFIGS: {
    default: {
      skillDomains: [],
    },
  },
}));

import { getSkillRecommendations } from "./recommendations";

interface RecommendationFixture {
  userSkills: Array<Record<string, unknown>>;
  completedRows: Array<Record<string, unknown>>;
  inProgressRows: Array<Record<string, unknown>>;
  recentAchievement: Record<string, unknown> | null;
  skillTagRows: Array<Record<string, unknown>>;
  pathRows: Array<Record<string, unknown>>;
  activeRooms: Array<Record<string, unknown>>;
}

let fixture: RecommendationFixture;

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

      if (table === "fp_learning_progress") {
        return {
          select(columns: string) {
            const data = columns.includes("items_completed")
              ? fixture.inProgressRows
              : fixture.completedRows;

            return {
              eq() {
                return {
                  eq() {
                    return Promise.resolve({ data, error: null });
                  },
                };
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
                        return {
                          single() {
                            return Promise.resolve({
                              data: fixture.recentAchievement,
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
          },
        };
      }

      if (table === "fp_skill_tags") {
        return {
          select() {
            return {
              in() {
                return {
                  eq() {
                    return Promise.resolve({
                      data: fixture.skillTagRows,
                      error: null,
                    });
                  },
                };
              },
            };
          },
        };
      }

      if (table === "fp_learning_paths") {
        return {
          select() {
            return {
              in() {
                return Promise.resolve({
                  data: fixture.pathRows,
                  error: null,
                });
              },
            };
          },
        };
      }

      if (table === "fp_parties") {
        return {
          select() {
            return {
              eq() {
                return {
                  in() {
                    return Promise.resolve({
                      data: fixture.activeRooms,
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

describe("getSkillRecommendations", () => {
  beforeEach(() => {
    fixture = {
      userSkills: [],
      completedRows: [],
      inProgressRows: [],
      recentAchievement: null,
      skillTagRows: [],
      pathRows: [],
      activeRooms: [],
    };

    vi.clearAllMocks();

    createAdminClientMock.mockReturnValue(createAdminClientFixture());
    getAllMarketStatesMock.mockResolvedValue([]);
    loadSkillTagsForPathsMock.mockResolvedValue(new Map());
    mapPathRowMock.mockImplementation((row: Record<string, unknown>) => ({
      ...row,
      topics: [],
      start_count: 0,
      skill_tags: [],
      estimated_duration_seconds: 900,
      difficulty_level: "beginner",
    }));
  });

  it("fills the requested limit after filtering out skills with no valid paths", async () => {
    const skillsWithDomains = [
      {
        id: "skill-a",
        slug: "skill-a",
        name: "Skill A",
        description: "A",
        domain_id: "domain-1",
        relevant_functions: ["marketing"],
        sort_order: 1,
        domain: { id: "domain-1", slug: "domain-1", name: "Domain 1" },
      },
      {
        id: "skill-b",
        slug: "skill-b",
        name: "Skill B",
        description: "B",
        domain_id: "domain-1",
        relevant_functions: ["marketing"],
        sort_order: 1,
        domain: { id: "domain-1", slug: "domain-1", name: "Domain 1" },
      },
      {
        id: "skill-c",
        slug: "skill-c",
        name: "Skill C",
        description: "C",
        domain_id: "domain-1",
        relevant_functions: ["marketing"],
        sort_order: 1,
        domain: { id: "domain-1", slug: "domain-1", name: "Domain 1" },
      },
      {
        id: "skill-d",
        slug: "skill-d",
        name: "Skill D",
        description: "D",
        domain_id: "domain-1",
        relevant_functions: ["marketing"],
        sort_order: 1,
        domain: { id: "domain-1", slug: "domain-1", name: "Domain 1" },
      },
    ];

    getSkillsWithDomainsMock.mockResolvedValue(skillsWithDomains);
    getSkillsMock.mockResolvedValue(
      skillsWithDomains.map((skill) => ({
        id: skill.id,
        slug: skill.slug,
        name: skill.name,
        description: skill.description,
        domain_id: skill.domain_id,
        relevant_functions: skill.relevant_functions,
        sort_order: skill.sort_order,
      })),
    );

    fixture.skillTagRows = [
      { path_id: "path-c-1", skill_id: "skill-c" },
      { path_id: "path-d-1", skill_id: "skill-d" },
    ];
    fixture.pathRows = [
      {
        id: "path-c-1",
        created_at: "2026-03-19T12:00:00.000Z",
        completion_count: 12,
      },
      {
        id: "path-d-1",
        created_at: "2026-03-18T12:00:00.000Z",
        completion_count: 8,
      },
    ];

    const recommendations = await getSkillRecommendations(
      "user-1",
      "marketing",
      2,
    );

    expect(recommendations).toHaveLength(2);
    expect(recommendations.map((rec) => rec.skill.slug)).toEqual([
      "skill-c",
      "skill-d",
    ]);
    expect(recommendations.every((rec) => rec.paths.length > 0)).toBe(true);
    expect(recommendations.every((rec) => rec.action?.type === "start_path")).toBe(
      true,
    );
  });
});
