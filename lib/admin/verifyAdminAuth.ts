import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@/lib/supabase/admin";

/**
 * Verify admin authorization via either ADMIN_SECRET bearer token
 * or session-based admin check (is_admin on fp_profiles).
 * Used in existing admin endpoints to allow the admin dashboard
 * to call them without the ADMIN_SECRET header.
 */
export async function verifyAdminAuth(request: Request): Promise<boolean> {
  // Check ADMIN_SECRET bearer token
  const authHeader = request.headers.get("authorization");
  const secret = process.env.ADMIN_SECRET;
  if (secret && authHeader === `Bearer ${secret}`) return true;

  // Check CRON_SECRET bearer token
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;

  // Fallback: session-based admin check
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("fp_profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    return profile?.is_admin === true;
  } catch {
    return false;
  }
}
