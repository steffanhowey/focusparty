import { NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { createClient } from "@/lib/supabase/admin";

/**
 * GET /api/breaks/candidates?world_key=...&category=...&status=...
 * Admin endpoint to list candidates with their scores.
 */
export async function GET(request: Request) {
  if (!(await verifyAdminAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const worldKey = url.searchParams.get("world_key");
  const category = url.searchParams.get("category");
  const status = url.searchParams.get("status");
  const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);

  const supabase = createClient();

  let query = supabase
    .from("fp_break_content_candidates")
    .select(
      "*, scores:fp_break_content_scores(taste_score, relevance_score, engagement_score, content_density, creator_authority, freshness_score, novelty_score, evaluation_notes, editorial_note)"
    )
    .order("discovered_at", { ascending: false })
    .limit(limit);

  if (worldKey) {
    query = query.eq("world_key", worldKey);
  }
  if (category) {
    query = query.eq("category", category);
  }
  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ candidates: data ?? [] });
}
