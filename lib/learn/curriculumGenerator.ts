// ─── Curriculum Generator ──────────────────────────────────────
// Designs goal-first, task-driven learning paths using GPT-4o-mini.
// The primary unit is a TASK (something the user DOES), not a video.
// Content is attached to Watch tasks as supporting material.

import OpenAI from "openai";
import type {
  ContentSearchResult,
  LearningPath,
  PathItem,
  CurriculumModule,
  TaskType,
  AiTool,
} from "@/lib/types";
import type { ProfessionalFunction, FluencyLevel } from "@/lib/onboarding/types";
import { generateEmbedding, buildSearchText } from "@/lib/learn/embeddings";
import { searchContentLake } from "@/lib/learn/contentLake";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { resolveTools, getTool } from "@/lib/learn/toolRegistry";
import { buildAdaptedPromptContext } from "@/lib/learn/adaptationEngine";
import { SAFETY_PROMPT } from "@/lib/breaks/contentSafety";

let _openai: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

// ─── System Prompt ──────────────────────────────────────────

const SYSTEM_PROMPT = `You are a curriculum designer for SkillGap.ai, an AI-native learning platform. Your job is to design task-driven learning paths that take someone from "I've heard of this" to "I can do this."

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

// ─── Structured Output Schema ───────────────────────────────

const CURRICULUM_SCHEMA = {
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

// ─── Core Generation ────────────────────────────────────────

/**
 * Generate a curriculum-based learning path from a query.
 * Searches content lake, then asks AI to design a task-driven curriculum.
 */
export async function generateCurriculum(
  query: string,
  options?: {
    userRole?: string;
    userGoal?: string;
    maxItems?: number;
    userFunction?: ProfessionalFunction;
    userFluency?: FluencyLevel;
    secondaryFunctions?: ProfessionalFunction[];
  }
): Promise<LearningPath> {
  // 1. Search content lake for relevant material
  const embedding = await generateEmbedding(query);
  const contentItems = await searchContentLake(embedding, {
    limit: options?.maxItems ?? 20,
  });

  // Filter for minimum quality + relevance
  let filtered = contentItems.filter((r) => r.similarity > 0.3);

  // If lake is thin, search YouTube directly (works for ANY topic)
  if (filtered.length < 3) {
    console.log(
      `[curriculum] Only ${filtered.length} lake items for "${query}" — searching YouTube directly`
    );

    try {
      const { searchVideos, getVideoDetails } = await import(
        "@/lib/breaks/youtubeClient"
      );

      // Search with multiple query variations for better coverage
      const queries = [
        `${query} tutorial`,
        `${query} explained`,
        `learn ${query}`,
      ];
      const allVideoIds = new Set<string>();

      const searchResults = await Promise.allSettled(
        queries.map((q) =>
          searchVideos(q, {
            maxResults: 8,
            videoDuration: "medium",
            order: "relevance",
          })
        )
      );
      for (const result of searchResults) {
        if (result.status === "fulfilled") {
          result.value.forEach((r: { videoId: string }) =>
            allVideoIds.add(r.videoId)
          );
        }
      }

      if (allVideoIds.size > 0) {
        const videos = await getVideoDetails(
          [...allVideoIds].slice(0, 15)
        );
        const validVideos = videos.filter(
          (v: { durationSeconds: number }) =>
            v.durationSeconds >= 120 && v.durationSeconds <= 2400
        );

        // Convert raw YouTube results to ContentSearchResult shape
        const ytItems: ContentSearchResult[] = validVideos
          .slice(0, 10)
          .map(ytVideoToContentResult);

        // Merge: lake results first, then YouTube fill
        filtered = [...filtered, ...ytItems].slice(0, 20);

        console.log(
          `[curriculum] YouTube fill: ${ytItems.length} videos, total: ${filtered.length} items`
        );

        // Background: index these to the content lake for next time
        backgroundIndexVideos(validVideos.slice(0, 8), query).catch(
          (err) =>
            console.error("[curriculum] Background indexing failed:", err)
        );
      }
    } catch (err) {
      console.error("[curriculum] YouTube search failed:", err);
    }
  }

  if (filtered.length < 2) {
    throw new Error(
      `Not enough content for "${query}" (found ${filtered.length})`
    );
  }

  // 2. Build content summaries for the AI
  const itemSummaries = filtered.map((item) => ({
    content_id: item.id,
    title: item.title,
    content_type: item.content_type,
    creator: item.creator_name ?? "Unknown",
    description: (item.description ?? "").slice(0, 200),
    quality_score: item.quality_score ?? 0,
    duration_seconds: item.duration_seconds ?? 300,
    topics: item.topics?.slice(0, 5) ?? [],
    has_scaffolding: !!item.scaffolding,
    scaffolding_exercise: item.scaffolding?.exercise
      ? {
          prompt: item.scaffolding.exercise.prompt?.slice(0, 200),
          tools: item.scaffolding.exercise.tools ?? [],
          has_starter_code: !!item.scaffolding.exercise.starterCode,
        }
      : null,
  }));

  // 3. Build list of available tools (adapted for function if provided)
  const allToolSlugs = new Set<string>();

  // If function is specified, prioritize function-preferred tools
  const adaptation = options?.userFunction && options?.userFluency
    ? buildAdaptedPromptContext(options.userFunction, options.userFluency, options.secondaryFunctions)
    : null;

  if (adaptation) {
    adaptation.preferredToolSlugs.forEach((slug) => allToolSlugs.add(slug));
  }

  filtered.forEach((item) => {
    if (item.scaffolding?.exercise?.tools) {
      const resolved = resolveTools(item.scaffolding.exercise.tools);
      resolved.forEach((t) => allToolSlugs.add(t.slug));
    }
  });
  // Always include Claude and ChatGPT as general-purpose options
  allToolSlugs.add("claude");
  allToolSlugs.add("chatgpt");

  const availableTools = [...allToolSlugs]
    .map((slug) => getTool(slug))
    .filter(Boolean)
    .map((t) => ({ slug: t!.slug, name: t!.name, category: t!.category }));

  // 4. Build user prompt
  const userPrompt = [
    `Topic: "${query}"`,
    options?.userRole ? `User role: ${options.userRole}` : null,
    options?.userGoal ? `User goal: ${options.userGoal}` : null,
    adaptation ? `Learner profile: ${adaptation.functionContext.label} professional, ${adaptation.fluencyContext.label} fluency level` : null,
    "",
    `Available content items (${itemSummaries.length}):`,
    JSON.stringify(itemSummaries, null, 2),
    "",
    "Available AI tools:",
    JSON.stringify(availableTools, null, 2),
    "",
    "Design a curriculum of 3-5 modules with progressive tasks. Remember:",
    "- Tasks are the primary unit, not videos",
    "- Every Watch must be followed by a Do or Check",
    "- Do tasks need complete mission briefings",
    "- Progress from guided → scaffolded → independent → solo",
    "- Final module should be a solo challenge",
  ]
    .filter(Boolean)
    .join("\n");

  // 5. Build system prompt (with adaptation + safety if applicable)
  let systemPrompt = SYSTEM_PROMPT;
  if (adaptation) {
    systemPrompt += "\n" + adaptation.adaptationBlock;
  }
  systemPrompt += "\n" + SAFETY_PROMPT;

  // 6. Call GPT-4o-mini
  try {
    const openai = getClient();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "curriculum",
          strict: true,
          schema: CURRICULUM_SCHEMA,
        },
      },
      temperature: 0.7,
    });

    const raw = JSON.parse(response.choices[0].message.content ?? "{}");

    // 7. Post-process: validate content IDs, build full PathItem array
    return postProcessCurriculum(raw, filtered, query);
  } catch (error) {
    console.error(
      "Curriculum generation failed, falling back to simple path:",
      error
    );
    return fallbackCurriculum(query, filtered);
  }
}

// ─── Post-Processing ────────────────────────────────────────

/**
 * Validate and enrich the AI-generated curriculum with real content data.
 */
function postProcessCurriculum(
  raw: Record<string, unknown>,
  contentItems: ContentSearchResult[],
  query: string
): LearningPath {
  const contentMap = new Map(contentItems.map((c) => [c.id, c]));

  const rawModules = (raw.modules ?? []) as Record<string, unknown>[];
  const modules: CurriculumModule[] = [];
  const allItems: PathItem[] = [];
  const usedContentIds = new Set<string>();
  let position = 0;

  for (let mi = 0; mi < rawModules.length; mi++) {
    const mod = rawModules[mi] as Record<string, unknown>;
    const tasks = (mod.tasks ?? []) as Record<string, unknown>[];
    let moduleDuration = 0;

    for (const task of tasks) {
      const taskType = task.task_type as TaskType;
      const item: PathItem = {
        item_id: `${mi}-${position}`,
        task_type: taskType,
        position,
        module_index: mi,
        title: (task.title as string) ?? "Untitled",
        connective_text: (task.connective_text as string) ?? "",
        duration_seconds: (task.duration_seconds as number) ?? 300,
        // Watch fields
        content_id: null,
        content_type: null,
        creator_name: null,
        source_url: null,
        thumbnail_url: null,
        quality_score: null,
        // Do/Check/Reflect fields
        mission: null,
        check: null,
        reflection: null,
      };

      // Populate type-specific fields
      if (taskType === "watch") {
        let content: ContentSearchResult | undefined;

        // Try exact content_id match first
        if (task.content_id) {
          content = contentMap.get(task.content_id as string);
        }

        // Fallback: fuzzy-match by title if AI didn't use exact content_id
        if (!content) {
          const taskTitle = ((task.title as string) ?? "").toLowerCase();
          content = contentItems.find(
            (c) =>
              !usedContentIds.has(c.id) &&
              (c.title.toLowerCase().includes(taskTitle.slice(0, 30)) ||
                taskTitle.includes(c.title.toLowerCase().slice(0, 30)))
          );
        }

        // Last resort: pick the next best unused content item
        if (!content) {
          content = contentItems.find(
            (c) => !usedContentIds.has(c.id) && c.content_type === "video"
          );
        }

        if (content) {
          usedContentIds.add(content.id);
          item.content_id = content.id;
          item.content_type = content.content_type;
          item.creator_name = content.creator_name ?? "Unknown";
          item.source_url = content.source_url;
          item.thumbnail_url = content.thumbnail_url;
          item.quality_score = content.quality_score;
          item.duration_seconds = content.duration_seconds ?? 300;
          // Use the content's actual title if AI made one up
          item.title = content.title;
        }
      }

      if (taskType === "do" && task.mission) {
        const m = task.mission as Record<string, unknown>;
        const tool = getTool(m.tool_slug as string);
        if (tool) {
          item.mission = {
            objective: m.objective as string,
            context: m.context as string,
            tool,
            tool_prompt: "", // Built below
            steps: (m.steps as string[]) ?? [],
            success_criteria: (m.success_criteria as string[]) ?? [],
            starter_code: (m.starter_code as string) ?? null,
            guidance_level:
              (m.guidance_level as
                | "guided"
                | "scaffolded"
                | "independent"
                | "solo") ?? "guided",
            submission_type:
              (m.submission_type as "text" | "screenshot" | "either") ??
              "either",
          };
        }
      }

      if (taskType === "check" && task.check) {
        const c = task.check as Record<string, unknown>;
        item.check = {
          question: c.question as string,
          options: (c.options as string[] | null) ?? null,
          correct_answer: c.correct_answer as string,
          hint:
            (c.hint as string) ?? "Think about what you just learned.",
        };
      }

      if (taskType === "reflect" && task.reflection) {
        const r = task.reflection as Record<string, unknown>;
        item.reflection = {
          prompt: r.prompt as string,
          min_length: (r.min_length as number) ?? 50,
        };
      }

      moduleDuration += item.duration_seconds;
      allItems.push(item);
      position++;
    }

    modules.push({
      index: mi,
      title: (mod.title as string) ?? `Module ${mi + 1}`,
      description: (mod.description as string) ?? "",
      task_count: tasks.length,
      duration_seconds: moduleDuration,
    });
  }

  // Build tool prompts for all Do tasks
  buildToolPrompts(allItems);

  const totalDuration = allItems.reduce(
    (sum, i) => sum + i.duration_seconds,
    0
  );

  return {
    id: "", // Set by caller on DB insert
    title: (raw.title as string) ?? `Learning: ${query}`,
    description: (raw.description as string) ?? "",
    goal: (raw.goal as string) ?? `Master ${query}`,
    query,
    topics: (raw.primary_tools as string[]) ?? [],
    primary_tools: (raw.primary_tools as string[]) ?? [],
    difficulty_level:
      (raw.difficulty_level as "beginner" | "intermediate" | "advanced") ??
      "beginner",
    estimated_duration_seconds: totalDuration,
    items: allItems,
    modules,
    source: "search",
    view_count: 0,
    start_count: 0,
    completion_count: 0,
    created_at: new Date().toISOString(),
  };
}

// ─── Tool Prompt Builder ────────────────────────────────────

/**
 * Build ready-to-paste tool prompts for all Do tasks.
 * Enriches mission.tool_prompt with contextual, tool-specific prompts.
 */
function buildToolPrompts(items: PathItem[]): void {
  for (const item of items) {
    if (item.task_type !== "do" || !item.mission) continue;

    // Find the most recent Watch task before this Do task
    const watchBefore = items
      .filter((i) => i.position < item.position && i.task_type === "watch")
      .pop();

    const parts: string[] = [];

    // Context from recent content
    if (watchBefore) {
      parts.push(`I just learned about ${watchBefore.title}.`);
    }
    if (item.mission.context) {
      parts.push(item.mission.context);
    }

    // Main objective
    parts.push("");
    parts.push(item.mission.objective);

    // Starter code
    if (item.mission.starter_code) {
      parts.push("");
      parts.push("Here's my starting point:");
      parts.push("```");
      parts.push(item.mission.starter_code);
      parts.push("```");
    }

    // Steps (for guided/scaffolded only)
    if (
      item.mission.guidance_level === "guided" ||
      item.mission.guidance_level === "scaffolded"
    ) {
      parts.push("");
      parts.push("Steps:");
      item.mission.steps.forEach((step, i) => {
        parts.push(`${i + 1}. ${step}`);
      });
    }

    // Success criteria
    parts.push("");
    parts.push("When done, the result should:");
    item.mission.success_criteria.forEach((c) => {
      parts.push(`- ${c}`);
    });

    parts.push("");
    parts.push("Guide me step by step.");

    item.mission.tool_prompt = parts.join("\n");
  }
}

