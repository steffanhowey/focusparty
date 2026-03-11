import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/breaks/content?room_world_key=...&category=...
 *
 * Returns active break content items for a world, sorted by sort_order.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const roomWorldKey = url.searchParams.get("room_world_key");
  const category = url.searchParams.get("category");

  if (!roomWorldKey) {
    return NextResponse.json(
      { error: "room_world_key is required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

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
