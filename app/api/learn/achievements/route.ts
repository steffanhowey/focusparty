import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { generateAchievementShareSlug } from "@/lib/achievements/achievementModel";

/**
 * POST /api/learn/achievements
 * Create an achievement when a learning path is completed.
 * Body: { path_id, progress_id? }
 */
export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { path_id?: string; progress_id?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  if (!body.path_id) {
    return NextResponse.json(
      { error: "path_id is required" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Check if achievement already exists
  const { data: existing } = await admin
    .from("fp_achievements")
    .select("id, share_slug")
    .eq("user_id", user.id)
    .eq("path_id", body.path_id)
    .single();

  if (existing) {
    return NextResponse.json({ achievement: existing, cached: true });
  }

  // Fetch path data
  const { data: pathRow } = await admin
    .from("fp_learning_paths")
    .select("title, topics, difficulty_level, items")
    .eq("id", body.path_id)
    .single();

  if (!pathRow) {
    return NextResponse.json(
      { error: "Learning path not found" },
      { status: 404 }
    );
  }

  // Fetch progress data
  const { data: progressRow } = await admin
    .from("fp_learning_progress")
    .select("id, items_completed, time_invested_seconds, completed_at")
    .eq("user_id", user.id)
    .eq("path_id", body.path_id)
    .single();

  // Get user display name
  const { data: profile } = await admin
    .from("fp_profiles")
    .select("display_name, first_name")
    .eq("id", user.id)
    .single();

  const items = (pathRow.items as unknown[]) ?? [];
  const profileRow = (profile as Record<string, unknown> | null) ?? null;
  const shareSlug = generateAchievementShareSlug(
    (profileRow?.display_name as string | null) ??
      (profileRow?.first_name as string | null) ??
      null,
    (pathRow.topics as string[]) ?? []
  );

  const { data: achievement, error: insertErr } = await admin
    .from("fp_achievements")
    .insert({
      user_id: user.id,
      path_id: body.path_id,
      progress_id: progressRow?.id ?? body.progress_id ?? null,
      path_title: pathRow.title,
      path_topics: pathRow.topics ?? [],
      items_completed: progressRow?.items_completed ?? items.length,
      time_invested_seconds: progressRow?.time_invested_seconds ?? 0,
      difficulty_level: pathRow.difficulty_level ?? "intermediate",
      completed_at: progressRow?.completed_at ?? new Date().toISOString(),
      share_slug: shareSlug,
    })
    .select("*")
    .single();

  if (insertErr) {
    console.error("[learn/achievements] insert error:", insertErr);
    return NextResponse.json(
      { error: "Failed to create achievement" },
      { status: 500 }
    );
  }

  return NextResponse.json({ achievement });
}

/**
 * GET /api/learn/achievements
 * Get current user's achievements.
 */
export async function GET(): Promise<NextResponse> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ achievements: [] });
  }

  const admin = createAdminClient();

  const { data: achievements } = await admin
    .from("fp_achievements")
    .select("*")
    .eq("user_id", user.id)
    .order("completed_at", { ascending: false });

  return NextResponse.json({ achievements: achievements ?? [] });
}
