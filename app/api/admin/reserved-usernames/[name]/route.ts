import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, isAdminError } from "@/lib/admin/requireAdmin";
import { createClient as createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth;

  const { name } = await params;
  const admin = createAdminClient();

  const { error } = await admin
    .from("fp_reserved_usernames")
    .delete()
    .eq("username", name);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
