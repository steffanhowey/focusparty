import { NextResponse, after } from "next/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { generateAndCachePath, mapPathRow } from "@/lib/learn/pathGenerator";
import type { LearningPath } from "@/lib/types";

// ─── In-memory generation tracking ──────────────────────────

interface GenerationState {
  status: "generating" | "complete" | "failed";
  query: string;
  path: LearningPath | null;
  error: string | null;
  created_at: number;
}

const generations = new Map<string, GenerationState>();
const queryToId = new Map<string, string>();

const TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Remove entries older than TTL */
function sweepStale(): void {
  const now = Date.now();
  for (const [id, state] of generations) {
    if (now - state.created_at > TTL_MS) {
      generations.delete(id);
      if (queryToId.get(state.query) === id) {
        queryToId.delete(state.query);
      }
    }
  }
}

// ─── POST: Start background generation ──────────────────────

/**
 * POST /api/learn/search/generate
 * Starts background path generation. Returns { generation_id } immediately.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const query = (body.query as string)?.trim();

    if (!query) {
      return NextResponse.json(
        { error: "query is required" },
        { status: 400 }
      );
    }

    sweepStale();

    const normalizedQuery = query.toLowerCase();

    // Dedup: if already generating for this query, return existing ID
    const existingId = queryToId.get(normalizedQuery);
    if (existingId && generations.get(existingId)?.status === "generating") {
      return NextResponse.json(
        { generation_id: existingId, query: normalizedQuery },
        { status: 202 }
      );
    }

    const id = crypto.randomUUID();
    const state: GenerationState = {
      status: "generating",
      query: normalizedQuery,
      path: null,
      error: null,
      created_at: Date.now(),
    };

    generations.set(id, state);
    queryToId.set(normalizedQuery, id);

    // Fire-and-forget promise handles generation.
    // after() keeps the Vercel serverless function alive so the promise can resolve.
    console.log(`[learn/search/generate] Starting generation for "${query}" (id: ${id})`);

    const generationPromise = generateAndCachePath(query)
      .then((path) => {
        const entry = generations.get(id);
        if (!entry) return;
        if (path) {
          console.log(`[learn/search/generate] Generation complete for "${query}" (id: ${id}), path: ${path.id}`);
          generations.set(id, { ...entry, status: "complete", path });
        } else {
          console.log(`[learn/search/generate] Generation returned null for "${query}" (id: ${id}) — not enough content`);
          generations.set(id, {
            ...entry,
            status: "failed",
            error: "Not enough content available for this topic yet.",
          });
        }
      })
      .catch((err) => {
        console.error(`[learn/search/generate] Generation failed for "${query}" (id: ${id}):`, err);
        const entry = generations.get(id);
        if (entry) {
          generations.set(id, { ...entry, status: "failed", error: String(err) });
        }
      })
      .finally(() => {
        queryToId.delete(normalizedQuery);
      });

    // after() keeps the serverless function alive until the promise settles.
    // In dev mode the Node process stays alive regardless, so this is a no-op.
    after(() => generationPromise);

    return NextResponse.json(
      { generation_id: id, query: normalizedQuery },
      { status: 202 }
    );
  } catch (error) {
    console.error("[learn/search/generate] POST error:", error);
    return NextResponse.json(
      { error: "Failed to start generation" },
      { status: 500 }
    );
  }
}

// ─── GET: Poll generation status ────────────────────────────

/**
 * GET /api/learn/search/generate?generation_id=...&query=...
 * Polls for generation status. Falls back to Supabase if in-memory miss.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const generationId = url.searchParams.get("generation_id");
  const query = url.searchParams.get("query")?.trim().toLowerCase();

  if (!generationId) {
    return NextResponse.json(
      { error: "generation_id is required" },
      { status: 400 }
    );
  }

  // 1. Check in-memory map
  const state = generations.get(generationId);
  console.log(`[learn/search/generate] Poll for ${generationId}: in-memory=${state?.status ?? "miss"}, map_size=${generations.size}`);
  if (state) {
    const response = {
      status: state.status,
      path: state.path,
      error: state.error,
    };

    // Clean up terminal states after returning
    if (state.status === "complete" || state.status === "failed") {
      generations.delete(generationId);
      if (queryToId.get(state.query) === generationId) {
        queryToId.delete(state.query);
      }
    }

    return NextResponse.json(response);
  }

  // 2. Fallback: check Supabase for recently-created path matching the query
  //    (handles serverless instance miss / cold start)
  if (query) {
    try {
      const admin = createAdminClient();
      const twoMinutesAgo = new Date(
        Date.now() - 2 * 60 * 1000
      ).toISOString();

      const { data: recentPaths } = await admin
        .from("fp_learning_paths")
        .select("*")
        .ilike("query", `%${query}%`)
        .gte("created_at", twoMinutesAgo)
        .order("created_at", { ascending: false })
        .limit(1);

      if (recentPaths?.length) {
        return NextResponse.json({
          status: "complete",
          path: mapPathRow(
            recentPaths[0] as unknown as Record<string, unknown>
          ),
          error: null,
        });
      }
    } catch {
      // Fallback failed — treat as still generating
    }
  }

  // 3. Unknown ID, no DB match — assume still generating
  return NextResponse.json({
    status: "generating",
    path: null,
    error: null,
  });
}
