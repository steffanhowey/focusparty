// ─── Auto-Approval Config API ────────────────────────────────

import { requireAdmin, isAdminError } from "@/lib/admin/requireAdmin";
import { getAutoApprovalConfig, updateAutoApprovalConfig } from "@/lib/rooms/autoApproval";

/**
 * GET /api/admin/analytics/auto-approval/config
 * Returns the current auto-approval configuration.
 */
export async function GET(): Promise<Response> {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth;

  const config = await getAutoApprovalConfig();
  return Response.json({ ok: true, config });
}

/**
 * PATCH /api/admin/analytics/auto-approval/config
 * Update auto-approval configuration.
 */
export async function PATCH(request: Request): Promise<Response> {
  const auth = await requireAdmin();
  if (isAdminError(auth)) return auth;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  await updateAutoApprovalConfig(
    {
      enabled: body.enabled as boolean | undefined,
      minHeatScore: body.minHeatScore as number | undefined,
      minContentScore: body.minContentScore as number | undefined,
      minCreatorAuthority: body.minCreatorAuthority as number | undefined,
      minCurriculumItems: body.minCurriculumItems as number | undefined,
      maxDailyApprovals: body.maxDailyApprovals as number | undefined,
    },
    (body.updatedBy as string) ?? "admin"
  );

  const updated = await getAutoApprovalConfig();
  return Response.json({ ok: true, config: updated });
}
