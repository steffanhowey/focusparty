// ─── Discovery Stats ─────────────────────────────────────────

import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { createClient } from "@/lib/supabase/admin";

export async function GET(request: Request): Promise<Response> {
  if (!(await verifyAdminAuth(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient();

  // Count candidates by discovery_source
  const sources = ["scheduled", "hot-topic", "creator", "manual"];
  const bySouce: Record<string, number> = {};

  for (const source of sources) {
    const { count } = await supabase
      .from("fp_break_content_candidates")
      .select("*", { count: "exact", head: true })
      .eq("discovery_source", source);
    bySouce[source] = count ?? 0;
  }

  // Legacy candidates without discovery_source
  const { count: nullCount } = await supabase
    .from("fp_break_content_candidates")
    .select("*", { count: "exact", head: true })
    .is("discovery_source", null);
  bySouce["legacy_null"] = nullCount ?? 0;

  // Count by status
  const statuses = ["pending", "evaluated", "rejected", "promoted"];
  const byStatus: Record<string, number> = {};

  for (const status of statuses) {
    const { count } = await supabase
      .from("fp_break_content_candidates")
      .select("*", { count: "exact", head: true })
      .eq("status", status);
    byStatus[status] = count ?? 0;
  }

  // Recent hot-topic discoveries (last 24h)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentHotTopic } = await supabase
    .from("fp_break_content_candidates")
    .select("*", { count: "exact", head: true })
    .eq("discovery_source", "hot-topic")
    .gte("discovered_at", yesterday);

  return Response.json({
    ok: true,
    bySource: bySouce,
    byStatus,
    recentHotTopic24h: recentHotTopic ?? 0,
  });
}