// ─── Fallback ───────────────────────────────────────────────

/**
 * Fallback curriculum when AI generation fails.
 * Creates a simple watch-then-do pattern from top content.
 */
function fallbackCurriculum(
  query: string,
  contentItems: ContentSearchResult[]
): LearningPath {
  const top = contentItems
    .sort((a, b) => (b.combined_score ?? 0) - (a.combined_score ?? 0))
    .slice(0, 6);

  const items: PathItem[] = [];
  let position = 0;

  for (const content of top) {
    items.push({
      item_id: `fallback-${position}`,
      task_type: "watch",
      position,
      module_index: 0,
      title: content.title,
      connective_text: "",
      duration_seconds: content.duration_seconds ?? 300,
      content_id: content.id,
      content_type: content.content_type,
      creator_name: content.creator_name ?? "Unknown",
      source_url: content.source_url,
      thumbnail_url: content.thumbnail_url,
      quality_score: content.quality_score,
      mission: null,
      check: null,
      reflection: null,
    });
    position++;
  }

  return {
    id: "",
    title: `Explore: ${query}`,
    description: `Curated content about ${query}`,
    goal: `Understand ${query}`,
    query,
    topics: [],
    primary_tools: [],
    difficulty_level: "beginner",
    estimated_duration_seconds: items.reduce(
      (s, i) => s + i.duration_seconds,
      0
    ),
    items,
    modules: [
      {
        index: 0,
        title: "Explore",
        description: `Content about ${query}`,
        task_count: items.length,
        duration_seconds: items.reduce((s, i) => s + i.duration_seconds, 0),
      },
    ],
    source: "search",
    view_count: 0,
    start_count: 0,
    completion_count: 0,
    created_at: new Date().toISOString(),
  };
}

