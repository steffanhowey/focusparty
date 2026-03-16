/**
 * GET /api/intelligence/cleanup
 *
 * Weekly cron (Sunday 4am UTC): archives expired insights and
 * deletes old practitioner snapshots (>180 days).
 */

import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { createClient } from "@/lib/supabase/admin";

export async function GET(request: Request): Promise<Response> {
  if (!(await verifyAdminAuth(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createClient();
  const now = new Date().toISOString();

  // Archive expired insights
  const { data: archivedRows } = await admin
    .from("fp_skill_intelligence")
    .update({ status: "archived" })
    .lt("expires_at", now)
    .neq("status", "archived")
    .select("id");

  const archivedCount = archivedRows?.length ?? 0;

  // Delete old snapshots (>180 days)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 180);
  const cutoffDate = cutoff.toISOString().split("T")[0];

  const { data: deletedRows } = await admin
    .from("fp_practitioner_snapshots")
    .delete()
    .lt("snapshot_date", cutoffDate)
    .select("skill_slug");

  const deletedCount = deletedRows?.length ?? 0;

  console.log(
    `[intelligence/cleanup] Archived ${archivedCount} insights, deleted ${deletedCount} old snapshots`
  );

  return Response.json({
    ok: true,
    archived_insights: archivedCount,
    deleted_snapshots: deletedCount,
  });
}
