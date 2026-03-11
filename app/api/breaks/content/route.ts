import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/breaks/content?room_world_key=...&category=...
 * GET /api/breaks/content?id=...  (single item by ID)
 *
 * Returns active break content items for a world, sorted by sort_order.
 * When `id` is provided, returns a single item directly (not wrapped in { items }).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const supabase = await createClient();

  // ── Single item by ID ──
  const id = url.searchParams.get("id");
  if (id) {
    const { data, error } = await supabase
      .from("fp_break_content_items")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.code === "PGRST116" ? 404 : 500 });
    }
    return NextResponse.json(data);
  }

  // ── List by world key ──
  const roomWorldKey = url.searchParams.get("room_world_key");
  const category = url.searchParams.get("category");

  if (!roomWorldKey) {
    return NextResponse.json(
      { error: "room_world_key or id is required" },
      { status: 400 }
    );
  }

  let query = supabase
    .from("fp_break_content_items")
    .select("*")
    .eq("room_world_key", roomWorldKey)
    .eq("status", "active")
    .order("sort_order", { ascending: true });

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}
