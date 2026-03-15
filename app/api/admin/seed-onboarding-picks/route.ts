import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import { generateAndCacheCurriculum } from "@/lib/learn/curriculumGenerator";
import { SEED_PICKS, type SeedPick } from "@/lib/onboarding/seedPicks";
import type { ProfessionalFunction, FluencyLevel } from "@/lib/onboarding/types";

/**
 * POST /api/admin/seed-onboarding-picks
 *
 * Generates adapted learning paths for each editorial pick and inserts
 * both the paths (fp_learning_paths) and pick metadata (fp_onboarding_picks).
 *
 * Body:
 *   functions?: string[]  — limit to specific functions (default: all 7)
 *   fluencies?: string[]  — limit to specific levels (default: all 4)
 *   dryRun?: boolean      — if true, list what would be generated without doing it
 *
 * Protected by ADMIN_SECRET header.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get("x-admin-secret");
  if (authHeader !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const targetFunctions: string[] | undefined = body.functions;
  const targetFluencies: string[] | undefined = body.fluencies;
  const dryRun: boolean = body.dryRun ?? false;

  // Filter picks by requested functions/fluencies
  const picks = SEED_PICKS.filter((p) => {
    if (targetFunctions && !targetFunctions.includes(p.function)) return false;
    if (targetFluencies && !targetFluencies.includes(p.fluency_level))
      return false;
    return true;
  });

  if (dryRun) {
    return NextResponse.json({
      dry_run: true,
      picks_to_generate: picks.length,
      picks: picks.map((p) => ({
        function: p.function,
        fluency_level: p.fluency_level,
        topic: p.path_topic,
        title: p.display_title,
      })),
    });
  }

  const supabase = createAdminClient();

  // Check which picks already exist to avoid re-generating
  const { data: existingPicks } = await supabase
    .from("fp_onboarding_picks")
    .select("function, fluency_level, sort_order");

  const existingKeys = new Set(
    (existingPicks ?? []).map(
      (p: { function: string; fluency_level: string; sort_order: number }) =>
        `${p.function}__${p.fluency_level}__${p.sort_order}`
    )
  );

  const results: Array<{
    function: string;
    fluency_level: string;
    topic: string;
    status: "generated" | "skipped" | "failed";
    path_id?: string;
    error?: string;
  }> = [];

  for (const pick of picks) {
    const key = `${pick.function}__${pick.fluency_level}__0`;

    // Skip if this pick already exists
    if (existingKeys.has(key)) {
      results.push({
        function: pick.function,
        fluency_level: pick.fluency_level,
        topic: pick.path_topic,
        status: "skipped",
      });
      console.log(
        `[seed-picks] Skipping ${pick.function}/${pick.fluency_level} — already exists`
      );
      continue;
    }

    try {
      console.log(
        `[seed-picks] Generating: ${pick.display_title} (${pick.function}/${pick.fluency_level})`
      );

      // 1. Generate the adapted learning path
      const path = await generateAndCacheCurriculum(pick.path_topic, {
        userFunction: pick.function as ProfessionalFunction,
        userFluency: pick.fluency_level as FluencyLevel,
      });

      // 2. Insert the pick metadata
      const { error: pickError } = await supabase
        .from("fp_onboarding_picks")
        .insert({
          function: pick.function,
          fluency_level: pick.fluency_level,
          path_topic: pick.path_topic,
          display_title: pick.display_title,
          display_description: pick.display_description,
          time_estimate_min:
            Math.round(path.estimated_duration_seconds / 60) ||
            pick.time_estimate_min,
          module_count:
            path.modules?.length ?? pick.module_count,
          tool_names: pick.tool_names,
          sort_order: 0,
        });

      if (pickError) {
        console.error(
          `[seed-picks] Pick insert failed for ${pick.function}/${pick.fluency_level}:`,
          pickError
        );
        results.push({
          function: pick.function,
          fluency_level: pick.fluency_level,
          topic: pick.path_topic,
          status: "failed",
          error: pickError.message,
        });
        continue;
      }

      results.push({
        function: pick.function,
        fluency_level: pick.fluency_level,
        topic: pick.path_topic,
        status: "generated",
        path_id: path.id,
      });

      console.log(
        `[seed-picks] Generated: ${pick.display_title} → path ${path.id}`
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(
        `[seed-picks] Failed for ${pick.function}/${pick.fluency_level}:`,
        msg
      );
      results.push({
        function: pick.function,
        fluency_level: pick.fluency_level,
        topic: pick.path_topic,
        status: "failed",
        error: msg,
      });
    }
  }

  const generated = results.filter((r) => r.status === "generated").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const failed = results.filter((r) => r.status === "failed").length;

  return NextResponse.json({
    success: failed === 0,
    summary: {
      total: picks.length,
      generated,
      skipped,
      failed,
    },
    results,
  });
}

/**
 * GET /api/admin/seed-onboarding-picks
 *
 * Returns the current state of onboarding picks.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get("x-admin-secret");
  if (authHeader !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: picks, error } = await supabase
    .from("fp_onboarding_picks")
    .select("*")
    .order("function")
    .order("fluency_level")
    .order("sort_order");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Build a coverage matrix
  const coverage: Record<string, string[]> = {};
  for (const pick of picks ?? []) {
    const p = pick as { function: string; fluency_level: string };
    if (!coverage[p.function]) coverage[p.function] = [];
    if (!coverage[p.function].includes(p.fluency_level)) {
      coverage[p.function].push(p.fluency_level);
    }
  }

  const totalExpected = 28; // 7 functions × 4 levels
  const totalPresent = (picks ?? []).filter(
    (p: { sort_order: number }) => p.sort_order === 0
  ).length;

  return NextResponse.json({
    total_picks: (picks ?? []).length,
    hero_picks: totalPresent,
    coverage_pct: Math.round((totalPresent / totalExpected) * 100),
    coverage,
    picks,
  });
}