// ─── Cache ──────────────────────────────────────────────────

/**
 * Generate a curriculum and cache it in fp_learning_paths.
 */
export async function generateAndCacheCurriculum(
  query: string,
  options?: {
    userRole?: string;
    userGoal?: string;
    userFunction?: ProfessionalFunction;
    userFluency?: FluencyLevel;
    secondaryFunctions?: ProfessionalFunction[];
  }
): Promise<LearningPath> {
  const curriculum = await generateCurriculum(query, options);
  const supabase = createAdminClient();

  const insertData: Record<string, unknown> = {
    title: curriculum.title,
    description: curriculum.description,
    goal: curriculum.goal,
    query: curriculum.query,
    topics: curriculum.topics,
    primary_tools: curriculum.primary_tools,
    difficulty_level: curriculum.difficulty_level,
    estimated_duration_seconds: curriculum.estimated_duration_seconds,
    items: curriculum.items as unknown,
    modules: curriculum.modules as unknown,
    source: curriculum.source,
    is_cached: true,
  };

  // Store adaptation metadata for cache lookups
  if (options?.userFunction) insertData.adapted_for_function = options.userFunction;
  if (options?.userFluency) insertData.adapted_for_fluency = options.userFluency;

  const { data, error } = await supabase
    .from("fp_learning_paths")
    .insert(insertData)
    .select("id, created_at")
    .single();

  if (error) {
    console.error("Failed to cache curriculum:", error);
    throw error;
  }

  return { ...curriculum, id: data.id, created_at: data.created_at };
}

