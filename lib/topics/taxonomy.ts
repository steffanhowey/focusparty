// ─── Topic Taxonomy Service ─────────────────────────────────
// Manages the canonical topic taxonomy with in-memory caching,
// slug/alias matching, and prompt formatting for AI evaluation.

import { createClient } from "@/lib/supabase/admin";

// ─── Types ──────────────────────────────────────────────────

export interface Topic {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  category: "tool" | "technique" | "concept" | "role" | "platform";
  description: string | null;
  aliases: string[];
  status: "active" | "deprecated" | "pending";
}

export interface TopicTreeNode extends Topic {
  children: TopicTreeNode[];
}

// ─── In-memory cache ────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cachedTopics: Topic[] | null = null;
let slugMap: Map<string, Topic> = new Map();
let aliasMap: Map<string, Topic> = new Map();
let cacheTime = 0;

function isCacheStale(): boolean {
  return !cachedTopics || Date.now() - cacheTime > CACHE_TTL_MS;
}

function buildLookups(topics: Topic[]): void {
  slugMap = new Map();
  aliasMap = new Map();
  for (const topic of topics) {
    slugMap.set(topic.slug, topic);
    for (const alias of topic.aliases) {
      aliasMap.set(alias.toLowerCase(), topic);
    }
  }
}

/** Invalidate the in-memory taxonomy cache. Call after writes. */
export function invalidateCache(): void {
  cachedTopics = null;
  slugMap.clear();
  aliasMap.clear();
  cacheTime = 0;
}

// ─── Core functions ─────────────────────────────────────────

/**
 * Get all active topics, optionally filtered by category.
 * Results are cached in-memory with a 5-minute TTL.
 */
export async function getTopics(
  category?: string
): Promise<Topic[]> {
  if (isCacheStale()) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("fp_topic_taxonomy")
      .select("*")
      .eq("status", "active")
      .order("slug");

    if (error) {
      console.error("[topics/taxonomy] failed to load taxonomy:", error);
      // Return stale cache if available, otherwise empty
      return cachedTopics ?? [];
    }

    cachedTopics = (data ?? []).map(mapRow);
    buildLookups(cachedTopics);
    cacheTime = Date.now();
  }

  if (category) {
    return cachedTopics!.filter((t) => t.category === category);
  }
  return cachedTopics!;
}

/**
 * Find a single topic by its slug.
 */
export async function getTopicBySlug(
  slug: string
): Promise<Topic | null> {
  await getTopics(); // ensure cache is warm
  return slugMap.get(slug.toLowerCase()) ?? null;
}

/**
 * Find a topic matching a freeform string.
 * Tries: exact slug → alias match → fuzzy name match (Levenshtein < 3 or substring).
 * Returns null if no match.
 */
export async function findTopicMatch(
  freeformTag: string
): Promise<Topic | null> {
  await getTopics(); // ensure cache is warm
  const normalized = freeformTag.toLowerCase().trim().replace(/\s+/g, "-");

  // 1. Exact slug match
  const slugHit = slugMap.get(normalized);
  if (slugHit) return slugHit;

  // 2. Alias match
  const aliasHit = aliasMap.get(normalized);
  if (aliasHit) return aliasHit;

  // 3. Fuzzy match: substring of name or Levenshtein distance < 3
  for (const topic of cachedTopics ?? []) {
    const topicNameNorm = topic.name.toLowerCase().replace(/\s+/g, "-");
    // Substring: input is contained in slug/name or vice versa
    if (topic.slug.includes(normalized) || normalized.includes(topic.slug)) {
      return topic;
    }
    if (topicNameNorm.includes(normalized) || normalized.includes(topicNameNorm)) {
      return topic;
    }
    // Levenshtein distance
    if (levenshtein(normalized, topic.slug) < 3) {
      return topic;
    }
  }

  return null;
}

/**
 * Bulk match an array of freeform tags to canonical topics.
 * For each tag, tries: exact slug → alias → fuzzy name match.
 */
export async function bulkMatchTopics(
  tags: string[]
): Promise<{ tag: string; topic: Topic | null }[]> {
  await getTopics(); // ensure cache is warm
  const results: { tag: string; topic: Topic | null }[] = [];
  for (const tag of tags) {
    const topic = await findTopicMatch(tag);
    results.push({ tag, topic });
  }
  return results;
}

/**
 * Add a new topic to the taxonomy. Invalidates cache on success.
 */
export async function createTopic(input: {
  slug: string;
  name: string;
  category: string;
  description?: string;
  aliases?: string[];
  parentId?: string;
  status?: string;
}): Promise<Topic> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("fp_topic_taxonomy")
    .insert({
      slug: input.slug.toLowerCase().trim().replace(/\s+/g, "-"),
      name: input.name,
      category: input.category,
      description: input.description ?? null,
      aliases: input.aliases ?? [],
      parent_id: input.parentId ?? null,
      status: input.status ?? "active",
    })
    .select()
    .single();

  if (error) {
    throw new Error(`[topics/taxonomy] create failed: ${error.message}`);
  }

  invalidateCache();
  return mapRow(data);
}

/**
 * Get topics organized as a tree (parent → children).
 * If parentId is provided, returns children of that topic.
 * If omitted, returns top-level topics with nested children.
 */
export async function getTopicTree(
  parentId?: string
): Promise<TopicTreeNode[]> {
  const topics = await getTopics();
  const byParent = new Map<string | null, Topic[]>();

  for (const topic of topics) {
    const key = topic.parentId ?? "__root__";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(topic);
  }

  function buildTree(pid: string | null): TopicTreeNode[] {
    const key = pid ?? "__root__";
    const children = byParent.get(key) ?? [];
    return children.map((topic) => ({
      ...topic,
      children: buildTree(topic.id),
    }));
  }

  if (parentId) {
    return buildTree(parentId);
  }
  return buildTree(null);
}

// ─── Prompt formatting ──────────────────────────────────────

/**
 * Format the taxonomy as a compact string for injection into AI prompts.
 * Groups topics by category, one line per category.
 * ~80 topics ≈ 300 tokens.
 */
export function formatTaxonomyForPrompt(topics: Topic[]): string {
  const byCategory = new Map<string, string[]>();
  for (const topic of topics) {
    if (!byCategory.has(topic.category)) byCategory.set(topic.category, []);
    byCategory.get(topic.category)!.push(topic.slug);
  }

  const order = ["tool", "technique", "concept", "role", "platform"];
  const labels: Record<string, string> = {
    tool: "Tools",
    technique: "Techniques",
    concept: "Concepts",
    role: "Roles",
    platform: "Platforms",
  };

  return order
    .filter((cat) => byCategory.has(cat))
    .map((cat) => `${labels[cat]}: ${byCategory.get(cat)!.join(", ")}`)
    .join("\n");
}

// ─── Helpers ────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): Topic {
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    parentId: (row.parent_id as string) ?? null,
    category: row.category as Topic["category"],
    description: (row.description as string) ?? null,
    aliases: (row.aliases as string[]) ?? [],
    status: row.status as Topic["status"],
  };
}

/** Levenshtein distance between two strings. */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}
