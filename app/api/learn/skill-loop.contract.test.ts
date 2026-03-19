import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Skill, SkillDomain, SkillReceipt, SkillWithDomain } from "@/lib/types/skills";

const {
  createServerClientMock,
  createAdminClientMock,
  evaluateSubmissionMock,
  getSkillDomainsMock,
  getSkillsMock,
  getSkillsWithDomainsMock,
  getAllMarketStatesMock,
  mapPathRowMock,
  loadSkillTagsForPathsMock,
} = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
  createAdminClientMock: vi.fn(),
  evaluateSubmissionMock: vi.fn(),
  getSkillDomainsMock: vi.fn(),
  getSkillsMock: vi.fn(),
  getSkillsWithDomainsMock: vi.fn(),
  getAllMarketStatesMock: vi.fn(),
  mapPathRowMock: vi.fn(),
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

vi.mock("@/lib/skills/taxonomy", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/skills/taxonomy")>(
      "@/lib/skills/taxonomy",
    );
  return {
    ...actual,
    getSkillDomains: getSkillDomainsMock,
    getSkills: getSkillsMock,
    getSkillsWithDomains: getSkillsWithDomainsMock,
  };
});

vi.mock("@/lib/intelligence/marketState", () => ({
  getAllMarketStates: getAllMarketStatesMock,
}));

vi.mock("@/lib/learn/pathGenerator", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/learn/pathGenerator")>(
      "@/lib/learn/pathGenerator",
    );
  return {
    ...actual,
    mapPathRow: mapPathRowMock,
  };
});

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

import { PATCH as completePath } from "@/app/api/learn/paths/[id]/route";
import { GET as getSkillProfile } from "@/app/api/skills/profile/route";
import { GET as getLearnRecommendations } from "./recommendations/route";

interface ContractFixture {
  profile: { id: string; primary_function: string };
  domains: SkillDomain[];
  skills: Skill[];
  skillsWithDomains: SkillWithDomain[];
  learningPaths: Map<string, Record<string, unknown>>;
  progressRows: Array<Record<string, unknown>>;
  achievements: Array<Record<string, unknown>>;
  userSkills: Array<Record<string, unknown>>;
  skillTags: Array<Record<string, unknown>>;
  activityEvents: Array<Record<string, unknown>>;
}

let fixture: ContractFixture;

function copy<T>(value: T): T {
  return structuredClone(value);
}

function makeThenable<T>(
  factory: () => T | Promise<T>,
  methods: Record<string, unknown> = {},
) {
  return {
    ...methods,
    then(onFulfilled: (value: T) => unknown, onRejected?: (reason: unknown) => unknown) {
      return Promise.resolve()
        .then(factory)
        .then(onFulfilled, onRejected);
    },
    catch(onRejected: (reason: unknown) => unknown) {
      return Promise.resolve()
        .then(factory)
        .catch(onRejected);
    },
    finally(onFinally: () => void) {
      return Promise.resolve()
        .then(factory)
        .finally(onFinally);
    },
  };
}

function findProgress(userId: string, pathId: string) {
  return fixture.progressRows.find(
    (row) => row.user_id === userId && row.path_id === pathId,
  ) ?? null;
}

function findAchievement(userId: string, pathId: string) {
  return fixture.achievements.find(
    (row) => row.user_id === userId && row.path_id === pathId,
  ) ?? null;
}

