// ─── Auto-Approval Log API ──────────────────────────────────

import { requireAdmin, isAdminError } from "@/lib/admin/requireAdmin";
import { getAutoApprovalLog } from "@/lib/rooms/autoApproval";

/**
 * GET /api/admin/analytics/auto-approval/log
 * Returns recent auto-approval decision log entries.
 */
export async function GET(request: Request): Promise<Response> {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth;

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 50);

  const log = await getAutoApprovalLog(limit);
  return Response.json({ ok: true, log });
}
