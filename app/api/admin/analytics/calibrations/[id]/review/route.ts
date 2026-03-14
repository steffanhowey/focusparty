// ─── Calibration Review API ──────────────────────────────────

import { requireAdmin, isAdminError } from "@/lib/admin/requireAdmin";
import { reviewCalibration } from "@/lib/analytics/scoreCalibration";

/**
 * POST /api/admin/analytics/calibrations/[id]/review
 * Mark a calibration as reviewed, optionally apply recommendations.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth;

  const { id } = await params;

  let body: { apply?: boolean; reviewedBy?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const apply = body.apply ?? false;
  const reviewedBy = body.reviewedBy ?? "admin";

  await reviewCalibration(id, reviewedBy, apply);

  return Response.json({ ok: true, id, applied: apply });
}
