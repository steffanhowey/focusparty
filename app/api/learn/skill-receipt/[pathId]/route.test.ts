import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SkillReceipt } from "@/lib/types/skills";

const {
  createServerClientMock,
  createAdminClientMock,
  getSkillsWithDomainsMock,
} = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
  createAdminClientMock: vi.fn(),
  getSkillsWithDomainsMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createServerClientMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createClient: createAdminClientMock,
}));

vi.mock("@/lib/skills/taxonomy", () => ({
  getSkillsWithDomains: getSkillsWithDomainsMock,
}));

import { GET } from "./route";

interface ReceiptFixture {
  achievementRow: Record<string, unknown> | null;
  progressRow: Record<string, unknown> | null;
  pathRow: Record<string, unknown> | null;
  tagRows: Array<Record<string, unknown>>;
  userSkills: Array<Record<string, unknown>>;
  tableReads: string[];
}

let fixture: ReceiptFixture;

function createAdminClientFixture() {
  return {
    from(table: string) {
      fixture.tableReads.push(table);

      if (table === "fp_achievements") {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      single() {
                        return Promise.resolve({
                          data: fixture.achievementRow,
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

      if (table === "fp_learning_progress") {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      eq() {
                        return {
                          single() {
                            return Promise.resolve({
                              data: fixture.progressRow,
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
        };
      }

      if (table === "fp_skill_tags") {
        return {
          select() {
            return {
              eq() {
                return Promise.resolve({
                  data: fixture.tagRows,
                  error: null,
                });
              },
            };
          },
        };
      }

      if (table === "fp_user_skills") {
        return {
          select() {
            return {
              eq() {
                return {
                  in() {
                    return Promise.resolve({
                      data: fixture.userSkills,
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

describe("GET /api/learn/skill-receipt/[pathId]", () => {
  beforeEach(() => {
    fixture = {
      achievementRow: null,
      progressRow: null,
      pathRow: null,
      tagRows: [],
      userSkills: [],
      tableReads: [],
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

  it("returns the persisted receipt immediately when one exists", async () => {
    const persistedReceipt: SkillReceipt = {
      path: {
        id: "path-1",
        title: "Persisted Path",
        completed_at: "2026-03-19T13:00:00.000Z",
      },
      skills: [],
      is_first_receipt: false,
    };

    fixture.achievementRow = {
      skill_receipt: persistedReceipt,
      completed_at: "2026-03-19T13:00:00.000Z",
      path_title: "Persisted Path",
    };

    const response = await GET(
      new Request("http://localhost/api/learn/skill-receipt/path-1"),
      { params: Promise.resolve({ pathId: "path-1" }) },
    );

    const body = (await response.json()) as { skill_receipt: SkillReceipt };

    expect(response.status).toBe(200);
    expect(body.skill_receipt).toEqual(persistedReceipt);
    expect(fixture.tableReads).toEqual(["fp_achievements"]);
    expect(getSkillsWithDomainsMock).not.toHaveBeenCalled();
  });

  it("reconstructs a sane fallback receipt for legacy completions", async () => {
    fixture.achievementRow = {
      skill_receipt: null,
      completed_at: "2026-03-19T13:00:00.000Z",
      path_title: "Legacy Path",
    };
    fixture.progressRow = {
      completed_at: "2026-03-19T13:00:00.000Z",
      path_id: "path-1",
    };
    fixture.pathRow = {
      id: "path-1",
      title: "Legacy Path",
    };
    fixture.tagRows = [
      { skill_id: "skill-secondary", relevance: "secondary" },
      { skill_id: "skill-primary", relevance: "primary" },
    ];
    fixture.userSkills = [
      {
        skill_id: "skill-primary",
        fluency_level: "practicing",
        paths_completed: 2,
        avg_score: 76,
      },
    ];

    getSkillsWithDomainsMock.mockResolvedValue([
      {
        id: "skill-primary",
        slug: "ai-workflow-design",
        name: "AI Workflow Design",
        description: "Workflow automation with AI",
        domain_id: "domain-1",
        relevant_functions: ["operations"],
        sort_order: 1,
        domain: {
          id: "domain-1",
          slug: "workflow-automation",
          name: "Workflow Automation",
          description: "Automation",
          icon: "workflow",
          sort_order: 1,
        },
      },
      {
        id: "skill-secondary",
        slug: "prompt-engineering",
        name: "Prompt Engineering",
        description: "Prompts",
        domain_id: "domain-2",
        relevant_functions: [],
        sort_order: 1,
        domain: {
          id: "domain-2",
          slug: "writing-communication",
          name: "Writing & Communication",
          description: "Writing",
          icon: "pen-tool",
          sort_order: 2,
        },
      },
    ]);

    const response = await GET(
      new Request("http://localhost/api/learn/skill-receipt/path-1"),
      { params: Promise.resolve({ pathId: "path-1" }) },
    );

    const body = (await response.json()) as { skill_receipt: SkillReceipt };

    expect(response.status).toBe(200);
    expect(body.skill_receipt.path).toEqual({
      id: "path-1",
      title: "Legacy Path",
      completed_at: "2026-03-19T13:00:00.000Z",
    });
    expect(body.skill_receipt.skills).toHaveLength(2);

    expect(body.skill_receipt.skills[0]).toMatchObject({
      skill: {
        slug: "ai-workflow-design",
      },
      relevance: "primary",
      before: {
        fluency_level: "exploring",
        paths_completed: 1,
      },
      after: {
        fluency_level: "practicing",
        paths_completed: 2,
      },
    });

    expect(body.skill_receipt.skills[1]).toMatchObject({
      skill: {
        slug: "prompt-engineering",
      },
      relevance: "secondary",
      before: {
        fluency_level: "exploring",
        paths_completed: 0,
      },
      after: {
        fluency_level: "exploring",
        paths_completed: 1,
      },
    });
  });
});
