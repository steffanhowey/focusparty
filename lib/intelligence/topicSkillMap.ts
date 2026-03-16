/**
 * Topic-to-skill mapping cache.
 *
 * Loads fp_topic_skill_map and provides lookup functions.
 * Follows the same in-memory cache pattern as lib/skills/taxonomy.ts.
 */

import { createClient } from "@/lib/supabase/admin";
import type { TopicSkillMapping } from "@/lib/types/intelligence";

let _mappings: TopicSkillMapping[] | null = null;
let _cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function isCacheFresh(): boolean {
  return Date.now() - _cacheTime < CACHE_TTL;
}

/** Load all topic-skill mappings, cached. */
export async function getTopicSkillMap(): Promise<TopicSkillMapping[]> {
  if (_mappings && isCacheFresh()) return _mappings;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("fp_topic_skill_map")
    .select("topic_slug, skill_slug, strength, relationship");

  if (error) {
    console.error("[intelligence/topicSkillMap] Load error:", error);
    return _mappings ?? [];
  }

  _mappings = (data ?? []) as TopicSkillMapping[];
  _cacheTime = Date.now();
  return _mappings;
}

/** Get all skills mapped to a specific topic. */
export async function getSkillsForTopic(
  topicSlug: string
): Promise<TopicSkillMapping[]> {
  const mappings = await getTopicSkillMap();
  return mappings.filter((m) => m.topic_slug === topicSlug);
}

/** Get all topics mapped to a specific skill. */
export async function getTopicsForSkill(
  skillSlug: string
): Promise<TopicSkillMapping[]> {
  const mappings = await getTopicSkillMap();
  return mappings.filter((m) => m.skill_slug === skillSlug);
}

/** Invalidate the cache (call after seed data changes). */
export function invalidateTopicSkillMapCache(): void {
  _mappings = null;
  _cacheTime = 0;
}
