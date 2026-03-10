import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin, isAdminError } from "@/lib/admin/requireAdmin";
import { createClient as createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("fp_reserved_usernames")
    .select("username")
    .order("username");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    usernames: (data ?? []).map((r: { username: string }) => r.username),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth;

  const admin = createAdminClient();
  const { username } = await request.json();

  if (!username || typeof username !== "string") {
    return NextResponse.json({ error: "Username required" }, { status: 400 });
  }

  const { error } = await admin
    .from("fp_reserved_usernames")
    .insert({ username: username.toLowerCase().trim() });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
