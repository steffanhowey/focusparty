/**
 * POST /api/admin/seed-topic-skill-map
 *
 * One-shot admin endpoint to generate topic-to-skill mapping seed data.
 * Returns SQL for human review before committing.
 */

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { generateTopicSkillSeed } from "@/lib/intelligence/seedTopicSkillMap";

export async function POST(): Promise<NextResponse> {
  // Basic auth check
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await generateTopicSkillSeed();

    return NextResponse.json({
      stats: result.stats,
      sql: result.sql,
      mappings: result.mappings,
    });
  } catch (error) {
    console.error("[admin/seed-topic-skill-map] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate seed data" },
      { status: 500 }
    );
  }
}
