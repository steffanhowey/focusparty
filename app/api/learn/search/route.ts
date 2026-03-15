import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { mapPathRow, mapProgressRow } from "@/lib/learn/pathGenerator";
import type { LearningPath, LearningProgress } from "@/lib/types";

/**
 * GET /api/learn/search?q=...&limit=12
 *
 * Returns learning paths from cache only — never generates.
 * - No query: returns pre-generated discovery paths + user's in-progress paths
 * - With query: returns cached matching paths + should_generate flag
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim();
  const limit = Math.min(
    Number(url.searchParams.get("limit") ?? 12),
    20
  );

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

  // ─── No query: discovery mode ─────────────────────────────
  if (!query) {
    const { data: discoveryRows } = await admin
      .from("fp_learning_paths")
      .select("*")
      .eq("is_cached", true)
      .order("view_count", { ascending: false })
      .limit(limit);

    const discovery = (discoveryRows ?? []).map((r) =>
      mapPathRow(r as unknown as Record<string, unknown>)
    );

    return NextResponse.json({
      discovery,
      in_progress: inProgress,
      query: null,
      should_generate: false,
    });
  }

  // ─── With query: cache lookup only ────────────────────────
  try {
    const normalizedQuery = query.toLowerCase();
    const { data: cachedRows } = await admin
      .from("fp_learning_paths")
      .select("*")
      .eq("is_cached", true)
      .ilike("query", `%${normalizedQuery}%`)
      .order("view_count", { ascending: false })
      .limit(limit);

    const results = (cachedRows ?? []).map((r) =>
      mapPathRow(r as unknown as Record<string, unknown>)
    );

    if (results.length === 0) {
      return NextResponse.json({
        discovery: [],
        in_progress: inProgress,
        query,
        should_generate: true,
        message:
          "No cached paths yet — generating one for you.",
      });
    }

    return NextResponse.json({
      discovery: results,
      in_progress: inProgress,
      query,
      should_generate: results.length < 3,
    });
  } catch (error) {
    console.error("[learn/search] error:", error);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
