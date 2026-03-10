import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, isAdminError } from "@/lib/admin/requireAdmin";
import { createClient as createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth;

  const admin = createAdminClient();
  const url = request.nextUrl;

  const worldKey = url.searchParams.get("world_key");
  const timeOfDay = url.searchParams.get("time_of_day");
  const status = url.searchParams.get("status");

  let query = admin
    .from("fp_room_background_assets")
    .select("*")
    .order("created_at", { ascending: false });

  if (worldKey) query = query.eq("world_key", worldKey);
  if (timeOfDay) query = query.eq("time_of_day_state", timeOfDay);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ assets: data ?? [] });
}
