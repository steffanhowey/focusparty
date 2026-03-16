import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { mapPathRow, mapProgressRow } from "@/lib/learn/pathGenerator";
import type { LearningPath, LearningProgress } from "@/lib/types";
import { SearchQuerySchema, parseSearchParams } from "@/lib/learn/validation";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

/**
 * Generate 3-4 related search queries to broaden thin results.
 * Returns alternate queries the user might be looking for.
 */
async function expandQuery(original: string): Promise<string[]> {
  try {
    const res = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 150,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "related_queries",
          strict: true,
          schema: {
            type: "object",
            properties: {
              queries: {
                type: "array",
                items: { type: "string" },
                description:
                  "3-4 related but slightly different search queries for AI learning paths",
              },
            },
            required: ["queries"],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: "system",
          content:
            "You generate related search queries for an AI learning platform. Given a user's search, produce 3-4 alternative queries that are related but broaden the search — e.g. adjacent topics, simpler/broader phrasings, or complementary skills. Keep each query 2-5 words. Return JSON only.",
        },
        {
          role: "user",
          content: `Original search: "${original}"`,
        },
      ],
    });

    const parsed = JSON.parse(res.choices[0]?.message?.content ?? "{}");
    return (parsed.queries ?? []).slice(0, 4) as string[];
  } catch (e) {
    console.error("[learn/search] query expansion failed:", e);
    return [];
  }
}