function createAdminClientFixture() {
  return {
    from(table: string) {
      if (table === "fp_learning_paths") {
        return {
          select() {
            return {
              eq(column: string, value: unknown) {
                if (column !== "id") throw new Error(`Unexpected column ${column}`);
                return {
                  single() {
                    return Promise.resolve({
                      data: copy(
                        fixture.learningPaths.get(value as string) ?? null,
                      ),
                      error: null,
                    });
                  },
                };
              },
              in(column: string, values: unknown[]) {
                if (column !== "id") throw new Error(`Unexpected column ${column}`);
                return Promise.resolve({
                  data: values
                    .map((id) => fixture.learningPaths.get(id as string))
                    .filter(Boolean)
                    .map((row) => copy(row!)),
                  error: null,
                });
              },
            };
          },
          update(payload: Record<string, unknown>) {
            return {
              eq(column: string, value: unknown) {
                if (column !== "id") throw new Error(`Unexpected column ${column}`);
                const row = fixture.learningPaths.get(value as string);
                if (row) Object.assign(row, payload);
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      }

      if (table === "fp_learning_progress") {
        return {
          select(_columns: string, options?: { count?: string; head?: boolean }) {
            return {
              eq(column: string, value: unknown) {
                if (column !== "user_id") {
                  throw new Error(`Unexpected first progress column ${column}`);
                }

                const rowsForUser = fixture.progressRows.filter(
                  (row) => row.user_id === value,
                );

                return {
                  eq(secondColumn: string, secondValue: unknown) {
                    if (secondColumn === "path_id") {
                      return {
                        single() {
                          return Promise.resolve({
                            data: copy(
                              rowsForUser.find(
                                (row) => row.path_id === secondValue,
                              ) ?? null,
                            ),
                            error: null,
                          });
                        },
                      };
                    }

                    if (secondColumn === "status") {
                      const filtered = rowsForUser.filter(
                        (row) => row.status === secondValue,
                      );

                      if (options?.head) {
                        return Promise.resolve({
                          count: filtered.length,
                          error: null,
                        });
                      }

                      return Promise.resolve({
                        data: filtered.map((row) => copy(row)),
                        error: null,
                      });
                    }

                    throw new Error(`Unexpected second progress column ${secondColumn}`);
                  },
                };
              },
            };
          },
          insert(payload: Record<string, unknown>) {
            const now = "2026-03-19T12:00:00.000Z";
            const row = {
              id: `progress-${fixture.progressRows.length + 1}`,
              user_id: payload.user_id,
              path_id: payload.path_id,
              started_at: now,
              last_activity_at: now,
              completed_at: null,
              current_item_index: payload.current_item_index ?? 0,
              items_completed: 0,
              items_total: payload.items_total ?? 0,
              time_invested_seconds: 0,
              item_states: payload.item_states ?? {},
              status: "in_progress",
            };
            fixture.progressRows.push(row);

            return {
              select() {
                return {
                  single() {
                    return Promise.resolve({
                      data: copy(row),
                      error: null,
                    });
                  },
                };
              },
            };
          },
          update(payload: Record<string, unknown>) {
            return {
              eq(column: string, value: unknown) {
                if (column !== "id") throw new Error(`Unexpected column ${column}`);

                const row = fixture.progressRows.find((entry) => entry.id === value);
                if (!row) throw new Error("Progress row not found");

                return {
                  is(isColumn: string, isValue: unknown) {
                    return {
                      select() {
                        return {
                          single() {
                            if ((row[isColumn] ?? null) !== isValue) {
                              return Promise.resolve({
                                data: null,
                                error: null,
                              });
                            }

                            Object.assign(row, payload);
                            return Promise.resolve({
                              data: { id: row.id },
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
                        Object.assign(row, payload);
                        return Promise.resolve({
                          data: copy(row),
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

      if (table === "fp_skill_tags") {
        return {
          select() {
            return {
              eq(column: string, value: unknown) {
                if (column !== "path_id") throw new Error(`Unexpected column ${column}`);
                return Promise.resolve({
                  data: fixture.skillTags
                    .filter((tag) => tag.path_id === value)
                    .map((tag) => copy(tag)),
                  error: null,
                });
              },
              in(column: string, values: unknown[]) {
                if (column !== "skill_id") throw new Error(`Unexpected column ${column}`);
                const filtered = fixture.skillTags.filter((tag) =>
                  values.includes(tag.skill_id),
                );

                return {
                  eq(secondColumn: string, secondValue: unknown) {
                    if (secondColumn !== "relevance") {
                      throw new Error(`Unexpected second column ${secondColumn}`);
                    }
                    return Promise.resolve({
                      data: filtered
                        .filter((tag) => tag.relevance === secondValue)
                        .map((tag) => copy(tag)),
                      error: null,
                    });
                  },
                };
              },
            };
          },
        };
      }

      if (table === "fp_user_skills") {
        return {
          select(_columns: string, options?: { count?: string; head?: boolean }) {
            return {
              eq(column: string, value: unknown) {
                if (column !== "user_id") throw new Error(`Unexpected column ${column}`);
                const rows = fixture.userSkills.filter((row) => row.user_id === value);

                if (options?.head) {
                  return Promise.resolve({
                    count: rows.length,
                    error: null,
                  });
                }

                return makeThenable(
                  () => ({
                    data: rows.map((row) => copy(row)),
                    error: null,
                  }),
                  {
                    in(secondColumn: string, values: unknown[]) {
                      if (secondColumn !== "skill_id") {
                        throw new Error(`Unexpected second column ${secondColumn}`);
                      }
                      return Promise.resolve({
                        data: rows
                          .filter((row) => values.includes(row.skill_id))
                          .map((row) => copy(row)),
                        error: null,
                      });
                    },
                  },
                );
              },
            };
          },
          upsert(payload: Record<string, unknown>) {
            const existing = fixture.userSkills.find(
              (row) =>
                row.user_id === payload.user_id &&
                row.skill_id === payload.skill_id,
            );

            if (existing) {
              Object.assign(existing, payload);
            } else {
              fixture.userSkills.push({
                id: `user-skill-${fixture.userSkills.length + 1}`,
                ...payload,
              });
            }

            return Promise.resolve({ error: null });
          },
        };
      }

      if (table === "fp_achievements") {
        return {
          upsert(payload: Record<string, unknown>) {
            const existing = findAchievement(
              payload.user_id as string,
              payload.path_id as string,
            );

            if (!existing) {
              const progress = findProgress(
                payload.user_id as string,
                payload.path_id as string,
              );
              fixture.achievements.push({
                id: `achievement-${fixture.achievements.length + 1}`,
                completed_at:
                  progress?.completed_at ?? "2026-03-19T12:05:00.000Z",
                skill_receipt: null,
                ...payload,
              });
            }

            return Promise.resolve({ error: null });
          },
          select() {
            return {
              eq(column: string, value: unknown) {
                if (column !== "user_id") throw new Error(`Unexpected column ${column}`);
                const rows = fixture.achievements.filter(
                  (row) => row.user_id === value,
                );

                return {
                  eq(secondColumn: string, secondValue: unknown) {
                    if (secondColumn !== "path_id") {
                      throw new Error(`Unexpected second column ${secondColumn}`);
                    }
                    return {
                      single() {
                        return Promise.resolve({
                          data: copy(
                            rows.find((row) => row.path_id === secondValue) ?? null,
                          ),
                          error: null,
                        });
                      },
                    };
                  },
                  order(orderColumn: string, opts?: { ascending?: boolean }) {
                    if (orderColumn !== "completed_at") {
                      throw new Error(`Unexpected order column ${orderColumn}`);
                    }
                    const sorted = [...rows].sort((a, b) => {
                      const first = new Date(a.completed_at as string).getTime();
                      const second = new Date(b.completed_at as string).getTime();
                      return opts?.ascending ? first - second : second - first;
                    });

                    return {
                      limit(limit: number) {
                        const limited = sorted.slice(0, limit);
                        return makeThenable(
                          () => ({
                            data: limited.map((row) => copy(row)),
                            error: null,
                          }),
                          {
                            single() {
                              return Promise.resolve({
                                data: copy(limited[0] ?? null),
                                error: null,
                              });
                            },
                          },
                        );
                      },
                    };
                  },
                };
              },
            };
          },
          update(payload: Record<string, unknown>) {
            return {
              eq(column: string, value: unknown) {
                if (column !== "user_id") throw new Error(`Unexpected column ${column}`);
                return {
                  eq(secondColumn: string, secondValue: unknown) {
                    if (secondColumn !== "path_id") {
                      throw new Error(`Unexpected second column ${secondColumn}`);
                    }

                    const achievement = findAchievement(
                      value as string,
                      secondValue as string,
                    );
                    if (achievement) Object.assign(achievement, payload);

                    return Promise.resolve({ error: null });
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
              eq(column: string, value: unknown) {
                if (column !== "id" || value !== fixture.profile.id) {
                  throw new Error("Unexpected profile lookup");
                }
                return {
                  single() {
                    return Promise.resolve({
                      data: copy(fixture.profile),
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
            fixture.activityEvents.push(copy(payload));
            return Promise.resolve({ error: null });
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
                    return Promise.resolve({ data: [], error: null });
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

describe("skill loop contract", () => {
  beforeEach(() => {
    const workflowDomain: SkillDomain = {
      id: "domain-workflow",
      slug: "workflow-automation",
      name: "Workflow Automation",
      description: "Automation",
      icon: "workflow",
      sort_order: 1,
    };
    const writingDomain: SkillDomain = {
      id: "domain-writing",
      slug: "writing-communication",
      name: "Writing & Communication",
      description: "Writing",
      icon: "pen-tool",
      sort_order: 2,
    };

    const workflowSkill: Skill = {
      id: "skill-workflow",
      domain_id: workflowDomain.id,
      slug: "ai-workflow-design",
      name: "AI Workflow Design",
      description: "Design better AI workflows",
      relevant_functions: ["marketing", "operations"],
      sort_order: 1,
    };
    const writingSkill: Skill = {
      id: "skill-writing",
      domain_id: writingDomain.id,
      slug: "ai-assisted-writing",
      name: "AI-Assisted Writing",
      description: "Write faster with AI",
      relevant_functions: ["marketing"],
      sort_order: 1,
    };

    fixture = {
      profile: {
        id: "user-1",
        primary_function: "marketing",
      },
      domains: [workflowDomain, writingDomain],
      skills: [workflowSkill, writingSkill],
      skillsWithDomains: [
        { ...workflowSkill, domain: workflowDomain },
        { ...writingSkill, domain: writingDomain },
      ],
      learningPaths: new Map([
        [
          "path-1",
          {
            id: "path-1",
            title: "Automation Basics",
            query: "automation basics",
            description: "Learn automation",
            topics: ["automation"],
            difficulty_level: "intermediate",
            estimated_duration_seconds: 1200,
            items: [
              {
                item_id: "item-1",
                task_type: "do",
                mission: { objective: "Build a lightweight workflow" },
              },
            ],
            start_count: 0,
            completion_count: 0,
            created_at: "2026-03-10T12:00:00.000Z",
          },
        ],
        [
          "path-2",
          {
            id: "path-2",
            title: "Automation Advanced",
            query: "automation advanced",
            description: "Go deeper on automation",
            topics: ["automation"],
            difficulty_level: "intermediate",
            estimated_duration_seconds: 1800,
            items: [],
            start_count: 0,
            completion_count: 12,
            created_at: "2026-03-18T12:00:00.000Z",
          },
        ],
        [
          "path-3",
          {
            id: "path-3",
            title: "Writing with AI",
            query: "ai writing",
            description: "Use AI for writing",
            topics: ["writing"],
            difficulty_level: "beginner",
            estimated_duration_seconds: 900,
            items: [],
            start_count: 0,
            completion_count: 7,
            created_at: "2026-03-17T12:00:00.000Z",
          },
        ],
      ]),
      progressRows: [],
      achievements: [],
      userSkills: [],
      skillTags: [
        {
          path_id: "path-1",
          skill_id: "skill-workflow",
          relevance: "primary",
        },
        {
          path_id: "path-2",
          skill_id: "skill-workflow",
          relevance: "primary",
        },
        {
          path_id: "path-3",
          skill_id: "skill-writing",
          relevance: "primary",
        },
      ],
      activityEvents: [],
    };

    vi.clearAllMocks();

    createServerClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: fixture.profile.id } },
          error: null,
        }),
      },
    });

    createAdminClientMock.mockReturnValue(createAdminClientFixture());
    evaluateSubmissionMock.mockResolvedValue(null);
    getSkillDomainsMock.mockResolvedValue(fixture.domains.map((domain) => copy(domain)));
    getSkillsMock.mockResolvedValue(fixture.skills.map((skill) => copy(skill)));
    getSkillsWithDomainsMock.mockResolvedValue(
      fixture.skillsWithDomains.map((skill) => copy(skill)),
    );
    getAllMarketStatesMock.mockResolvedValue([]);
    mapPathRowMock.mockImplementation((row: Record<string, unknown>) => ({
      ...row,
      items: (row.items as unknown[]) ?? [],
      topics: (row.topics as string[]) ?? [],
      start_count: (row.start_count as number) ?? 0,
      completion_count: (row.completion_count as number) ?? 0,
      estimated_duration_seconds:
        (row.estimated_duration_seconds as number) ?? 900,
      difficulty_level: (row.difficulty_level as string) ?? "beginner",
      created_at:
        (row.created_at as string) ?? "2026-03-19T12:00:00.000Z",
    }));
    loadSkillTagsForPathsMock.mockImplementation((pathIds: string[]) =>
      Promise.resolve(
        new Map(
          pathIds.map((pathId) => {
            const tags = fixture.skillTags
              .filter((tag) => tag.path_id === pathId)
              .map((tag) => {
                const skill = fixture.skills.find((entry) => entry.id === tag.skill_id);
                return {
                  skill_slug: skill?.slug ?? "unknown",
                  skill_name: skill?.name ?? "Unknown",
                };
              });
            return [pathId, tags];
          }),
        ),
      ),
    );
  });

  it("completes a path and immediately propagates the receipt into profile and recommendations", async () => {
    const completionResponse = await completePath(
      new Request("http://localhost/api/learn/paths/path-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_completed: "item-1",
          time_delta_seconds: 60,
        }),
      }),
      { params: Promise.resolve({ id: "path-1" }) },
    );

    const completionBody = (await completionResponse.json()) as {
      achievement: {
        share_slug: string;
        path_title: string;
      };
      skill_receipt: SkillReceipt;
      progress: {
        status: string;
        completed_at: string | null;
        items_completed: number;
      };
    };

    expect(completionResponse.status).toBe(200);
    expect(completionBody.progress.status).toBe("completed");
    expect(completionBody.progress.items_completed).toBe(1);
    expect(completionBody.achievement).toMatchObject({
      path_title: "Automation Basics",
    });
    expect(completionBody.achievement.share_slug).toBeTruthy();
    expect(completionBody.skill_receipt.skills).toHaveLength(1);
    expect(completionBody.skill_receipt.skills[0]).toMatchObject({
      skill: { slug: "ai-workflow-design" },
      after: { fluency_level: "exploring", paths_completed: 1 },
    });

    const profileResponse = await getSkillProfile();
    const profileBody = (await profileResponse.json()) as {
      summary: { total_paths_completed: number; total_skills_started: number };
      recent_achievements: Array<{ skill_receipt: SkillReceipt | null }>;
      gaps: { function_gaps: Array<{ skill_slug: string }> };
    };

    expect(profileResponse.status).toBe(200);
    expect(profileBody.summary.total_paths_completed).toBe(1);
    expect(profileBody.summary.total_skills_started).toBe(1);
    expect(profileBody.recent_achievements).toHaveLength(1);
    expect(profileBody.recent_achievements[0].skill_receipt).toEqual(
      completionBody.skill_receipt,
    );
    expect(profileBody.gaps.function_gaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ skill_slug: "ai-assisted-writing" }),
      ]),
    );

    const recommendationsResponse = await getLearnRecommendations(
      new Request("http://localhost/api/learn/recommendations?limit=3"),
    );
    const recommendationsBody = (await recommendationsResponse.json()) as {
      recommendations: Array<{
        reason: string;
        skill: { slug: string };
        paths: Array<{ id: string }>;
      }>;
    };

    expect(recommendationsResponse.status).toBe(200);
    expect(recommendationsBody.recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reason: "continue_momentum",
          skill: expect.objectContaining({ slug: "ai-workflow-design" }),
          paths: expect.arrayContaining([
            expect.objectContaining({ id: "path-2" }),
          ]),
        }),
        expect.objectContaining({
          reason: "function_gap",
          skill: expect.objectContaining({ slug: "ai-assisted-writing" }),
        }),
      ]),
    );
  });
});
