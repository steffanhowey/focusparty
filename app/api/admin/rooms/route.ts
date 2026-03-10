import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, isAdminError } from "@/lib/admin/requireAdmin";
import { createClient as createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth;

  const admin = createAdminClient();
  const url = request.nextUrl;

  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "25")));
  const status = url.searchParams.get("status");
  const worldKey = url.searchParams.get("world_key");

  let query = admin
    .from("fp_parties")
    .select("*, fp_party_participants(count)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (status) query = query.eq("status", status);
  if (worldKey) query = query.eq("world_key", worldKey);

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    rooms: data ?? [],
    total: count ?? 0,
    page,
    limit,
  });
}