/**
 * GET /api/learn/search?q=...&limit=12&function=...&fluency=...
 *
 * Returns learning paths from cache only — never generates.
 * - No query: returns pre-generated discovery paths + user's in-progress paths
 * - With query: returns cached matching paths + should_generate flag
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const parsed = parseSearchParams(SearchQuerySchema, url.searchParams);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { q: query, limit } = parsed.data;
  const fn = parsed.data.function ?? null;
  const fluency = parsed.data.fluency ?? null;

  const admin = createAdminClient();

  // ─── Fetch user's in-progress paths (if authenticated) ────
  let inProgress: { path: LearningPath; progress: LearningProgress }[] =
    [];
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: progressRows } = await admin
        .from("fp_learning_progress")
        .select("*, fp_learning_paths(*)")
        .eq("user_id", user.id)
        .eq("status", "in_progress")
        .order("last_activity_at", { ascending: false })
        .limit(4);

      for (const row of progressRows ?? []) {
        const pathData = row.fp_learning_paths;
        if (!pathData) continue;
        inProgress.push({
          path: mapPathRow(
            pathData as unknown as Record<string, unknown>
          ),
          progress: mapProgressRow(
            row as unknown as Record<string, unknown>
          ),
        });
      }
    }
  } catch {
    // Auth check failed — continue without in-progress
  }

  // ─── No query: discovery mode (personalized) ───────────────
  if (!query) {
    // Prefer paths adapted for the user's function/fluency, fall back to all
    let discoveryQuery = admin
      .from("fp_learning_paths")
      .select("*")
      .eq("is_cached", true);

    if (fn) {
      discoveryQuery = discoveryQuery.eq("adapted_for_function", fn);
    }

    const { data: discoveryRows } = await discoveryQuery
      .order("view_count", { ascending: false })
      .limit(limit);

    let discovery = (discoveryRows ?? []).map((r) =>
      mapPathRow(r as unknown as Record<string, unknown>)
    );

    // If personalized results are thin, backfill with general paths
    if (discovery.length < limit && fn) {
      const existingIds = new Set(discovery.map((p) => p.id));
      const { data: generalRows } = await admin
        .from("fp_learning_paths")
        .select("*")
        .eq("is_cached", true)
        .order("view_count", { ascending: false })
        .limit(limit);

      const general = (generalRows ?? [])
        .map((r) => mapPathRow(r as unknown as Record<string, unknown>))
        .filter((p) => !existingIds.has(p.id));
      discovery = [...discovery, ...general].slice(0, limit);
    }

    return NextResponse.json({
      discovery,
      in_progress: inProgress,
      query: null,
      should_generate: false,
    });
  }

  // ─── With query: full-text search via tsvector ────────────
  const MAX_DROPDOWN = 5;

  // Stop words to skip in keyword fallback
  const STOP_WORDS = new Set([
    "a","an","and","are","as","at","be","by","for","from","has","he",
    "in","is","it","its","of","on","or","that","the","to","was","were",
    "will","with","how","what","when","where","who","why","can","do",
    "does","using","use","used","about","into","through","my","your",
  ]);

  try {
    // Helper: websearch (AND logic) — all terms must match
    async function searchExact(
      q: string,
      filterFnFluency: boolean,
      cap: number = MAX_DROPDOWN,
    ): Promise<LearningPath[]> {
      let qb = admin
        .from("fp_learning_paths")
        .select("*")
        .eq("is_cached", true)
        .textSearch("search_text", q, { type: "websearch" });

      if (filterFnFluency && fn && fluency) {
        qb = qb
          .eq("adapted_for_function", fn)
          .eq("adapted_for_fluency", fluency);
      }

      const { data } = await qb
        .order("view_count", { ascending: false })
        .limit(cap);

      return (data ?? []).map((r) =>
        mapPathRow(r as unknown as Record<string, unknown>)
      );
    }

    // Helper: search a single keyword (broad OR-style backfill)
    async function searchKeyword(word: string): Promise<LearningPath[]> {
      const { data } = await admin
        .from("fp_learning_paths")
        .select("*")
        .eq("is_cached", true)
        .textSearch("search_text", word, { type: "plain" })
        .order("view_count", { ascending: false })
        .limit(MAX_DROPDOWN);

      return (data ?? []).map((r) =>
        mapPathRow(r as unknown as Record<string, unknown>)
      );
    }

    // Dedupe helper
    const seenIds = new Set<string>();
    const results: LearningPath[] = [];

    function addResults(paths: LearningPath[]): void {
      for (const p of paths) {
        if (results.length >= MAX_DROPDOWN) return;
        if (!seenIds.has(p.id)) {
          seenIds.add(p.id);
          results.push(p);
        }
      }
    }

    // ── Tier 1: Exact websearch (AND) with function/fluency filter ──
    addResults(await searchExact(query, true));

    // Drop filter if no adapted matches
    if (results.length === 0 && fn && fluency) {
      addResults(await searchExact(query, false));
    }

    // ── Tier 2: AI expansion — related queries via websearch ──
    if (results.length < MAX_DROPDOWN) {
      const expandedQueries = await expandQuery(query);

      const expansionBatches = await Promise.all(
        expandedQueries.map((eq) => searchExact(eq, false))
      );
      for (const batch of expansionBatches) {
        addResults(batch);
        if (results.length >= MAX_DROPDOWN) break;
      }
    }

    // ── Tier 3: Individual keyword fallback (OR-style) ──
    if (results.length < MAX_DROPDOWN) {
      const keywords = query
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

      const keywordBatches = await Promise.all(
        keywords.map((kw) => searchKeyword(kw))
      );
      for (const batch of keywordBatches) {
        addResults(batch);
        if (results.length >= MAX_DROPDOWN) break;
      }
    }

    // ── Tier 4: Popular backfill — always show a full dropdown ──
    if (results.length < MAX_DROPDOWN) {
      const { data: popularRows } = await admin
        .from("fp_learning_paths")
        .select("*")
        .eq("is_cached", true)
        .order("view_count", { ascending: false })
        .limit(MAX_DROPDOWN);

      const popular = (popularRows ?? []).map((r) =>
        mapPathRow(r as unknown as Record<string, unknown>)
      );
      addResults(popular);
    }

    return NextResponse.json({
      discovery: results,
      in_progress: inProgress,
      query,
      should_generate: true, // Always offer Build Path
    });
  } catch (error) {
    console.error("[learn/search] error:", error);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
