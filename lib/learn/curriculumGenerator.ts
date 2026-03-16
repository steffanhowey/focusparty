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
import {
  CURRICULUM_SYSTEM_PROMPT,
  CURRICULUM_SCHEMA,
} from "@/lib/learn/curriculumPrompt";
import { getSkills } from "@/lib/skills/taxonomy";

let _openai: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}


// ─── Core Generation ────────────────────────────────────────

/**
 * Generate a curriculum-based learning path from a query.
 * Searches content lake, then asks AI to design a task-driven curriculum.
 */
interface GenerateCurriculumResult {
  path: LearningPath;
  loadedSkills: Array<{ id: string; slug: string; name: string; domain_id: string }>;
}

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
): Promise<GenerateCurriculumResult> {
  // 1. Search content lake + load skills in parallel
  const [embedding, allSkills] = await Promise.all([
    generateEmbedding(query),
    getSkills().catch(() => []),
  ]);
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

      // Search with query variations (2 queries = 200 quota units vs 300)
      const queries = [
        `${query} tutorial`,
        `${query} explained`,
      ];
      const allVideoIds = new Set<string>();

      const searchResults = await Promise.allSettled(
        queries.map((q) =>
          searchVideos(q, {
            maxResults: 5,
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
          [...allVideoIds].slice(0, 10)
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
    JSON.stringify(itemSummaries),
    "",
    "Available AI tools:",
    JSON.stringify(availableTools),
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

  // 5. Build system prompt (with adaptation + safety + skill taxonomy)
  let systemPrompt = CURRICULUM_SYSTEM_PROMPT;

  // Inject available skill slugs for tagging (allSkills already loaded in parallel above)
  if (allSkills.length > 0) {
    const skillSlugList = allSkills
      .map((s) => `${s.slug} (${s.name})`)
      .join(", ");
    systemPrompt = systemPrompt.replace(
      "[SKILL_SLUGS_PLACEHOLDER]",
      skillSlugList,
    );
  } else {
    systemPrompt = systemPrompt.replace(
      "[SKILL_SLUGS_PLACEHOLDER]",
      "prompt-engineering, ai-code-generation, ai-assisted-writing, research-synthesis",
    );
  }

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
    return { path: postProcessCurriculum(raw, filtered, query), loadedSkills: allSkills };
  } catch (error) {
    console.error(
      "Curriculum generation failed, falling back to simple path:",
      error
    );
    return { path: fallbackCurriculum(query, filtered), loadedSkills: allSkills };
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
        clip_start_seconds: (task.clip_start_seconds as number) ?? null,
        clip_end_seconds: (task.clip_end_seconds as number) ?? null,
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

  // Extract skill tags from AI output
  const rawSkills = (raw.skills ?? []) as Array<{
    skill_slug: string;
    relevance: string;
  }>;
  const skill_tags = rawSkills
    .filter(
      (s) =>
        s.skill_slug &&
        (s.relevance === "primary" || s.relevance === "secondary"),
    )
    .map((s) => ({
      skill_slug: s.skill_slug,
      skill_name: "",  // Resolved later when writing to DB
      domain_name: "", // Resolved later when writing to DB
      relevance: s.relevance as "primary" | "secondary",
    }));

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
    skill_tags: skill_tags.length > 0 ? skill_tags : undefined,
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
      clip_start_seconds: null,
      clip_end_seconds: null,
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
  const { path: curriculum, loadedSkills } = await generateCurriculum(query, options);
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

  const pathId = data.id as string;

  // Write skill tags to fp_skill_tags (reuse pre-loaded skills, no extra DB call)
  if (curriculum.skill_tags && curriculum.skill_tags.length > 0 && loadedSkills.length > 0) {
    try {
      const skillMap = new Map(loadedSkills.map((s) => [s.slug, s]));
      const tagRows: Array<{
        path_id: string;
        skill_id: string;
        relevance: string;
      }> = [];

      for (const tag of curriculum.skill_tags) {
        const skill = skillMap.get(tag.skill_slug);
        if (skill) {
          tagRows.push({
            path_id: pathId,
            skill_id: skill.id,
            relevance: tag.relevance,
          });
          tag.skill_name = skill.name;
        }
      }

      if (tagRows.length > 0) {
        const { error: tagError } = await supabase
          .from("fp_skill_tags")
          .insert(tagRows);
        if (tagError) {
          console.error("[curriculum] Failed to write skill tags:", tagError);
        } else {
          console.log(
            `[curriculum] Tagged path "${curriculum.title}" with ${tagRows.length} skills`,
          );
        }
      }
    } catch (err) {
      console.error("[curriculum] Skill tagging failed:", err);
    }
  }

  return { ...curriculum, id: pathId, created_at: data.created_at };
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

  const results = await Promise.allSettled(
    videos.map(async (video) => {
      const score = await scoreForLearning({
        title: video.title,
        description: video.description,
        channelTitle: video.channelTitle,
        durationSeconds: video.durationSeconds,
        viewCount: video.viewCount,
      });

      if (score.rejected || score.quality_score < 40) return false;

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
      return true;
    })
  );

  const indexed = results.filter(
    (r) => r.status === "fulfilled" && r.value === true
  ).length;
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) {
    console.warn(`[curriculum] Background indexing: ${failed}/${videos.length} failed`);
  }
  console.log(
    `[curriculum] Background indexing complete for "${query}": ${indexed}/${videos.length} indexed`
  );
}
