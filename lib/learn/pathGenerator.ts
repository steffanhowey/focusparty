// ─── Learning Path Generator ─────────────────────────────────
// Shared helpers (mapPathRow, mapProgressRow) and the generateAndCachePath
// entry point. The actual curriculum design is in curriculumGenerator.ts.

import type {
  LearningPath,
  LearningProgress,
  CurriculumModule,
} from "@/lib/types";
import { generateAndCacheCurriculum } from "@/lib/learn/curriculumGenerator";

// ─── Shared Helpers ──────────────────────────────────────────

/** Map a raw Supabase row to a LearningPath object. */
export function mapPathRow(row: Record<string, unknown>): LearningPath {
  const items = ((row.items as LearningPath["items"]) ?? []).map((item, idx) => ({
    ...item,
    item_id: item.item_id ?? item.content_id ?? `item-${idx}`,
    task_type: item.task_type ?? ("watch" as const),
    module_index: item.module_index ?? 0,
    mission: item.mission ?? null,
    check: item.check ?? null,
    reflection: item.reflection ?? null,
    content_id: item.content_id ?? null,
    content_type: item.content_type ?? null,
    creator_name: item.creator_name ?? null,
    source_url: item.source_url ?? null,
    thumbnail_url: item.thumbnail_url ?? null,
    quality_score: item.quality_score ?? null,
  }));

  return {
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string) ?? "",
    goal: (row.goal as string) ?? undefined,
    query: row.query as string,
    topics: (row.topics as string[]) ?? [],
    primary_tools: (row.primary_tools as string[]) ?? undefined,
    difficulty_level:
      (row.difficulty_level as LearningPath["difficulty_level"]) ??
      "intermediate",
    estimated_duration_seconds:
      (row.estimated_duration_seconds as number) ?? 0,
    items,
    modules: (row.modules as CurriculumModule[]) ?? undefined,
    source: (row.source as LearningPath["source"]) ?? undefined,
    view_count: (row.view_count as number) ?? 0,
    start_count: (row.start_count as number) ?? 0,
    completion_count: (row.completion_count as number) ?? 0,
    created_at: (row.created_at as string) ?? new Date().toISOString(),
  };
}

/** Map a raw Supabase row to a LearningProgress object. */
export function mapProgressRow(
  row: Record<string, unknown>
): LearningProgress {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    path_id: row.path_id as string,
    started_at: row.started_at as string,
    last_activity_at: row.last_activity_at as string,
    completed_at: (row.completed_at as string) ?? null,
    current_item_index: (row.current_item_index as number) ?? 0,
    items_completed: (row.items_completed as number) ?? 0,
    items_total: (row.items_total as number) ?? 0,
    time_invested_seconds: (row.time_invested_seconds as number) ?? 0,
    item_states:
      (row.item_states as LearningProgress["item_states"]) ?? {},
    status:
      (row.status as LearningProgress["status"]) ?? "in_progress",
  };
}

// ─── Generate & Cache ────────────────────────────────────────

/**
 * Generate a learning path for a query, using cache when available.
 * Delegates to the curriculum generator for new paths.
 * Returns null if not enough content exists.
 */
export async function generateAndCachePath(
  query: string
): Promise<LearningPath | null> {
  try {
    return await generateAndCacheCurriculum(query);
  } catch (error) {
    console.error("[learn/pathGenerator] generation failed:", error);
    return null;
  }
}
