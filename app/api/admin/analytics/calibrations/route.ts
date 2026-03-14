// ─── Calibration Results API ─────────────────────────────────

import { requireAdmin, isAdminError } from "@/lib/admin/requireAdmin";
import { getRecentCalibrations } from "@/lib/analytics/scoreCalibration";

/**
 * GET /api/admin/analytics/calibrations
 * Returns recent score calibration results.
 */
export async function GET(request: Request): Promise<Response> {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth;

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 20);

  const calibrations = await getRecentCalibrations(limit);

  return Response.json({ ok: true, calibrations });
}
