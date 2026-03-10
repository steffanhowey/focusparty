import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/admin";

/**
 * GET /api/backgrounds/list?worldKey=...&status=...
 *
 * Lists background assets, optionally filtered by world and status.
 * Public read (RLS allows it), but using admin client for consistency.
 *
 * Query params:
 *   worldKey  - filter by world (optional)
 *   timeOfDay - filter by time state: morning, afternoon, evening, late_night (optional)
 *   status    - filter by status: candidate, approved, active, archived (optional)
 *   limit     - max results, default 50 (optional)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const worldKey = url.searchParams.get("worldKey");
  const timeOfDay = url.searchParams.get("timeOfDay");
  const status = url.searchParams.get("status");
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? "50", 10) || 50,
    100
  );

  const supabase = createClient();

  let query = supabase
    .from("fp_room_background_assets")
    .select(
      "id, world_key, job_id, storage_path, public_url, status, time_of_day_state, width, height, file_size_bytes, score_overall, review_notes, created_at, reviewed_at, activated_at, archived_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (worldKey) {
    query = query.eq("world_key", worldKey);
  }

  if (timeOfDay) {
    query = query.eq("time_of_day_state", timeOfDay);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Add thumbnail URL (convention: same path with -thumb suffix)
  const assets = (data ?? []).map((asset) => ({
    ...asset,
    thumb_url: asset.public_url.replace(".webp", "-thumb.webp"),
  }));

  return NextResponse.json({ assets, count: assets.length });
}
