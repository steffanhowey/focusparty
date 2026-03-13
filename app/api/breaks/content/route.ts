import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";
import {
  getUserTasteProfile,
  personalizeContentOrder,
} from "@/lib/breaks/tasteProfile";
import { getSponsorLock } from "@/lib/breaks/worldBreakProfiles";

/**
 * GET /api/breaks/content?room_world_key=...&category=...
 * GET /api/breaks/content?id=...  (single item by ID)
 *
 * Returns active break content items for a world.
 * When authenticated, items are re-ordered by the user's taste profile.
 * When `id` is provided, returns a single item directly (not wrapped in { items }).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  // Use admin client for reads — break content is public, RLS requires auth
  const supabase = createAdminClient();

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

  // ── Deduplicate by video_url+duration — keep highest taste_score per video per duration ──
  const seen = new Map<string, (typeof data)[number]>();
  for (const item of data ?? []) {
    const key = `${item.video_url ?? item.id}:${item.best_duration}`;
    const existing = seen.get(key);
    if (!existing || (item.taste_score ?? 0) > (existing.taste_score ?? 0)) {
      seen.set(key, item);
    }
  }
  let items = Array.from(seen.values());

  // ── Sponsor lock: only serve sponsor content when locked ──
  if (category) {
    const sponsor = getSponsorLock(category);
    if (sponsor) {
      items = items.filter(
        (item) =>
          (item.source_name ?? "").toLowerCase() ===
          sponsor.sourceName.toLowerCase()
      );
    }
  }

  // ── Personalize order if user is authenticated ──
  try {
    const serverClient = await createServerClient();
    const {
      data: { user },
    } = await serverClient.auth.getUser();

    if (user && items.length > 0) {
      const profile = await getUserTasteProfile(user.id, roomWorldKey);
      if (profile.size > 0) {
        items = personalizeContentOrder(items, profile);
      }
    }
  } catch {
    // Graceful degradation — serve default order when not authenticated
  }

  return NextResponse.json({ items });
}