// ─── YouTube Adapter ─────────────────────────────────────────

/** Estimate quality for a raw YouTube video based on view count signals */
function estimateQuality(video: {
  viewCount: number;
  durationSeconds: number;
}): number {
  let score = 50;
  if (video.viewCount > 100000) score += 15;
  else if (video.viewCount > 10000) score += 10;
  else if (video.viewCount > 1000) score += 5;
  if (video.durationSeconds >= 300 && video.durationSeconds <= 1200)
    score += 10;
  return Math.min(score, 95);
}

/** Convert a raw YouTube video to ContentSearchResult shape */
function ytVideoToContentResult(video: {
  videoId: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string;
  publishedAt: string;
  durationSeconds: number;
  viewCount: number;
  likeCount: number;
}): ContentSearchResult {
  return {
    id: `yt-${video.videoId}`,
    content_type: "video",
    external_id: video.videoId,
    source: "youtube",
    source_url: `https://youtube.com/watch?v=${video.videoId}`,
    title: video.title,
    description: video.description,
    creator_name: video.channelTitle,
    thumbnail_url: video.thumbnailUrl,
    published_at: video.publishedAt,
    duration_seconds: video.durationSeconds,
    article_word_count: null,
    quality_score: estimateQuality(video),
    topics: [],
    editorial_note: null,
    scaffolding: null,
    scaffolding_status: null,
    indexed_at: new Date().toISOString(),
    similarity: 0.5,
    combined_score: estimateQuality(video),
  };
}

