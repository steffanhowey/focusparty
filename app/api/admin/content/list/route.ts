// ─── Content List API ────────────────────────────────────────

import { NextRequest } from "next/server";
import { requireAdmin, isAdminError } from "@/lib/admin/requireAdmin";
import { createClient } from "@/lib/supabase/admin";

/**
 * GET /api/admin/content/list
 * Paginated content list with scores and scaffolding status.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth;

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);
  const status = url.searchParams.get("status");
  const worldKey = url.searchParams.get("world_key");
  const search = url.searchParams.get("q");
  const offset = (page - 1) * limit;

  const supabase = createClient();

  let query = supabase
    .from("fp_break_content_candidates")
    .select(
      `id, video_id, title, channel_name, world_key, category, status,
       scaffolding_status, duration_seconds, published_at, created_at,
       fp_break_content_scores(taste_score, relevance, engagement, content_density)`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);
  if (worldKey) query = query.eq("world_key", worldKey);
  if (search) query = query.ilike("title", `%${search}%`);

  const { data, error, count } = await query;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    items: data ?? [],
    total: count ?? 0,
    page,
    limit,
  });
}
