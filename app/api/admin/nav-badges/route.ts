// ─── Admin Nav Badge Counts ──────────────────────────────────

import { requireAdmin, isAdminError } from "@/lib/admin/requireAdmin";
import { createClient } from "@/lib/supabase/admin";
import { getPipelineAlerts } from "@/lib/pipeline/logger";

/**
 * GET /api/admin/nav-badges
 * Returns badge counts for admin navigation items.
 */
export async function GET(): Promise<Response> {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth;

  const supabase = createClient();

  const [pendingResult, alertsResult] = await Promise.all([
    supabase
      .from("fp_room_blueprints")
      .select("id", { count: "exact", head: true })
      .eq("generation_source", "auto")
      .eq("review_status", "pending"),
    getPipelineAlerts(),
  ]);

  return Response.json({
    ok: true,
    badges: {
      review: pendingResult.count ?? 0,
      pipeline: alertsResult.length,
    },
  });
}