// ─── Background Indexing ─────────────────────────────────────

/**
 * Index YouTube videos to the content lake in the background.
 * Fire-and-forget — does not block the response.
 */
async function backgroundIndexVideos(
  videos: Array<{
    videoId: string;
    title: string;
    description: string;
    channelId: string;
    channelTitle: string;
    thumbnailUrl: string;
    publishedAt: string;
    durationSeconds: number;
    viewCount: number;
    likeCount: number;
  }>,
  query: string
): Promise<void> {
  const { scoreForLearning } = await import("@/lib/learn/seedScorer");
  const supabase = (await import("@/lib/supabase/admin")).createClient();

  let indexed = 0;
  for (const video of videos) {
    try {
      const score = await scoreForLearning({
        title: video.title,
        description: video.description,
        channelTitle: video.channelTitle,
        durationSeconds: video.durationSeconds,
        viewCount: video.viewCount,
      });

      if (score.rejected || score.quality_score < 40) continue;

      const searchText = buildSearchText({
        title: video.title,
        description: video.description,
        topics: score.topics,
        creator_name: video.channelTitle,
      });
      const emb = await generateEmbedding(searchText);

      await supabase.from("fp_content_lake").upsert(
        {
          content_type: "video",
          external_id: video.videoId,
          source: "youtube",
          source_url: `https://youtube.com/watch?v=${video.videoId}`,
          title: video.title,
          description: video.description,
          creator_name: video.channelTitle,
          creator_id: video.channelId,
          thumbnail_url: video.thumbnailUrl,
          published_at: video.publishedAt,
          duration_seconds: video.durationSeconds,
          view_count: video.viewCount,
          like_count: video.likeCount,
          quality_score: score.quality_score,
          relevance_scores: {
            relevance: score.relevance,
            teaching_quality: score.teaching_quality,
            practical_value: score.practical_value,
          },
          topics: score.topics,
          editorial_note: score.editorial_note,
          embedding: `[${emb.join(",")}]`,
          embedding_model: "text-embedding-3-small",
          search_text: searchText,
          scaffolding: null,
          scaffolding_status: "none",
          status: "active",
        },
        { onConflict: "content_type,external_id" }
      );
      indexed++;
    } catch (err) {
      console.error(
        `[curriculum] Background index failed for "${video.title}":`,
        err
      );
    }
  }

  console.log(
    `[curriculum] Background indexing complete for "${query}": ${indexed}/${videos.length} indexed`
  );
}
