import { NextResponse } from "next/server";
import { requireAdmin, isAdminError } from "@/lib/admin/requireAdmin";
import { createClient as createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth;

  const admin = createAdminClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const [usersRes, activeSessionsRes, sessionsTodayRes, activePartiesRes] =
    await Promise.all([
      admin.from("fp_profiles").select("id", { count: "exact", head: true }),
      admin
        .from("fp_sessions")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      admin
        .from("fp_sessions")
        .select("id", { count: "exact", head: true })
        .gte("created_at", todayISO),
      admin
        .from("fp_parties")
        .select("id", { count: "exact", head: true })
        .in("status", ["waiting", "active"]),
    ]);

  return NextResponse.json({
    totalUsers: usersRes.count ?? 0,
    activeSessionsNow: activeSessionsRes.count ?? 0,
    sessionsToday: sessionsTodayRes.count ?? 0,
    activeParties: activePartiesRes.count ?? 0,
  });
}
