import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, isAdminError } from "@/lib/admin/requireAdmin";
import { createClient as createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth;

  const { id } = await params;
  const admin = createAdminClient();

  const [profileRes, sessionCountRes, taskCountRes, partyCountRes] =
    await Promise.all([
      admin.from("fp_profiles").select("*").eq("id", id).single(),
      admin
        .from("fp_sessions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", id),
      admin
        .from("fp_tasks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", id),
      admin
        .from("fp_party_participants")
        .select("id", { count: "exact", head: true })
        .eq("user_id", id),
    ]);

  if (profileRes.error) {
    return NextResponse.json(
      { error: profileRes.error.message },
      { status: 404 }
    );
  }

  return NextResponse.json({
    user: profileRes.data,
    sessionCount: sessionCountRes.count ?? 0,
    taskCount: taskCountRes.count ?? 0,
    partyCount: partyCountRes.count ?? 0,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth;

  const { id } = await params;
  const admin = createAdminClient();
  const body = await request.json();

  // Only allow specific fields
  const updates: Record<string, unknown> = {};
  if (body.display_name !== undefined) updates.display_name = body.display_name;
  if (body.username !== undefined) updates.username = body.username;
  if (body.is_admin !== undefined) updates.is_admin = body.is_admin;

  const { data, error } = await admin
    .from("fp_profiles")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ user: data });
}
