import { describe, it, expect } from "vitest";
import { CURRICULUM_SYSTEM_PROMPT, CURRICULUM_SCHEMA } from "./curriculumPrompt";

describe("CURRICULUM_SYSTEM_PROMPT", () => {
  it("contains core design principle", () => {
    expect(CURRICULUM_SYSTEM_PROMPT).toContain(
      "The primary unit is a TASK"
    );
  });

  it("defines all four task types", () => {
    expect(CURRICULUM_SYSTEM_PROMPT).toContain('"watch"');
    expect(CURRICULUM_SYSTEM_PROMPT).toContain('"do"');
    expect(CURRICULUM_SYSTEM_PROMPT).toContain('"check"');
    expect(CURRICULUM_SYSTEM_PROMPT).toContain('"reflect"');
  });

  it("defines all four scaffolding levels", () => {
    expect(CURRICULUM_SYSTEM_PROMPT).toContain("guided");
    expect(CURRICULUM_SYSTEM_PROMPT).toContain("scaffolded");
    expect(CURRICULUM_SYSTEM_PROMPT).toContain("independent");
    expect(CURRICULUM_SYSTEM_PROMPT).toContain("solo");
  });

  it("requires 3-5 modules", () => {
    expect(CURRICULUM_SYSTEM_PROMPT).toContain("3-5 modules");
  });

  it("prohibits consecutive watch tasks", () => {
    expect(CURRICULUM_SYSTEM_PROMPT).toContain(
      "Never sequence two Watch tasks in a row"
    );
  });

  it("requires action-oriented goals", () => {
    expect(CURRICULUM_SYSTEM_PROMPT).toContain(
      'Not "understand X" but "build X with Y"'
    );
  });
});

describe("CURRICULUM_SCHEMA", () => {
  it("is a valid JSON schema object", () => {
    expect(CURRICULUM_SCHEMA.type).toBe("object");
    expect(CURRICULUM_SCHEMA.additionalProperties).toBe(false);
  });

  it("requires all top-level fields", () => {
    expect(CURRICULUM_SCHEMA.required).toContain("title");
    expect(CURRICULUM_SCHEMA.required).toContain("modules");
    expect(CURRICULUM_SCHEMA.required).toContain("goal");
    expect(CURRICULUM_SCHEMA.required).toContain("difficulty_level");
  });

  it("defines module structure with tasks array", () => {
    const moduleSchema = CURRICULUM_SCHEMA.properties.modules.items;
    expect(moduleSchema.required).toContain("tasks");
    expect(moduleSchema.properties.tasks.type).toBe("array");
  });

  it("defines all task types in the enum", () => {
    const taskSchema =
      CURRICULUM_SCHEMA.properties.modules.items.properties.tasks.items;
    const taskTypeEnum = taskSchema.properties.task_type.enum;
    expect(taskTypeEnum).toEqual(["watch", "do", "check", "reflect"]);
  });

  it("defines all guidance levels in mission schema", () => {
    const taskSchema =
      CURRICULUM_SCHEMA.properties.modules.items.properties.tasks.items;
    const missionSchema = taskSchema.properties.mission;
    const guidanceEnum = missionSchema.properties.guidance_level.enum;
    expect(guidanceEnum).toEqual([
      "guided",
      "scaffolded",
      "independent",
      "solo",
    ]);
  });

  it("requires all mission fields when present", () => {
    const taskSchema =
      CURRICULUM_SCHEMA.properties.modules.items.properties.tasks.items;
    const missionRequired = taskSchema.properties.mission.required;
    expect(missionRequired).toContain("objective");
    expect(missionRequired).toContain("tool_slug");
    expect(missionRequired).toContain("steps");
    expect(missionRequired).toContain("success_criteria");
    expect(missionRequired).toContain("guidance_level");
  });
});
