import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import {
  generateAndCachePath,
  mapPathRow,
  mapProgressRow,
} from "@/lib/learn/pathGenerator";
import type { LearningPath, LearningProgress } from "@/lib/types";
import { CreatePathSchema, parseBody } from "@/lib/learn/validation";
import { logger } from "@/lib/logger";

const log = logger("learn/paths");

/**
 * POST /api/learn/paths
 * Generate a learning path from a search query.
 * Body: { query: string }
 */
export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const parsed = parseBody(CreatePathSchema, raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error },
      { status: 400 }
    );
  }

  const { query } = parsed.data;

  try {
    const path = await generateAndCachePath(query);

    if (!path) {
      return NextResponse.json(
        {
          error:
            "Not enough content on this topic yet. Try a broader search.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ path, cached: path.id !== "temp" });
  } catch (error) {
    log.error("generation failed", error, { query });
    return NextResponse.json(
      { error: "Failed to generate learning path" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/learn/paths
 * Get current user's learning paths (in progress and completed).
 */
export async function GET(): Promise<NextResponse> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ in_progress: [], completed: [] });
  }

  const admin = createAdminClient();

  const { data: progressRows } = await admin
    .from("fp_learning_progress")
    .select("*, fp_learning_paths(*)")
    .eq("user_id", user.id)
    .order("last_activity_at", { ascending: false });

  const rows = progressRows ?? [];

  const inProgress: { path: LearningPath; progress: LearningProgress }[] =
    [];
  const completed: { path: LearningPath; progress: LearningProgress }[] =
    [];

  for (const row of rows) {
    const pathData = row.fp_learning_paths;
    if (!pathData) continue;

    const path = mapPathRow(
      pathData as unknown as Record<string, unknown>
    );
    const progress = mapProgressRow(
      row as unknown as Record<string, unknown>
    );

    if (progress.status === "completed") {
      completed.push({ path, progress });
    } else {
      inProgress.push({ path, progress });
    }
  }

  // ── Populate skill tags ──────────────────────────────────────
  const allPaths = [...inProgress, ...completed].map((item) => item.path);
  if (allPaths.length > 0) {
    const { loadSkillTagsForPaths } = await import(
      "@/lib/skills/pathSkillTags"
    );
    const tagMap = await loadSkillTagsForPaths(allPaths.map((p) => p.id));
    for (const p of allPaths) {
      p.skill_tags = tagMap.get(p.id) ?? [];
    }
  }

  return NextResponse.json({ in_progress: inProgress, completed });
}
