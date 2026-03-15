import { NextResponse, after } from "next/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { generateAndCachePath, mapPathRow } from "@/lib/learn/pathGenerator";
import type { LearningPath } from "@/lib/types";
import type { ProfessionalFunction, FluencyLevel } from "@/lib/onboarding/types";
import { GeneratePathSchema, parseBody } from "@/lib/learn/validation";

// ─── In-memory dedup (per-instance optimization only) ──────
// Prevents duplicate generation starts on the same Lambda instance.
// NOT used for polling — Supabase is the source of truth.

const activeGenerations = new Set<string>();

// ─── POST: Start background generation ──────────────────────

/**
 * POST /api/learn/search/generate
 * Starts background path generation. Returns { generation_id } immediately.
 * Status is tracked in fp_generation_status (Supabase), not in-memory.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const raw = await request.json();
    const parsed = parseBody(GeneratePathSchema, raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error },
        { status: 400 }
      );
    }

    const { query } = parsed.data;
    const userFunction = (parsed.data.function ?? null) as ProfessionalFunction | null;
    const userFluency = (parsed.data.fluency ?? null) as FluencyLevel | null;
    const secondaryFunctions = parsed.data.secondary_functions as ProfessionalFunction[] | undefined;

    const normalizedQuery = query.toLowerCase();
    const dedupKey = userFunction && userFluency
      ? `${normalizedQuery}__${userFunction}__${userFluency}`
      : normalizedQuery;

    const admin = createAdminClient();

    // Dedup: check if there's already an active generation for this query+profile
    const { data: existing } = await admin
      .from("fp_generation_status")
      .select("id")
      .eq("query", normalizedQuery)
      .eq("status", "generating")
      .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .limit(1);

    if (existing?.length) {
      return NextResponse.json(
        { generation_id: existing[0].id, query: normalizedQuery },
        { status: 202 }
      );
    }

    // Same-instance dedup (prevents duplicate fire-and-forget on rapid retries)
    if (activeGenerations.has(dedupKey)) {
      const { data: inFlight } = await admin
        .from("fp_generation_status")
        .select("id")
        .eq("query", normalizedQuery)
        .eq("status", "generating")
        .order("created_at", { ascending: false })
        .limit(1);

      if (inFlight?.length) {
        return NextResponse.json(
          { generation_id: inFlight[0].id, query: normalizedQuery },
          { status: 202 }
        );
      }
    }

    // Create generation status row
    const { data: genRow, error: insertErr } = await admin
      .from("fp_generation_status")
      .insert({
        query: normalizedQuery,
        adapted_for_function: userFunction,
        adapted_for_fluency: userFluency,
        status: "generating",
      })
      .select("id")
      .single();

    if (insertErr || !genRow) {
      console.error("[learn/search/generate] Failed to create generation status:", insertErr);
      return NextResponse.json(
        { error: "Failed to start generation" },
        { status: 500 }
      );
    }

    const generationId = genRow.id as string;
    activeGenerations.add(dedupKey);

    const adaptationLabel = userFunction && userFluency ? ` [${userFunction}/${userFluency}]` : "";
    console.log(`[learn/search/generate] Starting generation for "${query}"${adaptationLabel} (id: ${generationId})`);

    // Fire-and-forget generation
    const generationPromise = generateAndCachePath(query, {
      userFunction: userFunction ?? undefined,
      userFluency: userFluency ?? undefined,
      secondaryFunctions,
    })
      .then(async (path: LearningPath | null) => {
        if (path) {
          console.log(`[learn/search/generate] Complete for "${query}" (id: ${generationId}), path: ${path.id}`);
          await admin
            .from("fp_generation_status")
            .update({ status: "complete", path_id: path.id })
            .eq("id", generationId);
        } else {
          console.log(`[learn/search/generate] Null result for "${query}" (id: ${generationId})`);
          await admin
            .from("fp_generation_status")
            .update({
              status: "failed",
              error: "Not enough content available for this topic yet.",
            })
            .eq("id", generationId);
        }
      })
      .catch(async (err: unknown) => {
        console.error(`[learn/search/generate] Failed for "${query}" (id: ${generationId}):`, err);
        await admin
          .from("fp_generation_status")
          .update({ status: "failed", error: String(err) })
          .eq("id", generationId);
      })
      .finally(() => {
        activeGenerations.delete(dedupKey);
      });

    // after() keeps the serverless function alive until the promise settles
    after(() => generationPromise);

    return NextResponse.json(
      { generation_id: generationId, query: normalizedQuery },
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
 * GET /api/learn/search/generate?generation_id=...
 * Polls for generation status from Supabase.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const generationId = url.searchParams.get("generation_id");

  if (!generationId) {
    return NextResponse.json(
      { error: "generation_id is required" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Look up generation status
  const { data: genStatus, error } = await admin
    .from("fp_generation_status")
    .select("status, path_id, error, query")
    .eq("id", generationId)
    .single();

  if (error || !genStatus) {
    return NextResponse.json({
      status: "failed",
      path: null,
      error: "Generation not found. It may have expired.",
    });
  }

  const row = genStatus as {
    status: string;
    path_id: string | null;
    error: string | null;
    query: string;
  };

  // Still generating
  if (row.status === "generating") {
    return NextResponse.json({
      status: "generating",
      path: null,
      error: null,
    });
  }

  // Failed
  if (row.status === "failed") {
    return NextResponse.json({
      status: "failed",
      path: null,
      error: row.error,
    });
  }

  // Complete — fetch the path
  if (row.path_id) {
    const { data: pathRow } = await admin
      .from("fp_learning_paths")
      .select("*")
      .eq("id", row.path_id)
      .single();

    if (pathRow) {
      return NextResponse.json({
        status: "complete",
        path: mapPathRow(pathRow as unknown as Record<string, unknown>),
        error: null,
      });
    }
  }

  // Path ID set but path not found
  return NextResponse.json({
    status: "failed",
    path: null,
    error: "Generated path not found.",
  });
}
