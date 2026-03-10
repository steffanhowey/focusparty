import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ isAdmin: false }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("fp_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    isAdmin: profile?.is_admin === true,
    userId: user.id,
  });
}
