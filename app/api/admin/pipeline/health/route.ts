// ─── Pipeline Health API ─────────────────────────────────────

import { requireAdmin, isAdminError } from "@/lib/admin/requireAdmin";
import { getPipelineHealthSummary, getPipelineAlerts } from "@/lib/pipeline/logger";

/**
 * GET /api/admin/pipeline/health
 * Returns pipeline health summary and active alerts.
 */
export async function GET(): Promise<Response> {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth;

  const [health, alerts] = await Promise.all([
    getPipelineHealthSummary(),
    getPipelineAlerts(),
  ]);

  return Response.json({ ok: true, ...health, alerts });
}
