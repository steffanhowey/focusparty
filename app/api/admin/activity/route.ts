import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, isAdminError } from "@/lib/admin/requireAdmin";
import { createClient as createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth;

  const admin = createAdminClient();
  const url = request.nextUrl;

  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50")));
  const actorType = url.searchParams.get("actor_type");
  const eventType = url.searchParams.get("event_type");
  const partyId = url.searchParams.get("party_id");
  const userId = url.searchParams.get("user_id");

  let query = admin
    .from("fp_activity_events")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (actorType) query = query.eq("actor_type", actorType);
  if (eventType) query = query.eq("event_type", eventType);
  if (partyId) query = query.eq("party_id", partyId);
  if (userId) query = query.eq("user_id", userId);

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    events: data ?? [],
    total: count ?? 0,
    page,
    limit,
  });
}
