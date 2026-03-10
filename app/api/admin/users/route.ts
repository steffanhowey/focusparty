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
  const search = url.searchParams.get("search") ?? "";
  const sortKey = url.searchParams.get("sort") ?? "created_at";
  const sortDir = url.searchParams.get("dir") === "asc";

  let query = admin
    .from("fp_profiles")
    .select("*", { count: "exact" })
    .order(sortKey, { ascending: sortDir })
    .range((page - 1) * limit, page * limit - 1);

  if (search) {
    query = query.or(
      `username.ilike.%${search}%,display_name.ilike.%${search}%,email.ilike.%${search}%`
    );
  }

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    users: data ?? [],
    total: count ?? 0,
    page,
    limit,
  });
}
