import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";

/**
 * Server-side admin auth helper for API routes.
 * Returns { userId } if authenticated admin, or a NextResponse error.
 */
export async function requireAdmin(): Promise<
  { userId: string } | NextResponse
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("fp_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return { userId: user.id };
}

/** Type guard to check if requireAdmin returned an error response. */
export function isAdminError(
  result: { userId: string } | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}
