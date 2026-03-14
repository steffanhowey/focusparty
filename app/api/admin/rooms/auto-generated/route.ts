// ─── List Auto-Generated Blueprints ──────────────────────────

import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { createClient } from "@/lib/supabase/admin";

export async function GET(request: Request): Promise<Response> {
  if (!(await verifyAdminAuth(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const reviewStatus = url.searchParams.get("review_status");
  const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);

  const supabase = createClient();

  let query = supabase
    .from("fp_room_blueprints")
    .select(`
      id, room_name, room_description, topic, topic_slug,
      heat_score_at_generation, review_status, review_notes,
      status, generation_source, created_at, reviewed_at,
      content_selection, curriculum_sequence
    `)
    .eq("generation_source", "auto")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (reviewStatus) {
    query = query.eq("review_status", reviewStatus);
  }

  const { data, error } = await query;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, blueprints: data ?? [] });
}
