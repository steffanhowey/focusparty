// ─── Scaffolding Stats ──────────────────────────────────────

import { verifyAdminAuth } from "@/lib/admin/verifyAdminAuth";
import { createClient } from "@/lib/supabase/admin";

export async function GET(request: Request): Promise<Response> {
  if (!(await verifyAdminAuth(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient();

  // Count by scaffolding status
  const statuses = ["none", "pending", "generating", "complete", "failed"];
  const counts: Record<string, number> = {};

  for (const status of statuses) {
    const { count } = await supabase
      .from("fp_break_content_scores")
      .select("*", { count: "exact", head: true })
      .eq("scaffolding_status", status);
    counts[status] = count ?? 0;
  }

  // Also count nulls (legacy rows without the column set)
  const { count: nullCount } = await supabase
    .from("fp_break_content_scores")
    .select("*", { count: "exact", head: true })
    .is("scaffolding_status", null);
  counts["null_legacy"] = nullCount ?? 0;

  // Scaffolded items on active shelf
  const { count: shelfScaffolded } = await supabase
    .from("fp_break_content_items")
    .select("*", { count: "exact", head: true })
    .eq("status", "active")
    .eq("scaffolding_status", "complete");

  const { count: shelfTotal } = await supabase
    .from("fp_break_content_items")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  return Response.json({
    ok: true,
    scores: counts,
    shelf: {
      scaffolded: shelfScaffolded ?? 0,
      total: shelfTotal ?? 0,
    },
  });
}
