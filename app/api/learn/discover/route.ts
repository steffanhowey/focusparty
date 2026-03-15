import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { generateAndCachePath } from "@/lib/learn/pathGenerator";
import { startPipelineEvent } from "@/lib/pipeline/logger";

// Seed queries matching POPULAR_TOPICS from LearnPage
const SEED_QUERIES = [
  "prompt engineering",
  "rag",
  "ai agents",
  "fine tuning",
  "nextjs",
  "react",
  "vector databases",
  "langchain",
  "cursor",
  "supabase",
  "openai api",
  "system design",
];

const MAX_GENERATIONS_PER_RUN = 5;
const CACHE_TTL_HOURS = 48;

/**
 * GET /api/learn/discover
 * Cron: pre-generate discovery learning paths for popular topics.
 */
export async function GET(): Promise<NextResponse> {
  const event = await startPipelineEvent(
    "path_discovery",
    "Learning Path Discovery"
  );

  try {
    const admin = createAdminClient();

    // Combine seed queries with top topics from content lake
    const queries = [...SEED_QUERIES];

    const { data: topTopics } = await admin
      .from("fp_content_lake")
      .select("topics")
      .not("topics", "is", null)
      .limit(100);

    if (topTopics?.length) {
      const topicFreq = new Map<string, number>();
      for (const row of topTopics) {
        const topics = row.topics as string[] | null;
        if (!topics) continue;
        for (const t of topics) {
          topicFreq.set(t, (topicFreq.get(t) ?? 0) + 1);
        }
      }
      // Add top topics not already in seed queries
      const sorted = [...topicFreq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      for (const [topic] of sorted) {
        const normalized = topic.toLowerCase().trim();
        if (!queries.some((q) => q === normalized)) {
          queries.push(normalized);
        }
      }
    }

    const cutoff = new Date(
      Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000
    ).toISOString();

    let generated = 0;
    let skipped = 0;
    const errors: Array<{ query: string; message: string }> = [];

    for (const query of queries) {
      if (generated >= MAX_GENERATIONS_PER_RUN) break;

      // Check if cached path exists and is fresh
      const { data: existing } = await admin
        .from("fp_learning_paths")
        .select("id, created_at")
        .eq("query", query.toLowerCase())
        .eq("is_cached", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (existing && existing.created_at > cutoff) {
        skipped++;
        continue;
      }

      try {
        const path = await generateAndCachePath(query);
        if (path) {
          generated++;
        } else {
          skipped++;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ query, message });
        console.error(`[learn/discover] Failed for "${query}":`, message);
      }
    }

    await event.complete({
      itemsProcessed: generated + skipped + errors.length,
      itemsSucceeded: generated,
      itemsFailed: errors.length,
      summary: { generated, skipped, errors: errors.length },
      errors: errors.map((e) => ({
        message: `${e.query}: ${e.message}`,
      })),
    });

    return NextResponse.json({ generated, skipped, errors: errors.length });
  } catch (error) {
    await event.fail(error);
    console.error("[learn/discover] error:", error);
    return NextResponse.json(
      { error: "Discovery failed" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/learn/discover
 * Manual trigger: accepts optional { queries: string[] } for admin seeding.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: { queries?: string[] } = {};
  try {
    body = await request.json();
  } catch {
    // Use default seed queries
  }

  const queries = body.queries?.length ? body.queries : SEED_QUERIES;
  const results: { query: string; success: boolean; pathId?: string }[] = [];

  for (const query of queries.slice(0, MAX_GENERATIONS_PER_RUN)) {
    try {
      const path = await generateAndCachePath(query);
      results.push({
        query,
        success: !!path,
        pathId: path?.id,
      });
    } catch (err) {
      console.error(`[learn/discover] POST failed for "${query}":`, err);
      results.push({ query, success: false });
    }
  }

  return NextResponse.json({ results });
}
