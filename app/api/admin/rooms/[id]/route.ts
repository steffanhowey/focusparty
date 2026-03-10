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

  const [roomRes, participantsRes, eventsRes] = await Promise.all([
    admin.from("fp_parties").select("*").eq("id", id).single(),
    admin
      .from("fp_party_participants")
      .select("*")
      .eq("party_id", id)
      .order("joined_at", { ascending: false }),
    admin
      .from("fp_activity_events")
      .select("*")
      .eq("party_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (roomRes.error) {
    return NextResponse.json({ error: roomRes.error.message }, { status: 404 });
  }

  return NextResponse.json({
    room: roomRes.data,
    participants: participantsRes.data ?? [],
    recentEvents: eventsRes.data ?? [],
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

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.status !== undefined) updates.status = body.status;

  const { data, error } = await admin
    .from("fp_parties")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ room: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth;

  const { id } = await params;
  const admin = createAdminClient();

  // Delete participants first, then the party
  await admin.from("fp_party_participants").delete().eq("party_id", id);
  await admin.from("fp_activity_events").delete().eq("party_id", id);
  const { error } = await admin.from("fp_parties").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
