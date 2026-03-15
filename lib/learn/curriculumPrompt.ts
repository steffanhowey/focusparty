// ─── Curriculum System Prompt & Schema ──────────────────────
// Extracted from curriculumGenerator.ts for independent
// versioning, testing, and future A/B testing.

/**
 * System prompt for the curriculum generator LLM call.
 * Defines the persona, rules, task types, scaffolding model,
 * and output expectations for GPT-4o-mini.
 *
 * Version history:
 *   v1 (2026-03-15) — Initial extraction from curriculumGenerator.ts
 */
export const CURRICULUM_SYSTEM_PROMPT = `You are a curriculum designer for SkillGap.ai, an AI-native learning platform. Your job is to design task-driven learning paths that take someone from "I've heard of this" to "I can do this."

CORE PRINCIPLE: The primary unit is a TASK — something the user DOES. Videos exist to support tasks, not the other way around. Never sequence two Watch tasks in a row.

You will receive:
- A topic/query the user wants to learn
- A set of available content items (videos/articles) with quality scores and scaffolding data
- Available AI tools for hands-on practice

Design a curriculum with these rules:

MODULES:
- Create 3-5 modules that progress from orientation to mastery
- Module 1 is always orientation: watch something inspiring + first hands-on task (quick win within 5-8 minutes)
- Middle modules: guided practice with increasing independence
- Final module: solo challenge with no hand-holding
- Each module: 2-4 tasks, 8-20 minutes total

TASK TYPES:
- "watch": Consume a video/article. MUST be followed by a "do" or "check" task. Never two watches in a row. Select the best content item for each watch task by its content_id.
- "do": Hands-on with an AI tool. The MAIN EVENT. Design a specific mission with clear objective, steps, and success criteria. Specify which tool to use.
- "check": Quick comprehension question. Inline — not a major step. 1-2 per module max. Include a hint for wrong answers.
- "reflect": Connect learning to personal context. Use at module boundaries only. Open-ended prompt.

PROGRESSIVE SCAFFOLDING:
- Early do tasks: provide complete prompts and detailed steps (guidance_level: "guided")
- Middle do tasks: provide partial prompts, high-level steps (guidance_level: "scaffolded")
- Late do tasks: provide goal only, user writes own prompts (guidance_level: "independent")
- Final do task: open-ended challenge, no prompt, no steps (guidance_level: "solo")

CONTENT SELECTION:
- Only select content items that directly support a task
- Prefer shorter videos (3-8 min) — they're support material, not the main event
- Use content_id from the available items to reference specific content
- If a module doesn't need a video (e.g., the solo challenge), don't force one in

GOAL STATEMENT:
- Write a clear goal: what the user will be able to DO when they finish
- Not "understand X" but "build X with Y" or "use X to accomplish Y"

MISSIONS (for do tasks):
- objective: 1 action-oriented sentence ("Use Cursor to generate a React login form")
- context: How this connects to what was just watched (1-2 sentences)
- tool_slug: Which tool from the available tools list
- steps: 3-5 numbered steps
- success_criteria: 3-5 checkable criteria for what "done" looks like
- starter_code: Include if the task needs a starting point (code, template, etc.)
- guidance_level: One of guided/scaffolded/independent/solo
- submission_type: "text" (paste code/output), "screenshot" (visual proof), or "either"

OUTPUT: Return a JSON object following the strict schema provided.`;

/**
 * JSON Schema for the structured output of the curriculum generator.
 * Used with OpenAI's `response_format: { type: 'json_schema' }`.
 *
 * Maps to the CurriculumModule / PathItem types in lib/types/learning.ts.
 */
export const CURRICULUM_SCHEMA = {
  type: "object" as const,
  properties: {
    title: { type: "string" as const },
    description: { type: "string" as const },
    goal: { type: "string" as const },
    difficulty_level: {
      type: "string" as const,
      enum: ["beginner", "intermediate", "advanced"],
    },
    primary_tools: {
      type: "array" as const,
      items: { type: "string" as const },
    },
    modules: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          title: { type: "string" as const },
          description: { type: "string" as const },
          tasks: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                task_type: {
                  type: "string" as const,
                  enum: ["watch", "do", "check", "reflect"],
                },
                title: { type: "string" as const },
                connective_text: { type: "string" as const },
                duration_seconds: { type: "number" as const },
                content_id: { type: ["string", "null"] as const },
                mission: {
                  type: ["object", "null"] as const,
                  properties: {
                    objective: { type: "string" as const },
                    context: { type: "string" as const },
                    tool_slug: { type: "string" as const },
                    steps: {
                      type: "array" as const,
                      items: { type: "string" as const },
                    },
                    success_criteria: {
                      type: "array" as const,
                      items: { type: "string" as const },
                    },
                    starter_code: { type: ["string", "null"] as const },
                    guidance_level: {
                      type: "string" as const,
                      enum: ["guided", "scaffolded", "independent", "solo"],
                    },
                    submission_type: {
                      type: "string" as const,
                      enum: ["text", "screenshot", "either"],
                    },
                  },
                  required: [
                    "objective",
                    "context",
                    "tool_slug",
                    "steps",
                    "success_criteria",
                    "starter_code",
                    "guidance_level",
                    "submission_type",
                  ] as const,
                  additionalProperties: false,
                },
                check: {
                  type: ["object", "null"] as const,
                  properties: {
                    question: { type: "string" as const },
                    options: {
                      type: ["array", "null"] as const,
                      items: { type: "string" as const },
                    },
                    correct_answer: { type: "string" as const },
                    hint: { type: "string" as const },
                  },
                  required: [
                    "question",
                    "options",
                    "correct_answer",
                    "hint",
                  ] as const,
                  additionalProperties: false,
                },
                reflection: {
                  type: ["object", "null"] as const,
                  properties: {
                    prompt: { type: "string" as const },
                    min_length: { type: "number" as const },
                  },
                  required: ["prompt", "min_length"] as const,
                  additionalProperties: false,
                },
              },
              required: [
                "task_type",
                "title",
                "connective_text",
                "duration_seconds",
                "content_id",
                "mission",
                "check",
                "reflection",
              ] as const,
              additionalProperties: false,
            },
          },
        },
        required: ["title", "description", "tasks"] as const,
        additionalProperties: false,
      },
    },
  },
  required: [
    "title",
    "description",
    "goal",
    "difficulty_level",
    "primary_tools",
    "modules",
  ] as const,
  additionalProperties: false,
};
