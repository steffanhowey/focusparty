// ─── Auto-Approval Stats API ────────────────────────────────

import { requireAdmin, isAdminError } from "@/lib/admin/requireAdmin";
import { getAutoApprovalStats } from "@/lib/rooms/autoApproval";

/**
 * GET /api/admin/analytics/auto-approval/stats
 * Returns auto-approval stats (approved/skipped/cap counts).
 */
export async function GET(request: Request): Promise<Response> {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth;

  const url = new URL(request.url);
  const daysBack = Number(url.searchParams.get("daysBack") ?? 7);

  const stats = await getAutoApprovalStats(daysBack);
  return Response.json({ ok: true, stats });
}
